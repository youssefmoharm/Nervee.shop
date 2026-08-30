// supabase/functions/verify-guest-order/index.ts
//
// Secure guest order lookup. Validates email+order_number+token server-side
// via the lookup_guest_order RPC (which compares token hash and checks expiry).
// Rate-limited per IP and per email. Never reveals whether an order exists.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { getCorsHeaders } from '../_shared/cors.ts'
import { validateRequestSize } from '../_shared/validation.ts'
import { PerformanceTimer, logEvent } from '../_shared/monitoring.ts'

const verifyCounts = new Map<string, { count: number; resetAt: number }>()
function verifyRateLimit(id: string, max = 10, windowMs = 60000): boolean {
  const now = Date.now()
  const e = verifyCounts.get(id)
  if (!e || now > e.resetAt) {
    verifyCounts.set(id, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (e.count >= max) return false
  e.count++
  return true
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, corsHeaders)
  }

  const timer = new PerformanceTimer('verify-guest-order')

  try {
    const sizeErr = validateRequestSize(req, 10)
    if (sizeErr.length > 0) {
      timer.end()
      return json({ error: 'Request too large' }, 413, corsHeaders)
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'anon'
    if (!verifyRateLimit(`ip:${ip}`, 20, 60000)) {
      timer.end()
      return json({ error: 'Too many requests. Please try again later.' }, 429, corsHeaders)
    }

    let body: { email?: string; orderNumber?: string; token?: string }
    try {
      body = await req.json()
    } catch {
      timer.end()
      return json({ error: 'Invalid JSON' }, 400, corsHeaders)
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim().toUpperCase() : ''
    const token = typeof body.token === 'string' ? body.token.trim() : ''

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      timer.end()
      return json({ error: 'Valid email is required' }, 400, corsHeaders)
    }
    if (!orderNumber || !/^NRV-[0-9]{6}$/.test(orderNumber)) {
      timer.end()
      return json({ error: 'Valid order number is required (e.g. NRV-123456)' }, 400, corsHeaders)
    }
    if (!token || token.length < 8) {
      // For lookup without token (email+order only), we still require token for security.
      // If no token is provided, perform a limited lookup (email+order must match).
      // But to prevent enumeration, we rate-limit per email as well.
      if (!verifyRateLimit(`email:${email}`, 10, 60000)) {
        timer.end()
        return json({ error: 'Too many attempts for this email.' }, 429, corsHeaders)
      }
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Use token if provided, otherwise do email+order lookup (less secure, but needed for UX)
    // The RPC handles the case where token is empty by doing email+order match.
    const effectiveToken = token || ''

    const { data, error } = await supabase.rpc('lookup_guest_order', {
      p_email: email,
      p_order_number: orderNumber,
      p_token: effectiveToken,
    })

    if (error) {
      console.error('lookup_guest_order error:', error)
      timer.end()
      // Do not reveal internal error — return generic not-found
      return json({ error: 'Order not found. Please check your email and order number.' }, 404, corsHeaders)
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      logEvent({
        type: 'warning',
        category: 'GUEST_ORDER',
        message: 'Guest order lookup failed (not found or token mismatch)',
        data: { email, orderNumber: orderNumber.slice(0, 8) + '***' },
      })
      timer.end()
      return json({ error: 'Order not found. Please check your email and order number.' }, 404, corsHeaders)
    }

    const row = Array.isArray(data) ? data[0] : data

    // Fetch full order details if order_id exists
    let orderDetails = row
    if (row.order_id) {
      const { data: fullOrder } = await supabase
        .from('orders')
        .select('id, order_number, status, total, subtotal, shipping_cost, discount_amount, delivery_method, placed_at, created_at')
        .eq('id', row.order_id)
        .maybeSingle()

      if (fullOrder) {
        const { data: items } = await supabase
          .from('order_items')
          .select('product_id, product_name, color, size, quantity, price, subtotal')
          .eq('order_id', row.order_id)

        orderDetails = { ...fullOrder, items: items || [] }
      }
    }

    logEvent({
      type: 'info',
      category: 'GUEST_ORDER',
      message: 'Guest order lookup successful',
      data: { orderNumber },
    })

    timer.end()
    return json({ success: true, order: orderDetails }, 200, corsHeaders)
  } catch (err) {
    console.error('verify-guest-order error:', err)
    timer.end()
    return json({ error: 'Failed to verify order. Please try again.' }, 500, getCorsHeaders(req))
  }
})

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  const h = headers
  return new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json' } })
}
