// supabase/functions/create-order/index.ts
//
// This is the ONE place an order gets created. It never trusts prices,
// totals, or stock counts sent from the browser — it hands the cart lines to
// the `place_order` Postgres function (see supabase/migrations/002_...sql),
// which locks inventory rows, re-prices everything from `products.price`,
// and rejects the whole order if anything is out of stock.
//
// For cash-on-delivery it returns the confirmed order directly.
//
// Deploy:
//   supabase functions deploy create-order
//
// Required secrets (set with `supabase secrets set KEY=value`, NEVER put
// these in the frontend .env / VITE_ variables):
//   RESEND_API_KEY        - Resend API key for sending emails
//   RESEND_FROM_EMAIL     - Email address to send from (e.g., "NERVE <orders@yourdomain.com>")
//   STORE_URL             - Your production domain (for links in emails)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by
// the Edge Functions runtime — you don't set those yourself.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getCorsHeaders } from '../_shared/cors.ts';
import { orderConfirmedEmail, sendEmail } from '../_shared/email.ts';
import {
  generateCorrelationId,
  logEvent,
  logOrderSuccess,
  logOrderFailure,
  logRateLimitHit,
  PerformanceTimer,
} from '../_shared/monitoring.ts';
import {
  distributedRateLimit,
  getRateLimitHeaders,
  rateLimitIdentifier,
} from '../_shared/ratelimit.ts';
import { validateOrderRequest, validateRequestSize, sanitizeText } from '../_shared/validation.ts';

// Matches frontend PlaceOrderResult: { order: {...} | null, error: string | null }
interface PlaceOrderResultShape {
  order: {
    id: string;
    order_number: string;
    subtotal: number;
    shipping_cost: number;
    discount_amount: number;
    total: number;
  } | null;
  error: string | null;
}

interface CartLineInput {
  productId: string;
  color: string;
  size: string;
  quantity: number;
  image?: string;
}

interface CreateOrderBody {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  governorate: string;
  postalCode?: string;
  deliveryMethod: 'standard' | 'express';
  paymentMethod: 'cod';
  discountCode?: string;
  items: CartLineInput[];
  idempotencyKey: string; // Required: prevents duplicate orders on retry
}

serve(async req => {
  const corsHeaders = getCorsHeaders(req);
  const timer = new PerformanceTimer('create-order');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Request size validation
    const sizeErrors = validateRequestSize(req, 50); // 50KB max
    if (sizeErrors.length > 0) {
      return json(
        { order: null, error: 'Request too large', details: sizeErrors },
        413,
        corsHeaders,
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Identify the logged-in customer from their JWT, if any. We do NOT
    // trust a customer_id passed in the request body — guests get NULL.
    // Resolved BEFORE rate limiting so authenticated users get their own
    // rate-limit bucket instead of sharing the anon IP bucket.
    let customerId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user) customerId = userData.user.id;
    }

    // Rate limiting: 10 orders per minute per identifier (user JWT / token / IP)
    const identifier = await rateLimitIdentifier(req, supabase);
    const rateLimitResult = await distributedRateLimit(supabase, `create-order:${identifier}`, {
      windowMs: 60000,
      maxRequests: 10,
    });

    if (!rateLimitResult.allowed) {
      logRateLimitHit(identifier, 'create-order');
      const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
      return new Response(
        JSON.stringify({
          order: null,
          error: 'Too many order requests. Please try again in a minute.',
        }),
        {
          status: 429,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const body: CreateOrderBody = await req.json();

    // Comprehensive input validation
    const validationErrors = validateOrderRequest(body);
    if (validationErrors.length > 0) {
      return json(
        { order: null, error: 'Validation failed', details: validationErrors },
        400,
        corsHeaders,
      );
    }

    // Sanitize text inputs
    const sanitizedBody = {
      ...body,
      firstName: sanitizeText(body.firstName, 100),
      lastName: sanitizeText(body.lastName, 100),
      address: sanitizeText(body.address, 500),
      city: sanitizeText(body.city, 100),
      governorate: sanitizeText(body.governorate, 100),
      postalCode: body.postalCode ? sanitizeText(body.postalCode, 20) : undefined,
      discountCode: body.discountCode ? sanitizeText(body.discountCode, 20) : undefined,
    };

    const { data: rpcData, error } = await supabase.rpc('place_order_with_idempotency', {
      p_customer_id: customerId,
      p_email: sanitizedBody.email,
      p_first_name: sanitizedBody.firstName,
      p_last_name: sanitizedBody.lastName,
      p_phone: sanitizedBody.phone,
      p_address: sanitizedBody.address,
      p_city: sanitizedBody.city,
      p_governorate: sanitizedBody.governorate,
      p_postal_code: sanitizedBody.postalCode ?? null,
      p_delivery_method: sanitizedBody.deliveryMethod,
      p_payment_provider: 'cod',
      p_discount_code: sanitizedBody.discountCode ?? null,
      p_items: sanitizedBody.items.map(i => ({
        product_id: i.productId,
        color: i.color,
        size: i.size,
        quantity: i.quantity,
        image: i.image ?? '',
      })),
      p_idempotency_key: sanitizedBody.idempotencyKey,
    });

    if (error) {
      // place_order raises a plain, user-safe message (out of stock, empty
      // cart, etc.) — pass it straight through instead of a generic 500.
      logOrderFailure(error.message, customerId || 'guest', body.items);
      timer.end();
      return json({ order: null, error: error.message }, 400, corsHeaders);
    }

    // check_rate_limit-style RETURNS TABLE → PostgREST yields an array; unwrap.
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!row || !row.order_id) {
      timer.end();
      return json(
        { order: null, error: 'Order could not be placed. Please try again.' },
        500,
        corsHeaders,
      );
    }

    const isDuplicate = row.is_duplicate === true;

    // RPC row only has (order_id, order_number, total, is_duplicate) —
    // fetch the full orders row for emails / response payload.
    const { data: fullOrder, error: fetchError } = await supabase
      .from('orders')
      .select(
        'id, order_number, email, first_name, last_name, status, total, subtotal, shipping_cost, discount_amount, address, city, governorate, placed_at',
      )
      .eq('id', row.order_id)
      .maybeSingle();

    if (fetchError || !fullOrder) {
      console.error('Failed to fetch created order:', fetchError);
      timer.end();
      return json(
        {
          order: null,
          error: 'Order was created but could not be loaded. Please contact support.',
        },
        500,
        corsHeaders,
      );
    }

    logOrderSuccess(fullOrder.id, fullOrder.order_number, fullOrder.total, 'cod');

    // Idempotent retry: order already existed — skip side effects (email,
    // guest token, recovered mark) so retries never double-send.
    if (!isDuplicate) {
      // Guest checkout: persist a tracking token so the confirmation email
      // link (and resend-guest-verification) can look the order up.
      if (!customerId) {
        const verificationToken =
          crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
        const { hashBuffer } = await sha256(verificationToken);
        const tokenHash = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        const { error: guestErr } = await supabase.from('guest_orders').upsert(
          {
            email: fullOrder.email,
            order_number: fullOrder.order_number,
            verification_token: verificationToken,
            token_hash: tokenHash,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            order_id: fullOrder.id,
          },
          { onConflict: 'order_number' },
        );
        if (guestErr) console.error('Failed to create guest_orders row:', guestErr);

        const storeUrl = Deno.env.get('STORE_URL') || 'https://www.nerveey.shop';
        const trackingLink = `${storeUrl}/track-order?email=${encodeURIComponent(
          fullOrder.email,
        )}&orderNumber=${encodeURIComponent(fullOrder.order_number)}&token=${encodeURIComponent(
          verificationToken,
        )}`;

        const { data: items } = await supabase
          .from('order_items')
          .select('product_name, color, size, quantity, subtotal')
          .eq('order_id', fullOrder.id);

        const sendResult = await sendEmail(
          fullOrder.email,
          `Order Confirmed — #${fullOrder.order_number}`,
          orderConfirmedEmail(fullOrder, items ?? [], trackingLink),
          'order_confirmation',
        );
        if (!sendResult.success) {
          console.error('Order confirmation email failed:', sendResult.error);
        }
      } else {
        const { data: items } = await supabase
          .from('order_items')
          .select('product_name, color, size, quantity, subtotal')
          .eq('order_id', fullOrder.id);

        const sendResult = await sendEmail(
          fullOrder.email,
          `Order Confirmed — #${fullOrder.order_number}`,
          orderConfirmedEmail(fullOrder, items ?? []),
          'order_confirmation',
        );
        if (!sendResult.success) {
          console.error('Order confirmation email failed:', sendResult.error);
        }
      }

      // Mark any tracked abandoned cart for this email as recovered.
      try {
        await supabase.rpc('mark_cart_abandonment_recovered', {
          p_customer_email: fullOrder.email,
        });
      } catch (recoveredErr) {
        console.error('mark_cart_abandonment_recovered failed:', recoveredErr);
      }
    }

    timer.end();

    // Add correlation ID to response headers for tracing
    const correlationId = generateCorrelationId();
    req.headers.set('x-correlation-id', correlationId);
    const responseHeaders = {
      ...corsHeaders,
      'X-Correlation-Id': correlationId,
      'RateLimit-Limit': '10',
      'RateLimit-Remaining': String(rateLimitResult.remaining),
      'RateLimit-Reset': String(Math.floor(rateLimitResult.resetTime / 1000)),
    };
    logEvent({
      type: 'info',
      category: 'ORDER_CREATED',
      message: `Order ${fullOrder.order_number} created successfully`,
      data: { orderId: fullOrder.id, total: fullOrder.total, isDuplicate },
      correlationId,
    });

    // PlaceOrderResult shape: { order: {...} | null, error: string | null }
    const result: PlaceOrderResultShape = {
      order: {
        id: fullOrder.id,
        order_number: fullOrder.order_number,
        subtotal: fullOrder.subtotal,
        shipping_cost: fullOrder.shipping_cost,
        discount_amount: fullOrder.discount_amount,
        total: fullOrder.total,
      },
      error: null,
    };
    return json(result, 200, responseHeaders);
  } catch (err) {
    console.error('create-order error:', err);
    const correlationId = generateCorrelationId();
    const errorHeaders = {
      ...getCorsHeaders(req),
      'X-Correlation-Id': correlationId,
    };
    logEvent({
      type: 'error',
      category: 'ORDER_ERROR',
      message: `Order creation failed: ${(err as Error).message}`,
      correlationId,
    });
    timer.end();
    return json(
      { order: null, error: 'Something went wrong placing your order. Please try again.' },
      500,
      errorHeaders,
    );
  }
});

async function sha256(text: string): Promise<{ hashBuffer: ArrayBuffer }> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return { hashBuffer };
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
