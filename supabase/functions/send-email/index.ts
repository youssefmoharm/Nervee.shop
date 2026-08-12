// supabase/functions/send-email/index.ts
//
// Email sending service
// Handles sending various types of emails via Resend API
// Logs all email sends for analytics and debugging

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { rateLimit, getRateLimitHeaders } from '../_shared/ratelimit.ts'
import {
    validateEmail,
    validateRequestSize,
    ValidationException
} from '../_shared/validation.ts'
import {
    logEmailFailure,
    logEmailSuccess,
    PerformanceTimer
} from '../_shared/monitoring.ts'
import { sendEmail } from '../_shared/email.ts'

serve(async (req) => {
    const timer = new PerformanceTimer('send-email')

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Request size validation
        const sizeErrors = validateRequestSize(req, 50) // 50KB max
        if (sizeErrors.length > 0) {
            timer.end()
            return json({ error: 'Request too large', details: sizeErrors }, 413)
        }

        const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'anonymous'

        // Rate limiting: 50 emails per minute per IP
        const allowed = rateLimit(ip, { windowMs: 60000, maxRequests: 50 })
        if (!allowed) {
            const rateLimitHeaders = getRateLimitHeaders(ip, { windowMs: 60000, maxRequests: 50 })
            timer.end()
            return new Response(
                JSON.stringify({ error: 'Too many email requests. Please wait before sending more.' }),
                {
                    status: 429,
                    headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        const body = await req.json()

        // Validate required fields
        const emailErrors = validateEmail(body.to)
        if (emailErrors.length > 0) {
            timer.end()
            return json({ error: 'Invalid email', details: emailErrors }, 400)
        }

        if (!body.subject || typeof body.subject !== 'string') {
            timer.end()
            return json({ error: 'Subject is required' }, 400)
        }

        if (!body.html || typeof body.html !== 'string') {
            timer.end()
            return json({ error: 'HTML content is required' }, 400)
        }

        const emailType = body.type || 'transactional'

        // Create unsubscribe token and link
        const unsubscribeToken = await supabase.rpc('create_unsubscribe_token', {
            p_email: body.to,
            p_email_type: emailType === 'transactional' ? null : emailType,
        })

        const storeUrl = Deno.env.get('STORE_URL') || 'https://nerve-store.com'
        const unsubscribeLink = unsubscribeToken.data
            ? `${storeUrl}/unsubscribe?token=${unsubscribeToken.data}`
            : null

        // Add unsubscribe link to email if not transactional
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
            emailHtml = emailHtml.replace('</body>', `${unsubscribeFooter}</body>`)
        }

        // Send the email via Resend
        await sendEmail(body.to, body.subject, emailHtml)

        // Log the email send to database
        const { error: logError } = await supabase.rpc('log_email_send', {
            p_recipient_email: body.to,
            p_email_type: emailType,
            p_subject: body.subject,
            p_metadata: body.metadata || null,
        })

        if (logError) {
            console.error('Failed to log email:', logError)
            // Don't fail the request - the email was sent even if logging failed
        }

        logEmailSuccess(body.to, body.subject)
        timer.end()

        return json({
            success: true,
            message: 'Email sent successfully',
            to: body.to,
            type: emailType,
        })
    } catch (err) {
        console.error('Email sending error:', err)
        timer.end()
        return json({ error: 'Failed to send email', details: (err as Error).message }, 500)
    }
})

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}
