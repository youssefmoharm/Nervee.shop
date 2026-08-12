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

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { orderConfirmedEmail, sendEmail } from '../_shared/email.ts'
import { rateLimit, getRateLimitHeaders } from '../_shared/ratelimit.ts'
import {
  logOrderSuccess,
  logOrderFailure,
  logRateLimitHit,
  PerformanceTimer
} from '../_shared/monitoring.ts'
import {
  validateOrderRequest,
  validateRequestSize,
  ValidationException,
  sanitizeText
} from '../_shared/validation.ts'

interface CartLineInput {
  productId: string
  color: string
  size: string
  quantity: number
  image?: string
}

interface CreateOrderBody {
  email: string
  firstName: string
  lastName: string
  phone: string
  address: string
  city: string
  governorate: string
  postalCode?: string
  deliveryMethod: 'standard' | 'express'
  paymentMethod: 'cod'
  discountCode?: string
  items: CartLineInput[]
}

serve(async (req) => {
  const timer = new PerformanceTimer('create-order')

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Request size validation
    const sizeErrors = validateRequestSize(req, 50) // 50KB max
    if (sizeErrors.length > 0) {
      return json({ error: 'Request too large', details: sizeErrors }, 413)
    }

    // Rate limiting: 10 orders per minute per IP (adjust as needed)
    const identifier = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'anonymous'
    const allowed = rateLimit(identifier, { windowMs: 60000, maxRequests: 10 })

    if (!allowed) {
      logRateLimitHit(identifier, 'create-order')
      const rateLimitHeaders = getRateLimitHeaders(identifier, { windowMs: 60000, maxRequests: 10 })
      return new Response(
        JSON.stringify({ error: 'Too many order requests. Please try again in a minute.' }),
        {
          status: 429,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Identify the logged-in customer from their JWT, if any. We do NOT
    // trust a customer_id passed in the request body — guests get NULL.
    let customerId: string | null = null
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: userData } = await supabase.auth.getUser(token)
      if (userData?.user) customerId = userData.user.id
    }

    const body: CreateOrderBody = await req.json()

    // Comprehensive input validation
    const validationErrors = validateOrderRequest(body)
    if (validationErrors.length > 0) {
      return json({ error: 'Validation failed', details: validationErrors }, 400)
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
    }

    const { data: order, error } = await supabase.rpc('place_order', {
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
      p_items: sanitizedBody.items.map((i) => ({
        product_id: i.productId,
        color: i.color,
        size: i.size,
        quantity: i.quantity,
        image: i.image ?? '',
      })),
    })

    if (error) {
      // place_order raises a plain, user-safe message (out of stock, empty
      // cart, etc.) — pass it straight through instead of a generic 500.
      logOrderFailure(error.message, customerId || 'guest', body.items)
      timer.end()
      return json({ error: error.message }, 400)
    }

    logOrderSuccess(order.id, order.order_number, order.total, 'cod')

    // COD is confirmed the moment it's placed — no payment step to wait on.
    const { data: items } = await supabase
      .from('order_items')
      .select('product_name, color, size, quantity, subtotal')
      .eq('order_id', order.id)

    await sendEmail(
      sanitizedBody.email,
      `Order Confirmed — #${order.order_number}`,
      orderConfirmedEmail(order, items ?? [])
    )

    timer.end()
    return json({ order })
  } catch (err) {
    console.error('create-order error:', err)
    logOrderFailure(err.message, 'unknown', null)
    timer.end()
    return json({ error: 'Something went wrong placing your order. Please try again.' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}