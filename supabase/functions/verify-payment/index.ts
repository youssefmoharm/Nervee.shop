// supabase/functions/verify-payment/index.ts
//
// Covers the case AUDIT.md flagged: if Paymob's webhook never fires (network
// blip, customer closes the tab mid-redirect), an order can sit in
// payment_status "pending" forever with stock already held. This gives the
// admin a "Verify Payment" button that actively asks Paymob what actually
// happened, instead of waiting on a callback that may never come.
//
// Deploy:
//   supabase functions deploy verify-payment
//
// Admin-only: verified via requireAdmin() against admin_users.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin.ts'
import { getPaymobAuthToken, fetchLatestPaymobTransaction, applyTransactionResult } from '../_shared/paymob.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const admin = await requireAdmin(req, supabase)
    if (!admin) return json({ error: 'Admin access required.' }, 403)

    const { orderId } = await req.json()
    if (!orderId) return json({ error: 'orderId is required.' }, 400)

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_number, first_name, email, total, subtotal, shipping_cost, discount_amount, address, city, governorate, paymob_order_id, payment_provider, payment_status')
      .eq('id', orderId)
      .single()

    if (error || !order) return json({ error: 'Order not found.' }, 404)

    if (order.payment_provider !== 'paymob') {
      return json({ error: 'This order was not paid by card — nothing to verify with Paymob.' }, 400)
    }
    if (!order.paymob_order_id) {
      return json({ error: 'No Paymob order is associated with this order (the payment session may never have been created).' }, 400)
    }

    const authToken = await getPaymobAuthToken()
    const transaction = await fetchLatestPaymobTransaction(order.paymob_order_id, authToken)

    if (!transaction) {
      return json({ status: 'no_transaction_yet', message: 'Paymob has no transaction attempts recorded for this order yet.' })
    }

    const result = await applyTransactionResult(supabase, order, {
      id: transaction.id,
      success: transaction.success,
      pending: transaction.pending,
    })

    return json({
      status: result.paymentStatus,
      applied: result.applied,
      message: result.applied
        ? `Order updated to payment_status="${result.paymentStatus}".`
        : `Already processed — no change (payment_status is "${result.paymentStatus}").`,
    })
  } catch (err) {
    console.error('verify-payment error:', err)
    return json({ error: 'Something went wrong verifying this payment.' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
