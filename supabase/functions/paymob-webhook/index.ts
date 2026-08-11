// supabase/functions/paymob-webhook/index.ts
//
// Paymob calls this after every transaction attempt. We verify the HMAC
// signature ourselves (never trust the "success" flag without it — anyone
// could POST a fake success payload otherwise), then hand off to
// applyTransactionResult() (shared with verify-payment) which is idempotent:
// a retried webhook delivery for a transaction we've already processed is a
// safe no-op, not a duplicate email or a double-applied status change.
//
// Configure this URL in Paymob: Developers > Payment Integrations > your
// integration > Transaction processed callback:
//   https://<your-project-ref>.supabase.co/functions/v1/paymob-webhook
//
// Deploy:
//   supabase functions deploy paymob-webhook --no-verify-jwt
//   (--no-verify-jwt because Paymob calls this directly, not with a Supabase
//   user session — the HMAC check below is what authenticates the request)
//
// Required secret:
//   PAYMOB_HMAC_SECRET  - "HMAC" value from Paymob > Settings > Account Info

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { applyTransactionResult } from '../_shared/paymob.ts'
import { logHMACFailure, logWebhookFailure, PerformanceTimer } from '../_shared/monitoring.ts'

// Exact field order Paymob specifies for the HMAC calculation on the
// "TRANSACTION" callback. Verify against current Paymob docs before going
// live — providers occasionally revise this list.
const HMAC_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
]

serve(async (req) => {
  const timer = new PerformanceTimer('paymob-webhook')
  
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const receivedHmac = url.searchParams.get('hmac')
    const payload = await req.json()
    const obj = payload.obj ?? payload

    const hmacSecret = Deno.env.get('PAYMOB_HMAC_SECRET')
    if (!hmacSecret || !receivedHmac) {
      logWebhookFailure('Missing HMAC secret or HMAC parameter')
      timer.end()
      return new Response('Missing HMAC', { status: 400, headers: corsHeaders })
    }

    const concatenated = HMAC_FIELDS.map((path) => getPath(obj, path)).join('')
    const computedHmac = await hmacSha512Hex(hmacSecret, concatenated)

    if (computedHmac !== receivedHmac.toLowerCase()) {
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
      logHMACFailure(ip, { transactionId: obj?.id, orderId: obj?.order?.merchant_order_id })
      console.error('Paymob webhook: HMAC mismatch — ignoring payload')
      timer.end()
      return new Response('Invalid signature', { status: 401, headers: corsHeaders })
    }

    // Webhook timestamp validation to prevent replay attacks
    const transactionCreatedAt = obj.created_at
    if (transactionCreatedAt) {
      const transactionTime = new Date(transactionCreatedAt).getTime()
      const currentTime = Date.now()
      const maxAge = 5 * 60 * 1000 // 5 minutes
      
      if (currentTime - transactionTime > maxAge) {
        console.error('Paymob webhook: Transaction too old, possible replay attack')
        logWebhookFailure('Webhook rejected: transaction older than 5 minutes')
        timer.end()
        return new Response('Transaction expired', { status: 400, headers: corsHeaders })
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const merchantOrderId = obj?.order?.merchant_order_id
    if (!merchantOrderId) {
      return new Response('No merchant_order_id in payload', { status: 400, headers: corsHeaders })
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, first_name, email, total, subtotal, shipping_cost, discount_amount, address, city, governorate')
      .eq('order_number', merchantOrderId)
      .single()

    if (orderError || !order) {
      logWebhookFailure('Order not found for merchant_order_id: ' + merchantOrderId)
      console.error('Paymob webhook: no matching order for', merchantOrderId)
      timer.end()
      return new Response('Order not found', { status: 404, headers: corsHeaders })
    }

    // Enhanced webhook logging with IP tracking
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
    
    const result = await applyTransactionResult(supabase, order, {
      id: obj.id,
      success: obj.success,
      pending: obj.pending,
      amount_cents: obj.amount_cents,
      currency: obj.currency,
      order: obj.order,
      integration_id: obj.integration_id,
    }, ip) // Pass IP for logging

    timer.end()
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('paymob-webhook error:', err)
    logWebhookFailure(err.message, err)
    timer.end()
    return new Response('error', { status: 500, headers: corsHeaders })
  }
})

function getPath(obj: any, path: string): string {
  const value = path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj)
  return value === null || value === undefined ? '' : String(value)
}

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
