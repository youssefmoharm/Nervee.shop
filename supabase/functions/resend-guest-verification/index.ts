// supabase/functions/resend-guest-verification/index.ts
//
// Re-issues a guest tracking token and re-sends the tracking link email.
// Anti-enumeration: always returns a generic success response regardless of
// whether the email/orderNumber pair exists. Rate-limited per IP and per email.
//
// POST { email, orderNumber }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getCorsHeaders } from '../_shared/cors.ts';
import { clientIp, distributedRateLimit, getRateLimitHeaders } from '../_shared/ratelimit.ts';
import { validateRequestSize } from '../_shared/validation.ts';
import { PerformanceTimer, logEvent } from '../_shared/monitoring.ts';
import { sendEmail } from '../_shared/email.ts';

const GENERIC_SUCCESS = {
  success: true,
  message: 'If that order exists, a new tracking link has been sent to your email.',
};

serve(async req => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  const timer = new PerformanceTimer('resend-guest-verification');

  try {
    const sizeErr = validateRequestSize(req, 5);
    if (sizeErr.length > 0) {
      timer.end();
      return json({ error: 'Request too large' }, 413, corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const ip = clientIp(req);
    const ipLimit = await distributedRateLimit(supabase, `resend-guest:${ip}`, {
      windowMs: 60000,
      maxRequests: 5,
    });
    if (!ipLimit.allowed) {
      timer.end();
      const headers = getRateLimitHeaders(ipLimit);
      return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, ...headers, 'Content-Type': 'application/json' },
      });
    }

    let body: { email?: string; orderNumber?: string };
    try {
      body = await req.json();
    } catch {
      timer.end();
      return json({ error: 'Invalid JSON' }, 400, corsHeaders);
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const orderNumber =
      typeof body.orderNumber === 'string' ? body.orderNumber.trim().toUpperCase() : '';

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !orderNumber ||
      !/^NRV-[0-9]{6}$/.test(orderNumber)
    ) {
      timer.end();
      return json({ error: 'Valid email and order number are required' }, 400, corsHeaders);
    }

    // Per-email rate limit (anti-abuse / enumeration hammering)
    const emailLimit = await distributedRateLimit(supabase, `resend-guest-email:${email}`, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 3,
    });
    if (!emailLimit.allowed) {
      timer.end();
      return json(GENERIC_SUCCESS, 200, corsHeaders);
    }

    const { data: guest } = await supabase
      .from('guest_orders')
      .select('id, email, order_number, expires_at')
      .eq('email', email)
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (!guest) {
      logEvent({
        type: 'info',
        category: 'GUEST_ORDER',
        message: 'Resend requested for unknown guest order (generic response)',
        data: { orderNumber },
      });
      timer.end();
      return json(GENERIC_SUCCESS, 200, corsHeaders);
    }

    // Rotate token: new plaintext + hash, fresh 30-day expiry
    const verificationToken =
      crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(verificationToken),
    );
    const tokenHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const { error: updateErr } = await supabase
      .from('guest_orders')
      .update({
        verification_token: verificationToken,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', guest.id);

    if (updateErr) {
      console.error('Failed to rotate guest token:', updateErr);
      timer.end();
      return json(GENERIC_SUCCESS, 200, corsHeaders);
    }

    const storeUrl = Deno.env.get('STORE_URL') || 'https://www.nerveey.shop';
    const trackingLink = `${storeUrl}/track-order?email=${encodeURIComponent(
      email,
    )}&orderNumber=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(
      verificationToken,
    )}`;

    const html = `
      <div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111827;">
        <h1 style="font-size:20px;">Your Order Tracking Link</h1>
        <p>Hi, here's your updated tracking link for order <strong>#${orderNumber}</strong>:</p>
        <p style="margin:24px 0;"><a href="${trackingLink}" style="background:#061735;color:#fff;padding:12px 24px;text-decoration:none;font-size:13px;">Track Your Order</a></p>
        <p style="color:#71717a;font-size:13px;">This link expires in 30 days. If you didn't request this, you can ignore this email.</p>
        <p style="color:#71717a;font-size:12px;">NERVE — Cool but Chic · hello@nerveey.shop</p>
      </div>`;

    const sendResult = await sendEmail(email, `Track Order #${orderNumber}`, html, 'transactional');
    if (!sendResult.success) {
      console.error('Resend tracking email failed:', sendResult.error);
    }

    logEvent({
      type: 'info',
      category: 'GUEST_ORDER',
      message: 'Guest tracking link resent',
      data: { orderNumber },
    });

    timer.end();
    return json(GENERIC_SUCCESS, 200, corsHeaders);
  } catch (err) {
    console.error('resend-guest-verification error:', err);
    timer.end();
    return json(
      { error: 'Failed to process request. Please try again.' },
      500,
      getCorsHeaders(req),
    );
  }
});

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
