// supabase/functions/payment-reconciliation/index.ts
//
// Background job for payment expiration and reconciliation
// Should be called periodically (e.g., every 5 minutes) via cron or scheduled task
//
// Handles:
// 1. Expired payments (release inventory, cancel orders)
// 2. Discount usage reconciliation for failed payments
// 3. Audit logging for payment issues

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin.ts'
import { logEvent, PerformanceTimer } from '../_shared/monitoring.ts'

// Configuration
const PAYMENT_TIMEOUT_MINUTES = 30 // Expire pending payments after 30 minutes
const MAX_PROCESS_BATCH = 100 // Process max 100 orders per run

serve(async (req) => {
  const timer = new PerformanceTimer('payment-reconciliation')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // Only admins can run this manually, or it can be called by cron with service role
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const admin = await requireAdmin(req, supabase)
      if (!admin) {
        timer.end()
        return json({ error: 'Admin access required.' }, 403)
      }
    }

    const results = {
      expiredOrders: 0,
      discountsRestored: 0,
      inventoryReleased: 0,
      errors: 0,
    }

    // Find expired pending payments
    const expiredTime = new Date(Date.now() - PAYMENT_TIMEOUT_MINUTES * 60 * 1000).toISOString()
    
    const { data: expiredOrders, error: fetchError } = await supabase
      .from('orders')
      .select(`
        id, 
        order_number, 
        payment_status, 
        status,
        customer_id,
        discount_amount,
        placed_at,
        order_items (
          product_id,
          size,
          quantity
        )
      `)
      .eq('payment_status', 'pending')
      .eq('payment_provider', 'paymob')
      .lt('placed_at', expiredTime)
      .limit(MAX_PROCESS_BATCH)

    if (fetchError) {
      throw new Error(`Failed to fetch expired orders: ${fetchError.message}`)
    }

    if (!expiredOrders?.length) {
      timer.end()
      return json({ 
        message: 'No expired orders to process',
        results,
      })
    }

    logEvent({
      type: 'info',
      category: 'PAYMENT_RECONCILIATION',
      message: `Processing ${expiredOrders.length} expired orders`,
    })

    // Process each expired order
    for (const order of expiredOrders) {
      try {
        await processExpiredOrder(supabase, order, results)
      } catch (error) {
        results.errors++
        logEvent({
          type: 'error',
          category: 'PAYMENT_RECONCILIATION',
          message: `Failed to process expired order ${order.order_number}`,
          data: { orderId: order.id, error: error.message },
        })
      }
    }

    timer.end()
    return json({
      message: `Processed ${expiredOrders.length} expired orders`,
      results,
    })
  } catch (err) {
    console.error('Payment reconciliation error:', err)
    logEvent({
      type: 'error',
      category: 'PAYMENT_RECONCILIATION',
      message: `Reconciliation job failed: ${err.message}`,
    })
    timer.end()
    return json({ error: 'Reconciliation job failed' }, 500)
  }
})

async function processExpiredOrder(supabase: any, order: any, results: any) {
  const { id: orderId, order_number: orderNumber } = order

  // Begin transaction-like operations (Supabase doesn't support real transactions in Edge Functions)
  
  // 1. Cancel the order and update payment status
  const { error: orderUpdateError } = await supabase
    .from('orders')
    .update({
      status: 'cancelled',
      payment_status: 'failed',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  if (orderUpdateError) {
    throw new Error(`Failed to cancel order: ${orderUpdateError.message}`)
  }

  // 2. Restore inventory for all order items
  for (const item of order.order_items || []) {
    const { error: inventoryError } = await supabase
      .from('product_inventory')
      .update({
        stock_quantity: supabase.raw('stock_quantity + ?', [item.quantity]),
        in_stock: true, // If we're adding stock, mark as in stock
      })
      .eq('product_id', item.product_id)
      .eq('size', item.size)

    if (inventoryError) {
      logEvent({
        type: 'error',
        category: 'INVENTORY_RESTORATION',
        message: `Failed to restore inventory for ${item.product_id}/${item.size}`,
        data: { orderId, productId: item.product_id, size: item.size },
      })
    } else {
      results.inventoryReleased += item.quantity
    }
  }

  // 3. Restore discount usage if applicable
  if (order.discount_amount > 0) {
    // We need to find which discount was used - this requires looking at the order creation log
    // For now, we'll implement a simpler approach: restore all discounts that might have been used
    
    // This is a simplified approach - in a real system, you'd track which discount was used per order
    const { error: discountRestoreError } = await supabase.rpc('restore_discount_usage', {
      p_order_id: orderId
    })

    if (!discountRestoreError) {
      results.discountsRestored++
    }
  }

  // 4. Log the expiration
  logEvent({
    type: 'info',
    category: 'ORDER_EXPIRED',
    message: `Order ${orderNumber} expired and cancelled`,
    data: { 
      orderId, 
      orderNumber, 
      customerId: order.customer_id,
      expiredAfterMinutes: PAYMENT_TIMEOUT_MINUTES,
    },
  })

  results.expiredOrders++
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}