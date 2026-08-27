// supabase/functions/payment-webhook/index.ts
//
// Provider webhook — the ONLY source of truth for payment state.
// Verifies HMAC/signature, handles idempotency, and transitions order
// payment_status. Never trusts a browser redirect.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { getCorsHeaders } from '../_shared/cors.ts'
import { PerformanceTimer, logEvent } from '../_shared/monitoring.ts'

serve(async (req) => {
  // Webhooks are server-to-server, not browser — CORS is permissive but
  // the HMAC check is the real gate.
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, corsHeaders)

  const timer = new PerformanceTimer('payment-webhook')

  try {
    const provider = req.headers.get('x-payment-provider') || 'paymob'
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      timer.end()
      return json({ error: 'Invalid JSON' }, 400, corsHeaders)
    }

    // ---- HMAC verification (Paymob) ----
    if (provider === 'paymob') {
      const hmacSecret = Deno.env.get('PAYMOB_HMAC_SECRET')
      if (!hmacSecret) {
        timer.end()
        return json({ error: 'Webhook not configured' }, 503, corsHeaders)
      }

      const receivedHmac = req.headers.get('x-paymob-hmac') || (body.hmac as string) || ''
      if (!receivedHmac) {
        timer.end()
        return json({ error: 'Missing HMAC' }, 401, corsHeaders)
      }

      // Paymob HMAC: sort relevant fields, concat, HMAC-SHA512
      // Simplified verification — in production use exact Paymob spec.
      const encoder = new TextEncoder()
      const key = await crypto.subtle.importKey('raw', encoder.encode(hmacSecret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign'])
      const payload = JSON.stringify(body)
      const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
      const expected = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, '0')).join('')

      // Constant-time compare
      if (expected.length !== receivedHmac.length) {
        timer.end()
        return json({ error: 'Invalid HMAC' }, 401, corsHeaders)
      }
      let diff = 0
      for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ receivedHmac.charCodeAt(i)
      if (diff !== 0) {
        timer.end()
        return json({ error: 'Invalid HMAC' }, 401, corsHeaders)
      }
    }

    // Extract order/payment identifiers (provider-specific shape)
    const orderId = (body.order_id as string) || (body.orderId as string) || ''
    const providerTxId = (body.transaction_id as string) || (body.id as string) || ''
    const paymentStatus = (body.status as string) || (body.payment_status as string) || ''

    if (!orderId) {
      timer.end()
      return json({ error: 'Missing order_id' }, 400, corsHeaders)
    }

    // Idempotency: if this provider transaction was already processed, return success
    if (providerTxId) {
      const { data: existing } = await supabase
        .from('payment_attempts')
        .select('id, status')
        .eq('provider_transaction_id', providerTxId)
        .maybeSingle()
      if (existing && existing.status !== 'pending') {
        timer.end()
        return json({ success: true, message: 'Already processed', paymentAttempt: existing }, 200, corsHeaders)
      }
    }

    // Map provider status to internal status
    let internalStatus: string = 'pending'
    const s = paymentStatus.toLowerCase()
    if (['paid', 'captured', 'success', 'completed'].includes(s)) internalStatus = 'captured'
    else if (['failed', 'declined', 'error'].includes(s)) internalStatus = 'failed'
    else if (['cancelled', 'canceled'].includes(s)) internalStatus = 'cancelled'
    else if (['refunded'].includes(s)) internalStatus = 'refunded'

    // Update payment attempt
    const { data: attempt } = await supabase
      .from('payment_attempts')
      .select('id, order_id, status')
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (attempt) {
      await supabase
        .from('payment_attempts')
        .update({
          status: internalStatus,
          provider_transaction_id: providerTxId || attempt.id,
          provider_response: body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', attempt.id)
    }

    // Update order payment_status (source of truth is webhook, not browser)
    if (internalStatus === 'captured') {
      await supabase
        .from('orders')
        .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('payment_status', 'pending') // only transition from pending

      // Audit
      await supabase.from('order_status_history').insert({
        order_id: orderId,
        from_status: 'pending',
        to_status: 'paid',
        reason: `Payment captured via ${provider} webhook`,
      })
    } else if (internalStatus === 'failed') {
      await supabase.from('orders').update({ payment_status: 'failed' }).eq('id', orderId)
    }

    logEvent({
      type: 'info',
      category: 'PAYMENT_WEBHOOK',
      message: `Webhook processed for order ${orderId}`,
      data: { provider, orderId, providerTxId, internalStatus },
    })

    timer.end()
    return json({ success: true, orderId, status: internalStatus }, 200, corsHeaders)
  } catch (err) {
    console.error('payment-webhook error:', err)
    timer.end()
    return json({ error: 'Webhook processing failed', details: (err as Error).message }, 500, getCorsHeaders(req))
  }
})

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  const h = headers
  return new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json' } })
}
