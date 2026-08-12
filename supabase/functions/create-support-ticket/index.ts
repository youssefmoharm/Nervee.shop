// supabase/functions/create-support-ticket/index.ts
//
// Creates support tickets from chat escalations
// Handles ticket creation, validation, and notification

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { validateEmail, validateRequestSize, ValidationError } from '../_shared/validation.ts'
import { PerformanceTimer, logEvent } from '../_shared/monitoring.ts'
import { sendEmail } from '../_shared/email.ts'

interface TicketRequest {
    conversationId: string
    email: string
    customerName?: string
    subject: string
    description: string
    priority?: 'urgent' | 'normal' | 'low'
}

serve(async (req) => {
    const timer = new PerformanceTimer('create-support-ticket')

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
        timer.end()
        return json({ error: 'Method not allowed' }, 405)
    }

    try {
        // Validate request size
        const sizeErrors = validateRequestSize(req, 50)
        if (sizeErrors.length > 0) {
            timer.end()
            return json({ error: 'Request too large' }, 413)
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        const body = (await req.json()) as TicketRequest

        // Validate required fields
        const errors: ValidationError[] = []

        if (!body.conversationId) {
            errors.push({ field: 'conversationId', message: 'Conversation ID is required' })
        }

        const emailErrors = validateEmail(body.email)
        errors.push(...emailErrors)

        if (!body.subject || body.subject.length < 5) {
            errors.push({ field: 'subject', message: 'Subject must be at least 5 characters' })
        }

        if (!body.description || body.description.length < 20) {
            errors.push({ field: 'description', message: 'Description must be at least 20 characters' })
        }

        if (errors.length > 0) {
            timer.end()
            return json({ error: 'Validation failed', details: errors }, 400)
        }

        // Create ticket via RPC (generates ticket number)
        const { data: ticketId, error: ticketError } = await supabase.rpc('create_ticket_from_chat', {
            p_conversation_id: body.conversationId,
            p_subject: body.subject,
            p_description: body.description,
            p_priority: body.priority || 'normal',
        })

        if (ticketError || !ticketId) {
            console.error('Failed to create ticket:', ticketError)
            timer.end()
            return json({ error: 'Failed to create ticket' }, 500)
        }

        // Get ticket details
        const { data: ticket } = await supabase
            .from('support_tickets')
            .select('*')
            .eq('id', ticketId)
            .single()

        if (!ticket) {
            timer.end()
            return json({ error: 'Ticket created but not found' }, 500)
        }

        // Send confirmation email to customer
        const confirmationEmail = generateConfirmationEmail(ticket.ticket_number, body.subject)
        await sendEmail(body.email, `Support Ticket Created: #${ticket.ticket_number}`, confirmationEmail)

        logEvent({
            type: 'info',
            category: 'SUPPORT_TICKET',
            message: `Ticket created from chat escalation`,
            data: {
                ticket_id: ticketId,
                ticket_number: ticket.ticket_number,
                priority: body.priority,
                email: body.email,
            },
        })

        timer.end()

        return json({
            success: true,
            ticketId: ticketId,
            ticketNumber: ticket.ticket_number,
            message: `Support ticket #${ticket.ticket_number} created successfully`,
        })
    } catch (err) {
        console.error('Create ticket error:', err)
        timer.end()
        return json({ error: 'Failed to create ticket', details: (err as Error).message }, 500)
    }
})

function generateConfirmationEmail(ticketNumber: string, subject: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Support Ticket Confirmation</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #061735 0%, #1a365d 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Support Ticket Created ✅</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">We're here to help!</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px;">
          <p style="font-size: 18px; margin-bottom: 20px;">Thank you for reaching out!</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: #666;"><strong>Ticket Number:</strong></p>
            <p style="margin: 5px 0 20px 0; font-size: 24px; font-weight: bold; color: #061735;">#${ticketNumber}</p>
            
            <p style="margin: 0; color: #666;"><strong>Subject:</strong></p>
            <p style="margin: 5px 0; font-size: 16px;">${escapeHtml(subject)}</p>
          </div>

          <p style="color: #666; margin-bottom: 20px;">
            Our support team will review your ticket and respond within 24 hours. You can track your ticket status anytime by visiting your account.
          </p>

          <div style="background: #e8f4f8; padding: 15px; border-left: 4px solid #061735; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 14px; color: #333;">
              <strong>💡 What's next?</strong><br>
              Keep this ticket number handy. We'll use it to reference your issue in all correspondence.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${Deno.env.get('STORE_URL') || 'https://nerve-store.com'}/account" style="background: #061735; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              View Ticket Status
            </a>
          </div>

          <p style="font-size: 14px; color: #999; text-align: center; margin-top: 30px;">
            Thank you for choosing NERVE!
          </p>
        </div>

        <!-- Footer -->
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
