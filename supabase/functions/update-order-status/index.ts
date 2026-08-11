// supabase/functions/update-order-status/index.ts
//
// The admin dashboard's status dropdown calls this instead of writing to
// `orders` directly. It delegates the actual state change to the
// `update_order_status` Postgres function (migration 003) — a single locked
// transaction that updates status/timestamps and restocks inventory exactly
// once if the order is being cancelled/refunded — then sends the matching
// customer email. "Change the status" and "tell the customer" can't drift
// apart because they always happen from this one call.
//
// Deploy:
//   supabase functions deploy update-order-status
//
// Admin-only: verified via requireAdmin() against admin_users.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin.ts'
import {
  sendEmail,
  orderShippedEmail,
  orderDeliveredEmail,
  orderCancelledEmail,
  orderRefundedEmail,
} from '../_shared/email.ts'

const VALID_STATUSES = ['placed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const admin = await requireAdmin(req, supabase)
    if (!admin) return json({ error: 'Admin access required.' }, 403)

    const { orderId, status, trackingNumber, trackingUrl } = await req.json()
    if (!orderId || !VALID_STATUSES.includes(status)) {
      return json({ error: 'orderId and a valid status are required.' }, 400)
    }

    const { data: order, error } = await supabase.rpc('update_order_status', {
      p_order_id: orderId,
      p_status: status,
      p_tracking_number: trackingNumber ?? null,
      p_tracking_url: trackingUrl ?? null,
    })

    if (error || !order) {
      return json({ error: error?.message ?? 'Could not update this order.' }, 400)
    }

    const { data: items } = await supabase
      .from('order_items')
      .select('product_name, color, size, quantity, subtotal')
      .eq('order_id', orderId)

    switch (status) {
      case 'shipped':
        await sendEmail(order.email, `Order Shipped — #${order.order_number}`, orderShippedEmail(order, items ?? []))
        break
      case 'delivered':
        await sendEmail(order.email, `Order Delivered — #${order.order_number}`, orderDeliveredEmail(order))
        break
      case 'cancelled':
        await sendEmail(order.email, `Order Cancelled — #${order.order_number}`, orderCancelledEmail(order))
        break
      case 'refunded':
        await sendEmail(order.email, `Order Refunded — #${order.order_number}`, orderRefundedEmail(order))
        break
      // 'placed' and 'processing' get no email: 'placed' already triggered
      // the order-received email at checkout, and 'processing' is a
      // low-signal internal step.
    }

    return json({ order })
  } catch (err) {
    console.error('update-order-status error:', err)
    return json({ error: 'Something went wrong updating this order.' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
