// supabase/functions/record-abandoned-cart/index.ts
//
// Records (or refreshes) an abandoned-cart row keyed by email. Called by the
// frontend when a cart sits idle. Rate-limited per IP and per email.
// Always returns success after validation to avoid leaking existence info.
//
// POST { email, phone?, items: [{ productId, name, color, size, quantity, price, image }] }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getCorsHeaders } from '../_shared/cors.ts';
import { clientIp, distributedRateLimit, getRateLimitHeaders } from '../_shared/ratelimit.ts';
import { validateEmail, validateRequestSize, sanitizeText } from '../_shared/validation.ts';
import { PerformanceTimer, logEvent } from '../_shared/monitoring.ts';

interface AbandonedCartItem {
  productId?: string;
  name?: string;
  color?: string;
  size?: string;
  quantity?: number;
  price?: number;
  image?: string;
}

serve(async req => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  const timer = new PerformanceTimer('record-abandoned-cart');

  try {
    const sizeErr = validateRequestSize(req, 30);
    if (sizeErr.length > 0) {
      timer.end();
      return json({ error: 'Request too large' }, 413, corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const ip = clientIp(req);
    const ipLimit = await distributedRateLimit(supabase, `abandoned-cart:${ip}`, {
      windowMs: 60000,
      maxRequests: 10,
    });
    if (!ipLimit.allowed) {
      timer.end();
      const headers = getRateLimitHeaders(ipLimit);
      return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, ...headers, 'Content-Type': 'application/json' },
      });
    }

    let body: { email?: string; phone?: string; items?: AbandonedCartItem[] };
    try {
      body = await req.json();
    } catch {
      timer.end();
      return json({ error: 'Invalid JSON' }, 400, corsHeaders);
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const emailErrors = validateEmail(email);
    if (emailErrors.length > 0) {
      timer.end();
      return json({ error: 'Valid email is required' }, 400, corsHeaders);
    }

    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0 || rawItems.length > 50) {
      timer.end();
      return json({ error: 'items must be a non-empty array (max 50)' }, 400, corsHeaders);
    }

    const emailLimit = await distributedRateLimit(supabase, `abandoned-cart-email:${email}`, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 10,
    });
    if (!emailLimit.allowed) {
      timer.end();
      return json({ success: true }, 200, corsHeaders);
    }

    const cartItems = rawItems.map(i => ({
      productId: typeof i.productId === 'string' ? sanitizeText(i.productId, 50) : '',
      name: typeof i.name === 'string' ? sanitizeText(i.name, 200) : 'Item',
      color: typeof i.color === 'string' ? sanitizeText(i.color, 50) : '',
      size: typeof i.size === 'string' ? sanitizeText(i.size, 20) : '',
      quantity:
        Number.isFinite(Number(i.quantity)) && Number(i.quantity) > 0
          ? Math.min(10, Math.floor(Number(i.quantity)))
          : 1,
      price:
        Number.isFinite(Number(i.price)) && Number(i.price) >= 0 ? Math.floor(Number(i.price)) : 0,
      image: typeof i.image === 'string' ? i.image.slice(0, 500) : '',
    }));

    const cartValue = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // Upsert one row per email (service_role bypasses RLS; table is deny-all for clients).
    const { error: upsertErr } = await supabase.from('cart_abandonment_tracking').upsert(
      {
        customer_email: email,
        cart_items: cartItems,
        cart_value: cartValue,
        last_activity_at: new Date().toISOString(),
        email_sent_at: null,
        recovered_at: null,
      },
      { onConflict: 'customer_email' },
    );

    if (upsertErr) {
      console.error('Failed to record abandoned cart:', upsertErr);
      timer.end();
      // Still return success — client shouldn't care whether tracking worked.
      return json({ success: true }, 200, corsHeaders);
    }

    logEvent({
      type: 'info',
      category: 'ABANDONED_CARTS',
      message: 'Abandoned cart recorded',
      data: {
        email: email.slice(0, 3) + '***',
        item_count: cartItems.length,
        cart_value: cartValue,
      },
    });

    timer.end();
    return json({ success: true }, 200, corsHeaders);
  } catch (err) {
    console.error('record-abandoned-cart error:', err);
    timer.end();
    return json({ error: 'Failed to record cart.' }, 500, getCorsHeaders(req));
  }
});

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
