// supabase/functions/create-support-ticket/index.ts
//
// Creates support tickets from chat escalations with ownership validation.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { getCorsHeaders } from '../_shared/cors.ts'
import { validateEmail, validateRequestSize } from '../_shared/validation.ts'
import type { ValidationError } from '../_shared/validation.ts'
import { PerformanceTimer, logEvent } from '../_shared/monitoring.ts'
import { sendEmail } from '../_shared/email.ts'

interface TicketRequest {
  conversationId: string
  email: string
  customerName?: string
  subject: string
  description: string
  priority?: string
}

const ALLOWED_PRIORITIES = new Set(['urgent', 'normal', 'low'])
const ticketRateCounts = new Map<string, { count: number; resetAt: number }>()
function ticketRateLimit(id: string): boolean {
  const now = Date.now()
  const e = ticketRateCounts.get(id)
  if (!e || now > e.resetAt) {
    ticketRateCounts.set(id, { count: 1, resetAt: now + 60000 })
    return true
  }
  if (e.count >= 5) return false
  e.count++
  return true
}

function sanitize(text: string, max: number): string {
  return text.trim().slice(0, max).replace(/[<>]/g, '')
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, corsHeaders)
  }

  const timer = new PerformanceTimer('create-support-ticket')

  try {
    const sizeErrors = validateRequestSize(req, 50)
    if (sizeErrors.length > 0) {
      timer.end()
      return json({ error: 'Request too large' }, 413, corsHeaders)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const body = (await req.json()) as TicketRequest

    const errors: ValidationError[] = []

    if (!body.conversationId || !/^[0-9a-f-]{36}$/i.test(body.conversationId)) {
      errors.push({ field: 'conversationId', message: 'Valid conversation ID is required' })
    }

    const emailErrors = validateEmail(body.email)
    errors.push(...emailErrors)

    const subj = typeof body.subject === 'string' ? body.subject.trim() : ''
    if (subj.length < 5) errors.push({ field: 'subject', message: 'Subject must be at least 5 characters' })
    if (subj.length > 200) errors.push({ field: 'subject', message: 'Subject too long (max 200)' })

    const desc = typeof body.description === 'string' ? body.description.trim() : ''
    if (desc.length < 20) errors.push({ field: 'description', message: 'Description must be at least 20 characters' })
    if (desc.length > 5000) errors.push({ field: 'description', message: 'Description too long (max 5000)' })

    const priority = body.priority || 'normal'
    if (!ALLOWED_PRIORITIES.has(priority)) {
      errors.push({ field: 'priority', message: `Priority must be one of: ${[...ALLOWED_PRIORITIES].join(', ')}` })
    }

    if (errors.length > 0) {
      timer.end()
      return json({ error: 'Validation failed', details: errors }, 400, corsHeaders)
    }

    // ---- Rate limiting (per conversation + per email) ----
    const rateKey = `ticket:${body.conversationId}:${body.email.toLowerCase()}`
    if (!ticketRateLimit(rateKey)) {
      timer.end()
      return json({ error: 'Too many ticket requests. Please wait a minute.' }, 429, corsHeaders)
    }

    // ---- Auth: resolve caller identity from JWT if present ----
    let authUserId: string | null = null
    let authEmail: string | null = null
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (token && !token.startsWith('sb_publishable_') && !token.startsWith('sb_secret_')) {
      try {
        const { data: userData } = await supabase.auth.getUser(token)
        if (userData?.user) {
          authUserId = userData.user.id
          authEmail = userData.user.email?.toLowerCase() ?? null
        }
      } catch {
        // treat as guest
      }
    }

    // ---- Conversation ownership validation ----
    const { data: conv, error: convError } = await supabase
      .from('chat_conversations')
      .select('id, user_id, email')
      .eq('id', body.conversationId)
      .maybeSingle()

    if (convError || !conv) {
      timer.end()
      return json({ error: 'Conversation not found' }, 404, corsHeaders)
    }

    if (conv.user_id) {
      // Authenticated conversation — caller must be that user
      if (!authUserId || conv.user_id !== authUserId) {
        timer.end()
        return json({ error: 'Forbidden — conversation belongs to another user' }, 403, corsHeaders)
      }
      // Email must match authenticated email
      if (authEmail && body.email.toLowerCase() !== authEmail) {
        timer.end()
        return json({ error: 'Email does not match authenticated user' }, 403, corsHeaders)
      }
    } else {
      // Guest conversation — email must match conversation email
      if (conv.email.toLowerCase() !== body.email.toLowerCase()) {
        timer.end()
        return json({ error: 'Email does not match conversation' }, 403, corsHeaders)
      }
    }

    // Rate limit: one ticket per conversation (prevent spam)
    const { data: existingTicket } = await supabase
      .from('support_tickets')
      .select('id')
      .eq('conversation_id', body.conversationId)
      .maybeSingle()
    if (existingTicket) {
      timer.end()
      return json({ error: 'A ticket already exists for this conversation' }, 409, corsHeaders)
    }

    const cleanSubject = sanitize(subj, 200)
    const cleanDesc = sanitize(desc, 5000)

    const { data: ticketId, error: ticketError } = await supabase.rpc('create_ticket_from_chat', {
      p_conversation_id: body.conversationId,
      p_subject: cleanSubject,
      p_description: cleanDesc,
      p_priority: priority,
    })

    if (ticketError || !ticketId) {
      console.error('Failed to create ticket:', ticketError)
      timer.end()
      return json({ error: 'Failed to create ticket' }, 500, corsHeaders)
    }

    const { data: ticket } = await supabase.from('support_tickets').select('*').eq('id', ticketId).single()

    if (!ticket) {
      timer.end()
      return json({ error: 'Ticket created but not found' }, 500, corsHeaders)
    }

    const confirmationEmail = generateConfirmationEmail(ticket.ticket_number, cleanSubject)
    await sendEmail(body.email.toLowerCase(), `Support Ticket Created: #${ticket.ticket_number}`, confirmationEmail)

    logEvent({
      type: 'info',
      category: 'SUPPORT_TICKET',
      message: 'Ticket created from chat escalation',
      data: { ticket_id: ticketId, ticket_number: ticket.ticket_number, priority, email: body.email },
    })

    timer.end()
    return json(
      {
        success: true,
        ticketId: ticketId,
        ticketNumber: ticket.ticket_number,
        message: `Support ticket #${ticket.ticket_number} created successfully`,
      },
      200,
      corsHeaders,
    )
  } catch (err) {
    console.error('Create ticket error:', err)
    timer.end()
    return json({ error: 'Failed to create ticket', details: (err as Error).message }, 500, getCorsHeaders(req))
  }
})

function generateConfirmationEmail(ticketNumber: string, subject: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Support Ticket Confirmation</title></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #061735 0%, #1a365d 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Support Ticket Created ✅</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">We're here to help!</p>
        </div>
        <div style="padding: 30px;">
          <p style="font-size: 18px; margin-bottom: 20px;">Thank you for reaching out!</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: #666;"><strong>Ticket Number:</strong></p>
            <p style="margin: 5px 0 20px 0; font-size: 24px; font-weight: bold; color: #061735;">#${escapeHtml(ticketNumber)}</p>
            <p style="margin: 0; color: #666;"><strong>Subject:</strong></p>
            <p style="margin: 5px 0; font-size: 16px;">${escapeHtml(subject)}</p>
          </div>
          <p style="color: #666; margin-bottom: 20px;">Our support team will review your ticket and respond within 24 hours.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${Deno.env.get('STORE_URL') || 'https://nerve-store.com'}/account" style="background: #061735; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">View Ticket Status</a>
          </div>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p style="margin: 0;">NERVE - Cool but Chic</p>
          <p style="margin: 5px 0 0 0;">support@nerve-store.com</p>
        </div>
      </div>
    </body>
    </html>
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
