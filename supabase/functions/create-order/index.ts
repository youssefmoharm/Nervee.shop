// supabase/functions/create-order/index.ts
//
// This is the ONE place an order gets created. It never trusts prices,
// totals, or stock counts sent from the browser — it hands the cart lines to
// the `place_order` Postgres function (see supabase/migrations/002_...sql),
// which locks inventory rows, re-prices everything from `products.price`,
// and rejects the whole order if anything is out of stock.
//
// For card payments it then opens a Paymob payment session and returns an
// iframe URL for the client to redirect/embed. For cash-on-delivery it
// returns the confirmed order directly.
//
// Deploy:
//   supabase functions deploy create-order
//
// Required secrets (set with `supabase secrets set KEY=value`, NEVER put
// these in the frontend .env / VITE_ variables):
//   PAYMOB_API_KEY              - Paymob "API Key" from Settings > Account Info
//   PAYMOB_INTEGRATION_ID_CARD  - Integration ID of your "Online Card" integration
//   PAYMOB_IFRAME_ID            - Iframe ID from Developers > Payment Integrations
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by
// the Edge Functions runtime — you don't set those yourself.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { orderConfirmedEmail, sendEmail } from '../_shared/email.ts'
import { getPaymobAuthToken } from '../_shared/paymob.ts'
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
  paymentMethod: 'cod' | 'card'
  discountCode?: string
  items: CartLineInput[]
}

const PAYMOB_BASE = 'https://accept.paymob.com/api'

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
      p_payment_provider: sanitizedBody.paymentMethod === 'card' ? 'paymob' : 'cod',
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

    logOrderSuccess(order.id, order.order_number, order.total, sanitizedBody.paymentMethod)

    if (sanitizedBody.paymentMethod === 'cod') {
      const { data: items } = await supabase
        .from('order_items')
        .select('product_name, color, size, quantity, subtotal')
        .eq('order_id', order.id)

      // COD is confirmed the moment it's placed — no payment step to wait on.
      await sendEmail(
        sanitizedBody.email,
        `Order Confirmed — #${order.order_number}`,
        orderConfirmedEmail(order, items ?? [])
      )

      timer.end()
      return json({ order, paymentUrl: null })
    }

    // ---- Card payment via Paymob ----
    // We deliberately do NOT email a confirmation yet — the order exists in
    // "placed"/payment "pending" so the reserved stock isn't lost, but the
    // customer hasn't actually paid. paymob-webhook (or an admin's manual
    // "Verify Payment") sends the confirmation once payment_status flips to
    // "paid".
    const paymentUrl = await createPaymobSession(supabase, order, sanitizedBody)
    timer.end()
    return json({ order, paymentUrl })
  } catch (err) {
    console.error('create-order error:', err)
    logOrderFailure(err.message, 'unknown', null)
    timer.end()
    return json({ error: 'Something went wrong placing your order. Please try again.' }, 500)
  }
})

async function createPaymobSession(supabase: any, order: any, body: CreateOrderBody): Promise<string> {
  const integrationId = Deno.env.get('PAYMOB_INTEGRATION_ID_CARD')
  const iframeId = Deno.env.get('PAYMOB_IFRAME_ID')

  if (!Deno.env.get('PAYMOB_API_KEY') || !integrationId || !iframeId) {
    throw new Error(
      'Paymob is not configured on the server (PAYMOB_API_KEY / PAYMOB_INTEGRATION_ID_CARD / PAYMOB_IFRAME_ID). ' +
        'Set these with `supabase secrets set`, or use Cash on Delivery in the meantime.'
    )
  }

  const amountCents = Math.round(order.total * 100)
  const authToken = await getPaymobAuthToken()

  // 2. Register order with Paymob
  const orderRes = await fetch(`${PAYMOB_BASE}/ecommerce/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: authToken,
      delivery_needed: false,
      amount_cents: amountCents,
      currency: 'EGP',
      merchant_order_id: order.order_number,
      items: [],
    }),
  })
  const orderData = await orderRes.json()
  if (!orderRes.ok || !orderData.id) throw new Error('Paymob order registration failed')

  // Save the Paymob order id right away, before payment even happens — this
  // is what lets an admin manually "Verify Payment" later if the webhook
  // never arrives (closed tab, network blip, etc).
  await supabase.from('orders').update({ paymob_order_id: String(orderData.id) }).eq('id', order.id)

  // 3. Payment key (billing data required by Paymob; "NA" is their documented
  // placeholder for optional fields we don't collect)
  const keyRes = await fetch(`${PAYMOB_BASE}/acceptance/payment_keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: authToken,
      amount_cents: amountCents,
      expiration: 3600,
      order_id: orderData.id,
      billing_data: {
        first_name: body.firstName || 'NA',
        last_name: body.lastName || 'NA',
        email: body.email,
        phone_number: body.phone,
        street: body.address || 'NA',
        city: body.city || 'NA',
        state: body.governorate || 'NA',
        country: 'EG',
        postal_code: body.postalCode || 'NA',
        apartment: 'NA',
        floor: 'NA',
        building: 'NA',
        shipping_method: 'NA',
      },
      currency: 'EGP',
      integration_id: Number(integrationId),
    }),
  })
  const keyData = await keyRes.json()
  if (!keyRes.ok || !keyData.token) throw new Error('Paymob payment key request failed')

  return `${PAYMOB_BASE}/acceptance/iframes/${iframeId}?payment_token=${keyData.token}`
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
