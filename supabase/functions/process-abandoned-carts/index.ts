// supabase/functions/process-abandoned-carts/index.ts
//
// Scheduled job to send cart-abandonment emails. Only callable by
// service_role / admin / cron secret — not by anonymous browsers.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin.ts'
import { PerformanceTimer, logEvent } from '../_shared/monitoring.ts'

interface AbandonedCart {
  customer_email: string
  cart_items: CartItem[]
  cart_value: number
  last_activity_at: string
}
interface CartItem {
  name: string
  color: string
  size: string
  quantity: number
  price: number
  image: string
}

function isAuthorizedCron(req: Request): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret) {
    const got = req.headers.get('x-cron-secret') || req.headers.get('x-app-cron-secret') || ''
    if (got === cronSecret) return true
  }
  return false
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, corsHeaders)
  }

  const timer = new PerformanceTimer('process-abandoned-carts')

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // ---- Auth: service_role token OR admin JWT OR cron secret ----
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    const cronOk = isAuthorizedCron(req)
    let authorized = cronOk || token === serviceRoleKey
    if (!authorized && token) {
      const admin = await requireAdmin(req, supabase)
      authorized = !!admin
    }
    if (!authorized) {
      timer.end()
      return json({ error: 'Unauthorized — service_role, admin, or cron secret required' }, 401, corsHeaders)
    }

    const { data: abandonedCarts, error: fetchError } = await supabase.rpc('find_abandoned_carts_for_email')

    if (fetchError) {
      console.error('Failed to fetch abandoned carts:', fetchError)
      timer.end()
      return json({ error: 'Failed to fetch abandoned carts', details: fetchError.message }, 500, corsHeaders)
    }

    if (!abandonedCarts || (abandonedCarts as unknown[]).length === 0) {
      logEvent({ type: 'info', category: 'ABANDONED_CARTS', message: 'No abandoned carts to process' })
      timer.end()
      return json({ success: true, processed: 0, message: 'No abandoned carts found' }, 200, corsHeaders)
    }

    logEvent({
      type: 'info',
      category: 'ABANDONED_CARTS',
      message: `Found ${(abandonedCarts as unknown[]).length} abandoned carts to process`,
    })

    let successCount = 0
    let failureCount = 0

    for (const cart of abandonedCarts as AbandonedCart[]) {
      try {
        const recoveryUrl = `${Deno.env.get('STORE_URL') || 'https://nerveey.shop'}/cart?recovery=true&email=${encodeURIComponent(cart.customer_email)}`
        const html = generateCartAbandonmentEmail(cart, recoveryUrl)

        const sendResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: cart.customer_email,
            subject: `You left ${(cart.cart_items as CartItem[]).length} item${(cart.cart_items as CartItem[]).length > 1 ? 's' : ''} in your cart ✨`,
            html,
            type: 'cart_abandonment',
            metadata: {
              cart_value: cart.cart_value,
              item_count: (cart.cart_items as CartItem[]).length,
              recovery_url: recoveryUrl,
            },
          }),
        })

        if (!sendResponse.ok) {
          const error = await sendResponse.text()
          throw new Error(`Send email failed: ${error}`)
        }

        const { error: updateError } = await supabase.rpc('mark_cart_abandonment_email_sent', {
          p_customer_email: cart.customer_email,
        })
        if (updateError) {
          console.error('Failed to mark cart as emailed:', updateError)
          failureCount++
        } else {
          successCount++
        }
      } catch (err) {
        console.error(`Failed to process cart for ${cart.customer_email}:`, err)
        failureCount++
      }
    }

    logEvent({
      type: 'info',
      category: 'ABANDONED_CARTS',
      message: `Processed ${successCount} successful, ${failureCount} failed`,
      data: { success: successCount, failed: failureCount },
    })

    timer.end()
    return json(
      { success: true, processed: successCount, failed: failureCount, total: (abandonedCarts as unknown[]).length, message: `Sent ${successCount} abandonment emails` },
      200,
      corsHeaders,
    )
  } catch (err) {
    console.error('Cart abandonment processor error:', err)
    timer.end()
    return json({ error: 'Processing failed', details: (err as Error).message }, 500, getCorsHeaders(req))
  }
})

function generateCartAbandonmentEmail(cart: AbandonedCart, recoveryUrl: string): string {
  const cartItems = cart.cart_items as CartItem[]
  const itemsHtml = cartItems
    .map(
      (item) => `
    <tr>
      <td style="padding: 15px; border-bottom: 1px solid #eee;">
        <img src="${item.image}" alt="${escapeHtml(item.name)}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
      </td>
      <td style="padding: 15px; border-bottom: 1px solid #eee;">
        <h3 style="margin: 0; font-size: 16px;">${escapeHtml(item.name)}</h3>
        <p style="margin: 5px 0; color: #666;">Size: ${escapeHtml(item.size)}</p>
        <p style="margin: 5px 0; color: #666;">Quantity: ${item.quantity}</p>
      </td>
      <td style="padding: 15px; border-bottom: 1px solid #eee; text-align: right;">
        <strong>EGP ${(item.price * item.quantity).toLocaleString()}</strong>
      </td>
    </tr>`,
    )
    .join('')

  return `
    <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Complete Your Purchase</title></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #061735 0%, #1a365d 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Don't miss out! ⏰</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your items are waiting for you</p>
        </div>
        <div style="padding: 30px;">
          <p style="font-size: 18px; margin-bottom: 20px;">Hi there! 👋</p>
          <p style="margin-bottom: 25px;">You left <strong>${cartItems.length} awesome item${cartItems.length > 1 ? 's' : ''}</strong> worth <strong>EGP ${cart.cart_value.toLocaleString()}</strong> in your bag.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 25px 0; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
            ${itemsHtml}
            <tr><td colspan="2" style="padding: 20px; font-weight: 600; font-size: 18px; text-align: right; background: #f8f9fa;">Total: EGP ${cart.cart_value.toLocaleString()}</td></tr>
          </table>
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0;">
            <h3 style="margin: 0; font-size: 20px;">Special Offer Just for You! 🎉</h3>
            <p style="margin: 10px 0; font-size: 16px;">Complete your purchase in the next 24 hours and get <strong>10% OFF</strong></p>
            <p style="margin: 0; font-size: 14px; opacity: 0.9;">Use code: <strong>COMEBACK10</strong></p>
          </div>
          <div style="text-align: center; margin: 30px 0;"><a href="${recoveryUrl}" style="background: #061735; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">Complete Your Purchase →</a></div>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h4 style="margin: 0 0 15px 0; color: #061735;">Why choose NERVE?</h4>
            <ul style="margin: 0; padding-left: 20px;"><li>✅ Free delivery across Egypt</li><li>✅ 14-day easy returns</li><li>✅ Premium quality guaranteed</li></ul>
          </div>
          <p style="margin-top: 30px; font-size: 14px; color: #666; text-align: center;">This offer expires in 24 hours. ⏰</p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;"><p style="margin: 0;">NERVE - Cool but Chic | Cairo, Egypt</p></div>
      </div>
    </body></html>
  `
}
function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }
  return text.replace(/[&<>"']/g, (c) => map[c] || c)
}
function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  const h = headers
  return new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json' } })
}
