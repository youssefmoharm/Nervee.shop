// supabase/functions/request-return/index.ts
//
// Customer-facing return/cancellation request.
// Authenticated users: verified via JWT (auth.uid() must own order)
// Guest users: verified via email+orderNumber+token through lookup_guest_order (service_role)
// Single request per order+type enforced via UNIQUE(order_id, type) in DB.
// Only delivered orders within 14 days can be returned; placed/processing can be cancelled within 2h.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { getCorsHeaders } from '../_shared/cors.ts'
import { PerformanceTimer, logEvent } from '../_shared/monitoring.ts'

const VALID_TYPES = ['cancellation', 'return'] as const

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, corsHeaders)

  const timer = new PerformanceTimer('request-return')
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Auth: try JWT, fallback to guest token flow
    let customerId: string | null = null
    let guestVerified = false
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: userData } = await supabase.auth.getUser(token)
      if (userData?.user) customerId = userData.user.id
    }

    const body = await req.json()
    const { orderId, orderNumber, email, token, type, reason } = body as {
      orderId?: string
      orderNumber?: string
      email?: string
      token?: string
      type?: string
      reason?: string
    }

    if (!type || !VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
      timer.end()
      return json({ error: `type must be one of ${VALID_TYPES.join(', ')}` }, 400, corsHeaders)
    }
    if (!reason || reason.trim().length < 10 || reason.trim().length > 1000) {
      timer.end()
      return json({ error: 'Reason must be 10-1000 characters' }, 400, corsHeaders)
    }

    // Resolve orderId if only orderNumber+email+token provided (guest)
    let resolvedOrderId = orderId
    let resolvedEmail: string | null = null
    if (!resolvedOrderId && orderNumber && email) {
      const effectiveToken = (token || '').trim()
      const { data: lookup } = await supabase.rpc('lookup_guest_order', {
        p_email: email.trim().toLowerCase(),
        p_order_number: orderNumber.trim().toUpperCase(),
        p_token: effectiveToken,
      })
      const row = Array.isArray(lookup) ? lookup[0] : lookup
      if (!row?.order_id) {
        timer.end()
        return json({ error: 'Order not found or token invalid' }, 404, corsHeaders)
      }
      resolvedOrderId = row.order_id
      resolvedEmail = email.trim().toLowerCase()
      guestVerified = true
    }

    if (!resolvedOrderId) {
      timer.end()
      return json({ error: 'orderId or (orderNumber+email+token) required' }, 400, corsHeaders)
    }

    // Fetch order and verify ownership / eligibility
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_number, customer_id, email, status, created_at, placed_at')
      .eq('id', resolvedOrderId)
      .maybeSingle()

    if (orderErr || !order) {
      timer.end()
      return json({ error: 'Order not found' }, 404, corsHeaders)
    }

    // Ownership check
    if (customerId) {
      if (order.customer_id && order.customer_id !== customerId) {
        timer.end()
        return json({ error: 'Forbidden: not your order' }, 403, corsHeaders)
      }
      if (!order.customer_id && order.email && resolvedEmail) {
        // guest order accessed via authenticated session but emails differ
        // allow if guestVerified via token, otherwise check email matches JWT email
        const { data: user } = await supabase.auth.admin.getUserById(customerId)
        if (user?.user?.email?.toLowerCase() !== order.email?.toLowerCase() && !guestVerified) {
          timer.end()
          return json({ error: 'Forbidden: email mismatch' }, 403, corsHeaders)
        }
      }
    } else if (guestVerified) {
      // already verified via lookup
    } else {
      // Neither authenticated nor guest-verified
      timer.end()
      return json({ error: 'Authentication or guest token required' }, 401, corsHeaders)
    }

    // Eligibility: returns only for delivered within 14 days; cancellations within 2h of placed
    const placedAt = new Date(order.placed_at || order.created_at)
    const now = new Date()
    const hoursSincePlaced = (now.getTime() - placedAt.getTime()) / (1000 * 60 * 60)
    const daysSincePlaced = hoursSincePlaced / 24

    if (type === 'return') {
      if (order.status !== 'delivered') {
        timer.end()
        return json({ error: 'Only delivered orders can be returned' }, 400, corsHeaders)
      }
      if (daysSincePlaced > 14) {
        timer.end()
        return json({ error: 'Return window expired (14 days)' }, 400, corsHeaders)
      }
    } else if (type === 'cancellation') {
      if (!['placed', 'processing'].includes(order.status)) {
        timer.end()
        return json({ error: 'Only placed/processing orders can be cancelled' }, 400, corsHeaders)
      }
      if (hoursSincePlaced > 2) {
        timer.end()
        return json({ error: 'Cancellation window expired (2 hours)' }, 400, corsHeaders)
      }
    }

    // Insert request (dedup via UNIQUE)
    const { data: inserted, error: insertErr } = await supabase
      .from('order_return_requests')
      .insert({
        order_id: resolvedOrderId,
        customer_id: customerId,
        type,
        reason: reason.trim(),
        status: 'pending',
      })
      .select('id, order_id, type, status, requested_at')
      .single()

    if (insertErr) {
      if (insertErr.code === '23505') {
        timer.end()
        return json({ error: `A ${type} request already exists for this order` }, 409, corsHeaders)
      }
      console.error('request-return insert error', insertErr)
      timer.end()
      return json({ error: 'Failed to create request', details: insertErr.message }, 500, corsHeaders)
    }

    logEvent({
      type: 'info',
      category: 'RETURN_REQUEST',
      message: `${type} requested for order ${order.order_number}`,
      data: { orderId: resolvedOrderId, type, customerId: customerId || resolvedEmail },
    })

    timer.end()
    return json({ success: true, request: inserted }, 200, corsHeaders)
  } catch (err) {
    console.error('request-return error', err)
    return json({ error: 'Failed to process request', details: (err as Error).message }, 500, getCorsHeaders(req))
  }
})

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } })
}
