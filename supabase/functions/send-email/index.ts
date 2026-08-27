// supabase/functions/send-email/index.ts
//
// Internal transactional email sender (Resend). This endpoint is NOT a public
// mailer — it is only callable by (a) other edge functions presenting the
// service_role key, or (b) an authenticated admin user. Anonymous callers are
// rejected. Payload is strictly validated and the sender address is never
// client-controlled.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { getCorsHeaders } from '../_shared/cors.ts'
import { rateLimit, getRateLimitHeaders } from '../_shared/ratelimit.ts'
import { validateEmail, validateRequestSize } from '../_shared/validation.ts'
import { requireAdmin } from '../_shared/admin.ts'
import { logEmailSuccess, PerformanceTimer } from '../_shared/monitoring.ts'
import { sendEmail } from '../_shared/email.ts'

const ALLOWED_TYPES = new Set([
  'transactional',
  'order_confirmation',
  'order_shipped',
  'order_delivered',
  'support_ticket',
  'back_in_stock',
  'cart_abandonment',
  'newsletter',
  'contact_reply',
])

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const timer = new PerformanceTimer('send-email')

  try {
    const sizeErrors = validateRequestSize(req, 50)
    if (sizeErrors.length > 0) {
      timer.end()
      return json({ error: 'Request too large', details: sizeErrors }, 413, corsHeaders)
    }

    // ---- Authorization: service_role (edge-to-edge) OR admin JWT ----
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()

    if (!token) {
      timer.end()
      return json({ error: 'Unauthorized' }, 401, corsHeaders)
    }

    const isServiceRole = token === serviceRoleKey
    let isAuthorized = isServiceRole

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    if (!isServiceRole) {
      const admin = await requireAdmin(req, supabase)
      isAuthorized = !!admin
    }

    if (!isAuthorized) {
      timer.end()
      return json({ error: 'Forbidden — admin or service_role required' }, 403, corsHeaders)
    }

    // ---- Rate limiting (stricter for admin, generous for service_role) ----
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'anonymous'
    // Use per-token rate limit for service_role to avoid IP-spoof bypass; fall back to IP for admin.
    const rateId = isServiceRole ? `service:${token.slice(-8)}` : `ip:${ip}`
    const maxEmails = isServiceRole ? 200 : 20
    const allowed = rateLimit(rateId, { windowMs: 60000, maxRequests: maxEmails })
    if (!allowed) {
      const rateLimitHeaders = getRateLimitHeaders(rateId, { windowMs: 60000, maxRequests: maxEmails })
      timer.end()
      return new Response(
        JSON.stringify({ error: 'Too many email requests. Please wait before sending more.' }),
        { status: 429, headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = await req.json()

    // ---- Strict payload validation ----
    const emailErrors = validateEmail(body.to)
    if (emailErrors.length > 0) {
      timer.end()
      return json({ error: 'Invalid recipient email', details: emailErrors }, 400, corsHeaders)
    }

    if (!body.subject || typeof body.subject !== 'string' || body.subject.trim().length === 0) {
      timer.end()
      return json({ error: 'Subject is required' }, 400, corsHeaders)
    }
    if (body.subject.length > 200) {
      timer.end()
      return json({ error: 'Subject too long (max 200 characters)' }, 400, corsHeaders)
    }
    if (!body.html || typeof body.html !== 'string' || body.html.trim().length === 0) {
      timer.end()
      return json({ error: 'HTML content is required' }, 400, corsHeaders)
    }
    if (body.html.length > 100_000) {
      timer.end()
      return json({ error: 'Email body too large (max 100KB)' }, 400, corsHeaders)
    }

    const emailType = body.type || 'transactional'
    if (!ALLOWED_TYPES.has(emailType)) {
      timer.end()
      return json({ error: `Invalid email type. Allowed: ${[...ALLOWED_TYPES].join(', ')}` }, 400, corsHeaders)
    }

    // Never allow client to override sender — server decides.
    // Unsubscribe handling is per-type, server-controlled.
    const unsubscribeToken = await supabase.rpc('create_unsubscribe_token', {
      p_email: body.to,
      p_email_type: emailType === 'transactional' || emailType === 'order_confirmation' ? null : emailType,
    })

    const storeUrl = Deno.env.get('STORE_URL') || 'https://nerve-store.com'
    const unsubscribeLink = unsubscribeToken.data
      ? `${storeUrl}/unsubscribe?token=${unsubscribeToken.data}`
      : null

    let emailHtml = body.html
    if (unsubscribeLink && emailType !== 'transactional' && emailType !== 'order_confirmation') {
      const unsubscribeFooter = `
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #999;">
          <p style="margin: 5px 0;">
            <a href="${unsubscribeLink}" style="color: #999; text-decoration: underline;">Unsubscribe from this email type</a>
          </p>
          <p style="margin: 5px 0;">NERVE - Cool but Chic</p>
        </div>
      `
      emailHtml = emailHtml.includes('</body>')
        ? emailHtml.replace('</body>', `${unsubscribeFooter}</body>`)
        : emailHtml + unsubscribeFooter
    }

    await sendEmail(body.to, body.subject.slice(0, 200), emailHtml)

    const { error: logError } = await supabase.rpc('log_email_send', {
      p_recipient_email: body.to,
      p_email_type: emailType,
      p_subject: body.subject.slice(0, 200),
      p_metadata: body.metadata || null,
    })
    if (logError) console.error('Failed to log email:', logError)

    logEmailSuccess(body.to, body.subject)
    timer.end()

    return json({ success: true, message: 'Email sent successfully', to: body.to, type: emailType }, 200, corsHeaders)
  } catch (err) {
    console.error('Email sending error:', err)
    timer.end()
    return json({ error: 'Failed to send email', details: (err as Error).message }, 500, getCorsHeaders(req))
  }
})

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  const cors = headers
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
