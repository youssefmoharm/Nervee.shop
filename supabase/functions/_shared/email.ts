// supabase/functions/_shared/email.ts
//
// Thin wrapper around Resend's HTTP API (no SDK needed — one fetch call).
// Requires the RESEND_API_KEY secret. If it's not set, sendEmail() logs and
// no-ops rather than throwing, so a missing email config never blocks an
// order from being placed.
//
//   supabase secrets set RESEND_API_KEY=re_xxx
//   supabase secrets set RESEND_FROM_EMAIL="NERVE <orders@yourdomain.com>"

const RESEND_API = 'https://api.resend.com/emails'

export async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM_EMAIL') ?? 'NERVE <onboarding@resend.dev>'

  if (!apiKey) {
    console.warn(`RESEND_API_KEY not set — skipping email "${subject}" to ${to}`)
    return
  }

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!res.ok) {
      console.error('Resend error:', await res.text())
    }
  } catch (err) {
    console.error('Failed to send email:', err)
  }
}

interface OrderForEmail {
  order_number: string
  first_name: string
  total: number
  subtotal: number
  shipping_cost: number
  discount_amount: number
  address: string
  city: string
  governorate: string
  tracking_number?: string | null
  tracking_url?: string | null
}

interface OrderItemForEmail {
  product_name: string
  color: string
  size: string
  quantity: number
  subtotal: number
}

function layout(preheader: string, bodyHtml: string): string {
  return `
  <div style="background:#f4f4f5;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;color:#111827;">
    <span style="display:none;font-size:1px;color:#f4f4f5;">${preheader}</span>
    <table style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;">
      <tr>
        <td style="background:#061735;padding:28px 32px;">
          <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.05em;">NERVE</span>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px;border-top:1px solid #e5e5e5;color:#71717a;font-size:12px;">
          NERVE — Cool but Chic · hello@nerveey.shop
        </td>
      </tr>
    </table>
  </div>`
}

function itemsTable(items: OrderItemForEmail[]): string {
  return `
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    ${items
      .map(
        (i) => `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:10px 0;font-size:13px;">
          <strong>${escapeHtml(i.product_name)}</strong><br/>
          <span style="color:#71717a;">${escapeHtml(i.color)} / ${escapeHtml(i.size)} · Qty ${i.quantity}</span>
        </td>
        <td style="padding:10px 0;font-size:13px;text-align:right;">EGP ${i.subtotal.toLocaleString()}</td>
      </tr>`
      )
      .join('')}
  </table>`
}

function totalsTable(order: OrderForEmail): string {
  return `
  <table style="width:100%;font-size:13px;margin-top:8px;">
    <tr><td style="color:#71717a;padding:2px 0;">Subtotal</td><td style="text-align:right;">EGP ${order.subtotal.toLocaleString()}</td></tr>
    <tr><td style="color:#71717a;padding:2px 0;">Shipping</td><td style="text-align:right;">${order.shipping_cost === 0 ? 'Free' : `EGP ${order.shipping_cost}`}</td></tr>
    ${order.discount_amount > 0 ? `<tr><td style="color:#71717a;padding:2px 0;">Discount</td><td style="text-align:right;">-EGP ${order.discount_amount.toLocaleString()}</td></tr>` : ''}
    <tr><td style="font-weight:700;padding-top:8px;border-top:1px solid #eee;">Total</td><td style="text-align:right;font-weight:700;padding-top:8px;border-top:1px solid #eee;">EGP ${order.total.toLocaleString()}</td></tr>
  </table>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export function orderConfirmedEmail(order: OrderForEmail, items: OrderItemForEmail[]) {
  return layout(
    `Order #${order.order_number} confirmed`,
    `
    <h1 style="font-size:20px;margin:0 0 8px;">Order Confirmed</h1>
    <p style="font-size:14px;color:#3f3f46;">Hi ${escapeHtml(order.first_name)}, thanks for your order — we're getting it ready.</p>
    <p style="font-size:13px;color:#71717a;margin:16px 0 4px;">Order #${order.order_number}</p>
    ${itemsTable(items)}
    ${totalsTable(order)}
    <p style="font-size:13px;color:#71717a;margin-top:20px;">Shipping to: ${escapeHtml(order.address)}, ${escapeHtml(order.city)}, ${escapeHtml(order.governorate)}</p>
    `
  )
}

export function orderShippedEmail(order: OrderForEmail, items: OrderItemForEmail[]) {
  return layout(
    `Order #${order.order_number} has shipped`,
    `
    <h1 style="font-size:20px;margin:0 0 8px;">Your Order Has Shipped</h1>
    <p style="font-size:14px;color:#3f3f46;">Hi ${escapeHtml(order.first_name)}, order #${order.order_number} is on its way.</p>
    ${order.tracking_number
      ? `<p style="font-size:13px;margin:16px 0;">Tracking number: <strong>${escapeHtml(order.tracking_number)}</strong>${order.tracking_url ? ` — <a href="${order.tracking_url}" style="color:#061735;">Track your package</a>` : ''
      }</p>`
      : ''
    }
    ${itemsTable(items)}
    `
  )
}

export function orderDeliveredEmail(order: OrderForEmail) {
  return layout(
    `Order #${order.order_number} delivered`,
    `
    <h1 style="font-size:20px;margin:0 0 8px;">Delivered</h1>
    <p style="font-size:14px;color:#3f3f46;">Hi ${escapeHtml(order.first_name)}, order #${order.order_number} has been delivered. We hope you love it.</p>
    <p style="font-size:13px;color:#71717a;margin-top:16px;">Something not right? Reply to this email or reach us at hello@nerveey.shop within 14 days for returns/exchanges.</p>
    `
  )
}

export function orderCancelledEmail(order: OrderForEmail) {
  return layout(
    `Order #${order.order_number} cancelled`,
    `
    <h1 style="font-size:20px;margin:0 0 8px;">Order Cancelled</h1>
    <p style="font-size:14px;color:#3f3f46;">Hi ${escapeHtml(order.first_name)}, order #${order.order_number} has been cancelled. Any reserved items have been released back into stock.</p>
    <p style="font-size:13px;color:#71717a;margin-top:16px;">Questions? hello@nerveey.shop</p>
    `
  )
}

export function orderRefundedEmail(order: OrderForEmail) {
  return layout(
    `Order #${order.order_number} refunded`,
    `
    <h1 style="font-size:20px;margin:0 0 8px;">Refund Processed</h1>
    <p style="font-size:14px;color:#3f3f46;">Hi ${escapeHtml(order.first_name)}, order #${order.order_number} has been refunded.</p>
    `
  )
}

export function backInStockEmail(productName: string, size: string, url: string) {
  return layout(
    `${productName} is back in stock`,
    `
    <h1 style="font-size:20px;margin:0 0 8px;">Back in Stock</h1>
    <p style="font-size:14px;color:#3f3f46;">${escapeHtml(productName)} is back in stock in size ${escapeHtml(size)} — while it lasts.</p>
    <p style="margin-top:20px;"><a href="${url}" style="background:#061735;color:#ffffff;padding:12px 24px;text-decoration:none;font-size:13px;letter-spacing:0.05em;">SHOP NOW</a></p>
    `
  )
}
