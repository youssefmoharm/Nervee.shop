// supabase/functions/create-payment/index.ts
//
// Provider-agnostic payment session creation. Currently supports:
// - cod: no external call, just validates order belongs to caller
// - paymob: creates Paymob intention (requires PAYMOB_API_KEY + HMAC secrets)
//
// Never trusts browser-supplied amounts — amount is derived server-side from
// the order's total. Webhook is the source of truth for paid state.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { getCorsHeaders } from '../_shared/cors.ts'
import { PerformanceTimer, logEvent } from '../_shared/monitoring.ts'

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, corsHeaders)

  const timer = new PerformanceTimer('create-payment')

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Auth required — derive customer from JWT
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token || token.startsWith('sb_publishable_') || token.startsWith('sb_secret_')) {
      timer.end()
      return json({ error: 'Authentication required' }, 401, corsHeaders)
    }

    const { data: userData } = await supabase.auth.getUser(token)
    if (!userData?.user) {
      timer.end()
      return json({ error: 'Invalid or expired session' }, 401, corsHeaders)
    }
    const userId = userData.user.id

    let body: { orderId?: string; provider?: string; idempotencyKey?: string }
    try {
      body = await req.json()
    } catch {
      timer.end()
      return json({ error: 'Invalid JSON' }, 400, corsHeaders)
    }

    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
    const provider = typeof body.provider === 'string' ? body.provider.trim().toLowerCase() : 'cod'
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : crypto.randomUUID()

    if (!orderId || !/^[0-9a-f-]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
      timer.end()
      return json({ error: 'Valid orderId is required' }, 400, corsHeaders)
    }
    if (!['cod', 'paymob'].includes(provider)) {
      timer.end()
      return json({ error: 'Provider must be cod or paymob' }, 400, corsHeaders)
    }

    // Fetch order and verify ownership
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_id, total, payment_status, status')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError || !order) {
      timer.end()
      return json({ error: 'Order not found' }, 404, corsHeaders)
    }
    if (order.customer_id !== userId) {
      // Check admin bypass
      const { data: adminRow } = await supabase.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle()
      if (!adminRow) {
        timer.end()
        return json({ error: 'Forbidden' }, 403, corsHeaders)
      }
    }
    if (order.payment_status === 'paid') {
      timer.end()
      return json({ error: 'Order is already paid' }, 409, corsHeaders)
    }

    // Idempotency: return existing attempt if same key
    const { data: existing } = await supabase
      .from('payment_attempts')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (existing) {
      timer.end()
      return json({ success: true, paymentAttempt: existing, reused: true }, 200, corsHeaders)
    }

    if (provider === 'cod') {
      // COD does not need external provider — just record attempt
      const { data: attempt, error: insertError } = await supabase
        .from('payment_attempts')
        .insert({
          order_id: orderId,
          provider: 'cod',
          amount: order.total,
          currency: 'EGP',
          status: 'pending',
          idempotency_key: idempotencyKey,
        })
        .select()
        .single()

      if (insertError) {
        // Unique violation on idempotency_key → concurrent request, return existing
        if (insertError.code === '23505') {
          const { data: retry } = await supabase.from('payment_attempts').select('*').eq('idempotency_key', idempotencyKey).maybeSingle()
          timer.end()
          return json({ success: true, paymentAttempt: retry, reused: true }, 200, corsHeaders)
        }
        throw insertError
      }

      logEvent({ type: 'info', category: 'PAYMENT', message: 'COD payment attempt created', data: { orderId, attemptId: attempt.id } })
      timer.end()
      return json({ success: true, paymentAttempt: attempt }, 200, corsHeaders)
    }

    // Paymob — only if configured
    const paymobKey = Deno.env.get('PAYMOB_API_KEY')
    const paymobHmac = Deno.env.get('PAYMOB_HMAC_SECRET')
    if (!paymobKey || !paymobHmac) {
      timer.end()
      return json({ error: 'Card payments are not configured. Please use Cash on Delivery.' }, 503, corsHeaders)
    }

    // Paymob intention creation would go here (API call to Paymob).
    // For now, create a pending attempt and return instructions.
    // Full integration: call Paymob API, store provider_transaction_id, return clientSecret/paymentUrl.
    const { data: attempt, error: paymobError } = await supabase
      .from('payment_attempts')
      .insert({
        order_id: orderId,
        provider: 'paymob',
        amount: order.total,
        currency: 'EGP',
        status: 'pending',
        idempotency_key: idempotencyKey,
      })
      .select()
      .single()

    if (paymobError) throw paymobError

    logEvent({ type: 'info', category: 'PAYMENT', message: 'Paymob payment attempt created', data: { orderId, attemptId: attempt.id } })
    timer.end()
    return json(
      {
        success: true,
        paymentAttempt: attempt,
        message: 'Paymob integration pending — complete via webhook',
      },
      200,
      corsHeaders,
    )
  } catch (err) {
    console.error('create-payment error:', err)
    timer.end()
    return json({ error: 'Failed to create payment', details: (err as Error).message }, 500, getCorsHeaders(req))
  }
})

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  const h = Object.keys(headers).length ? headers : { 'Access-Control-Allow-Origin': '*' }
  return new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json' } })
}
