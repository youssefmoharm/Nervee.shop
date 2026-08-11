// supabase/functions/_shared/paymob.ts
//
// Shared Paymob logic used by both paymob-webhook (reacts to Paymob's push)
// and verify-payment (admin-triggered pull, for when the webhook never
// arrives). Both funnel through applyTransactionResult() so the "what does
// this transaction mean for our order" logic — and the webhook-redelivery
// idempotency check — only exists in one place.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { orderConfirmedEmail, sendEmail } from './email.ts'
import { logEvent } from './monitoring.ts'

const PAYMOB_BASE = 'https://accept.paymob.com/api'

export async function getPaymobAuthToken(): Promise<string> {
  const apiKey = Deno.env.get('PAYMOB_API_KEY')
  if (!apiKey) throw new Error('PAYMOB_API_KEY is not configured')

  const res = await fetch(`${PAYMOB_BASE}/auth/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  })
  const data = await res.json()
  if (!res.ok || !data.token) throw new Error('Paymob authentication failed')
  return data.token
}

/**
 * Looks up a Paymob order and returns its most recent transaction attempt,
 * if any. Used when we need to actively ask Paymob "what happened here?"
 * instead of waiting for a webhook.
 */
export async function fetchLatestPaymobTransaction(paymobOrderId: string, authToken: string) {
  const res = await fetch(`${PAYMOB_BASE}/ecommerce/orders/${paymobOrderId}?token=${authToken}`)
  if (!res.ok) throw new Error(`Paymob order lookup failed (${res.status})`)
  const data = await res.json()
  const transactions = data?.transactions ?? []
  if (transactions.length === 0) return null
  // Most recent attempt first.
  return transactions.sort((a: any, b: any) => (b.id ?? 0) - (a.id ?? 0))[0]
}

interface OrderRow {
  id: string
  order_number: string
  first_name: string
  email: string
  total: number
  subtotal: number
  shipping_cost: number
  discount_amount: number
  address: string
  city: string
  governorate: string
}

/**
 * Applies a Paymob transaction result to our order: idempotent (via
 * payment_events), updates payment_status/status, and sends the
 * confirmation email on first success. Returns what happened so the caller
 * (webhook or verify-payment) can respond appropriately.
 */
export async function applyTransactionResult(
  supabase: SupabaseClient,
  order: OrderRow,
  transaction: { 
    id: number | string; 
    success: boolean | string; 
    pending: boolean | string;
    amount_cents?: number;
    currency?: string;
    order?: { id?: string; merchant_order_id?: string };
    integration_id?: string;
  },
  webhookIp?: string
): Promise<{ applied: boolean; paymentStatus: string; error?: string }> {
  const transactionId = String(transaction.id)
  const success = transaction.success === true || transaction.success === 'true'
  const pending = transaction.pending === true || transaction.pending === 'true'
  const paymentStatus = success ? 'paid' : pending ? 'pending' : 'failed'

  // CRITICAL SECURITY VALIDATION: Verify transaction amounts and currency
  if (success && transaction.amount_cents) {
    const expectedAmountCents = Math.round(order.total * 100)
    const receivedAmountCents = Number(transaction.amount_cents)
    
    if (receivedAmountCents !== expectedAmountCents) {
      logEvent({
        type: 'error',
        category: 'PAYMENT_FRAUD',
        message: `Amount mismatch detected for order ${order.order_number}`,
        data: { 
          orderId: order.id,
          expectedAmount: expectedAmountCents,
          receivedAmount: receivedAmountCents,
          transactionId 
        },
      })
      return { 
        applied: false, 
        paymentStatus: 'failed', 
        error: 'Payment amount validation failed' 
      }
    }
  }

  // Verify currency (if provided)
  if (success && transaction.currency && transaction.currency !== 'EGP') {
    logEvent({
      type: 'error',
      category: 'PAYMENT_FRAUD',
      message: `Currency mismatch for order ${order.order_number}`,
      data: { 
        orderId: order.id,
        expectedCurrency: 'EGP',
        receivedCurrency: transaction.currency,
        transactionId 
      },
    })
    return { 
      applied: false, 
      paymentStatus: 'failed', 
      error: 'Currency validation failed' 
    }
  }

  // Verify merchant order ID matches (if provided)
  if (transaction.order?.merchant_order_id && transaction.order.merchant_order_id !== order.order_number) {
    logEvent({
      type: 'error',
      category: 'PAYMENT_FRAUD',
      message: `Order ID mismatch for transaction ${transactionId}`,
      data: { 
        expectedOrderNumber: order.order_number,
        receivedOrderNumber: transaction.order.merchant_order_id,
        transactionId 
      },
    })
    return { 
      applied: false, 
      paymentStatus: 'failed', 
      error: 'Order reference validation failed' 
    }
  }

  // Idempotency: first writer wins. If this transaction id was already
  // recorded, we've already applied its effects — skip silently.
  const { data: paymentEventResult, error: insertError } = await supabase
    .rpc('log_payment_event', {
      p_transaction_id: transactionId,
      p_order_id: order.id,
      p_webhook_ip: webhookIp || null,
      p_amount_verified: !!(success && transaction.amount_cents), // Only verified if we checked amount
    })

  if (insertError || !paymentEventResult) {
    // Duplicate transaction ID or other error - likely duplicate delivery
    return { applied: false, paymentStatus }
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('product_name, color, size, quantity, subtotal')
    .eq('order_id', order.id)

  await supabase
    .from('orders')
    .update({
      payment_status: paymentStatus,
      status: success ? 'processing' : 'placed',
      payment_transaction_id: transactionId,
      paid_at: success ? new Date().toISOString() : null,
    })
    .eq('id', order.id)

  if (success) {
    await sendEmail(
      order.email,
      `Order Confirmed — #${order.order_number}`,
      orderConfirmedEmail(order, items ?? [])
    )
  }

  // Log successful payment application
  logEvent({
    type: 'info',
    category: 'PAYMENT_SUCCESS',
    message: `Payment ${paymentStatus} applied to order ${order.order_number}`,
    data: { orderId: order.id, transactionId, paymentStatus },
  })

  return { applied: true, paymentStatus }
}
