// supabase/functions/auth-sign-up/index.ts
//
// Rate-limited registration endpoint
// Prevents abuse by limiting registration attempts per IP
//
// Deploy: supabase functions deploy auth-sign-up

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logSecurityEvent } from '../_shared/secure-logging.ts'
import { distributedRateLimit, getRateLimitHeaders } from '../_shared/ratelimit.ts'
import { validateEmail, validatePassword, validateName } from '../_shared/validation.ts'

interface AuthSignUpBody {
  email: string
  password: string
  firstName: string
  lastName: string
  meta?: Record<string, unknown>
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Rate limiting: 3 attempts per 15 minutes per IP
    const identifier = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'anonymous'
    const rateLimitResult = await distributedRateLimit(
      supabase,
      `auth-sign-up:${identifier}`,
      { windowMs: 15 * 60 * 1000, maxRequests: 3 }
    )

    if (!rateLimitResult.allowed) {
      logSecurityEvent('auth_rate_limit_exceeded', { ip: identifier })
      const rateLimitHeaders = getRateLimitHeaders(rateLimitResult)
      return new Response(
        JSON.stringify({ error: 'Too many registration attempts. Please try again later.' }),
        {
          status: 429,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const body: AuthSignUpBody = await req.json()

    // Validate email
    const emailValidation = validateEmail(body.email)
    if (!emailValidation.valid) {
      return json({ error: emailValidation.error }, 400, corsHeaders)
    }
    const sanitizedEmail = emailValidation.value

    // Validate password with strong requirements
    const passwordValidation = validatePassword(body.password)
    if (!passwordValidation.valid) {
      return json({ error: passwordValidation.error }, 400, corsHeaders)
    }

    // Validate names
    const firstNameValidation = validateName(body.firstName, 'First name')
    if (!firstNameValidation.valid) {
      return json({ error: firstNameValidation.error }, 400, corsHeaders)
    }

    const lastNameValidation = validateName(body.lastName, 'Last name')
    if (!lastNameValidation.valid) {
      return json({ error: lastNameValidation.error }, 400, corsHeaders)
    }

    // Attempt sign up
    const { error } = await supabase.auth.signUp({
      email: sanitizedEmail,
      password: body.password,
      options: {
        data: {
          first_name: firstNameValidation.value,
          last_name: lastNameValidation.value,
          ...body.meta,
        },
      },
    })

    if (error) {
      // Don't reveal whether email exists - prevent email enumeration
      logSecurityEvent('auth_sign_up_failed', { email: sanitizedEmail, ip: identifier, error: error.message })
      return json(
        { error: 'Registration failed. Please try again.' },
        400,
        corsHeaders
      )
    }

    logSecurityEvent('auth_sign_up_success', { email: sanitizedEmail, ip: identifier })

    return json(
      {
        success: true,
        message: 'Registration successful. Please check your email to confirm your account.',
      },
      200,
      corsHeaders
    )
  } catch (err) {
    console.error('auth-sign-up error:', err)
    logSecurityEvent('auth_sign_up_error', { error: (err as Error).message })
    return json(
      { error: 'An error occurred during registration. Please try again.' },
      500,
      getCorsHeaders(req)
    )
  }
})

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}
