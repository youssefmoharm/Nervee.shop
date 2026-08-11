// supabase/functions/contact/index.ts
//
// Secure contact form endpoint with comprehensive validation and rate limiting
// Handles contact messages and newsletter subscriptions with abuse protection

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { rateLimit, getRateLimitHeaders } from '../_shared/ratelimit.ts'
import { 
  validateContactForm, 
  validateEmail, 
  validateRequestSize,
  sanitizeText,
  ValidationException 
} from '../_shared/validation.ts'
import { 
  logRateLimitHit,
  PerformanceTimer 
} from '../_shared/monitoring.ts'

serve(async (req) => {
  const timer = new PerformanceTimer('contact-form')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Request size validation
    const sizeErrors = validateRequestSize(req, 10) // 10KB max for contact forms
    if (sizeErrors.length > 0) {
      timer.end()
      return json({ error: 'Request too large', details: sizeErrors }, 413)
    }

    // Aggressive rate limiting for contact forms to prevent spam
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'anonymous'
    const allowed = rateLimit(ip, { windowMs: 60000, maxRequests: 2 }) // 2 per minute
    
    if (!allowed) {
      logRateLimitHit(ip, 'contact-form')
      const rateLimitHeaders = getRateLimitHeaders(ip, { windowMs: 60000, maxRequests: 2 })
      timer.end()
      return new Response(
        JSON.stringify({ error: 'Too many contact requests. Please wait before sending another message.' }),
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
    const action = body.action || 'contact' // 'contact' or 'newsletter'

    if (action === 'newsletter') {
      return await handleNewsletter(supabase, body, timer)
    } else {
      return await handleContact(supabase, body, timer)
    }
  } catch (err) {
    console.error('Contact form error:', err)
    timer.end()
    return json({ error: 'Something went wrong processing your request.' }, 500)
  }
})

async function handleContact(supabase: any, body: any, timer: PerformanceTimer) {
  // Validate contact form data
  const validationErrors = validateContactForm(body)
  if (validationErrors.length > 0) {
    timer.end()
    return json({ error: 'Validation failed', details: validationErrors }, 400)
  }

  // Sanitize inputs
  const sanitizedData = {
    name: sanitizeText(body.name, 100),
    email: body.email.trim().toLowerCase(),
    subject: sanitizeText(body.subject, 200),
    message: sanitizeText(body.message, 2000),
  }

  // Insert contact message
  const { error } = await supabase
    .from('contact_messages')
    .insert({
      name: sanitizedData.name,
      email: sanitizedData.email,
      subject: sanitizedData.subject,
      message: sanitizedData.message,
      status: 'new',
    })

  if (error) {
    console.error('Failed to save contact message:', error)
    timer.end()
    return json({ error: 'Failed to send message. Please try again.' }, 500)
  }

  timer.end()
  return json({ 
    success: true, 
    message: 'Thank you for your message. We\'ll get back to you soon!' 
  })
}

async function handleNewsletter(supabase: any, body: any, timer: PerformanceTimer) {
  // Validate email
  const emailErrors = validateEmail(body.email)
  if (emailErrors.length > 0) {
    timer.end()
    return json({ error: 'Invalid email address', details: emailErrors }, 400)
  }

  const email = body.email.trim().toLowerCase()

  // Check if already subscribed
  const { data: existing } = await supabase
    .from('newsletter_subscribers')
    .select('id, is_active')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    if (existing.is_active) {
      timer.end()
      return json({ 
        success: true, 
        message: 'You\'re already subscribed to our newsletter!' 
      })
    } else {
      // Reactivate subscription
      await supabase
        .from('newsletter_subscribers')
        .update({ is_active: true })
        .eq('id', existing.id)
      
      timer.end()
      return json({ 
        success: true, 
        message: 'Welcome back! Your newsletter subscription has been reactivated.' 
      })
    }
  }

  // Insert new subscription
  const { error } = await supabase
    .from('newsletter_subscribers')
    .insert({
      email,
      is_active: true,
    })

  if (error) {
    console.error('Failed to save newsletter subscription:', error)
    timer.end()
    return json({ error: 'Failed to subscribe. Please try again.' }, 500)
  }

  timer.end()
  return json({ 
    success: true, 
    message: 'Thank you for subscribing to our newsletter!' 
  })
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}