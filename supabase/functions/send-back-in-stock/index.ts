// supabase/functions/send-back-in-stock/index.ts
//
// Scheduled job to send back-in-stock notifications
// Triggered when product inventory changes (stock_quantity > 0)
// Finds all customers who requested notifications for this product
// Sends personalized back-in-stock emails
//
// Called by: product inventory update trigger
// Schedule: Real-time via trigger (or can be run manually)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { PerformanceTimer, logEvent } from '../_shared/monitoring.ts'

interface BackInStockRequest {
    request_id: string
    product_id: string
    customer_email: string
    size: string | null
}

interface ProductInfo {
    id: string
    name: string
    slug: string
    price: number
}

serve(async (req) => {
    const timer = new PerformanceTimer('send-back-in-stock')

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
        timer.end()
        return json({ error: 'Method not allowed' }, 405)
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        const body = await req.json()
        const { product_id } = body

        if (!product_id) {
            timer.end()
            return json({ error: 'product_id is required' }, 400)
        }

        // Find all pending back-in-stock notifications for this product
        const { data: notifications, error: fetchError } = await supabase
            .rpc('find_back_in_stock_notifications')

        if (fetchError) {
            console.error('Failed to fetch back-in-stock notifications:', fetchError)
            timer.end()
            return json({ error: 'Failed to fetch notifications', details: fetchError }, 500)
        }

        if (!notifications || notifications.length === 0) {
            timer.end()
            return json({ success: true, sent: 0, message: 'No pending notifications' })
        }

        // Filter for this product
        const relevantNotifications = (notifications as BackInStockRequest[]).filter(
            (n) => n.product_id === product_id
        )

        if (relevantNotifications.length === 0) {
            timer.end()
            return json({ success: true, sent: 0, message: 'No pending notifications for this product' })
        }

        // Fetch product info
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, name, slug, price')
            .eq('id', product_id)
            .single()

        if (productError || !product) {
            console.error('Failed to fetch product:', productError)
            timer.end()
            return json({ error: 'Product not found' }, 404)
        }

        const storeUrl = Deno.env.get('STORE_URL') || 'https://nerve-store.com'
        const productUrl = `${storeUrl}/product/${(product as ProductInfo).slug}`

        let successCount = 0
        let failureCount = 0

        // Send email to each customer
        for (const notification of relevantNotifications) {
            try {
                const html = generateBackInStockEmail(
                    (product as ProductInfo).name,
                    notification.size,
                    productUrl,
                    (product as ProductInfo).price
                )

                // Send email
                const sendResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        to: notification.customer_email,
                        subject: `🔥 ${(product as ProductInfo).name} is back in stock!`,
                        html,
                        type: 'back_in_stock',
                        metadata: {
                            product_id: product_id,
                            size: notification.size,
                        },
                    }),
                })

                if (!sendResponse.ok) {
                    throw new Error(`Send email failed: ${await sendResponse.text()}`)
                }

                // Mark as notified
                const { error: updateError } = await supabase
                    .rpc('mark_back_in_stock_notified', {
                        p_request_id: notification.request_id,
                    })

                if (updateError) {
                    console.error('Failed to mark as notified:', updateError)
                    failureCount++
                } else {
                    successCount++
                    logEvent({
                        type: 'info',
                        category: 'BACK_IN_STOCK',
                        message: `Sent back-in-stock email to ${notification.customer_email}`,
                        data: { product_id, size: notification.size },
                    })
                }
            } catch (err) {
                console.error(`Failed to send back-in-stock email to ${notification.customer_email}:`, err)
                failureCount++
            }
        }

        timer.end()

        return json({
            success: true,
            sent: successCount,
            failed: failureCount,
            total: relevantNotifications.length,
        })
    } catch (err) {
        console.error('Back-in-stock processor error:', err)
        timer.end()
        return json({ error: 'Processing failed', details: (err as Error).message }, 500)
    }
})

function generateBackInStockEmail(
    productName: string,
    size: string | null,
    productUrl: string,
    price: number
): string {
    const sizeText = size ? ` in size ${size}` : ''

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Back in Stock</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 600;">It's Back! 🔥</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">The item you were waiting for</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px; text-align: center;">
          <h2 style="margin: 0 0 15px 0; color: #061735;">${escapeHtml(productName)}</h2>
          <p style="font-size: 24px; color: #f5576c; font-weight: 600; margin: 10px 0;">EGP ${price.toLocaleString()}</p>
          
          ${sizeText ? `<p style="color: #666; margin: 10px 0;">Available ${sizeText}</p>` : ''}
          
          <p style="margin: 20px 0; color: #666;">Great news! The item you requested is now back in stock and ready to ship.</p>
          
          <!-- CTA Button -->
          <div style="margin: 30px 0;">
            <a href="${productUrl}" style="background: #061735; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; transition: all 0.2s;">
              Shop Now →
            </a>
          </div>
          
          <p style="color: #999; font-size: 14px;">⏰ Limited stock - don't wait too long!</p>
        </div>

        <!-- Footer -->
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p style="margin: 0;">NERVE - Cool but Chic | Cairo, Egypt</p>
        </div>
      </div>
    </body>
    </html>
  `
}

function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    }
    return text.replace(/[&<>"']/g, (c) => map[c] || c)
}

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}
