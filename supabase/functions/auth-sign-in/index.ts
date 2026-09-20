// supabase/functions/auth-sign-in/index.ts
//
// Rate-limited authentication endpoint for login attempts
// Prevents brute force attacks by limiting requests per IP
//
// Deploy: supabase functions deploy auth-sign-in

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logSecurityEvent } from '../_shared/secure-logging.ts'
import { distributedRateLimit, getRateLimitHeaders } from '../_shared/ratelimit.ts'

interface AuthSignInBody {
  email: string
  password: string
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

    // Rate limiting: 5 attempts per 15 minutes per IP
    const identifier = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'anonymous'
    const rateLimitResult = await distributedRateLimit(
      supabase,
      `auth-sign-in:${identifier}`,
      { windowMs: 15 * 60 * 1000, maxRequests: 5 }
    )

    if (!rateLimitResult.allowed) {
      logSecurityEvent('auth_rate_limit_exceeded', { ip: identifier })
      const rateLimitHeaders = getRateLimitHeaders(rateLimitResult)
      return new Response(
        JSON.stringify({ error: 'Too many login attempts. Please try again later.' }),
        {
          status: 429,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const body: AuthSignInBody = await req.json()

    // Validate input
    if (!body.email || typeof body.email !== 'string') {
      return json({ error: 'Email is required' }, 400, corsHeaders)
    }

    if (!body.password || typeof body.password !== 'string') {
      return json({ error: 'Password is required' }, 400, corsHeaders)
    }

    // Sanitize email
    const sanitizedEmail = body.email.trim().toLowerCase()

    // Attempt sign in
    const { error } = await supabase.auth.signInWithPassword({
      email: sanitizedEmail,
      password: body.password,
    })

    if (error) {
      // Don't reveal whether email exists - prevent email enumeration
      logSecurityEvent('auth_sign_in_failed', { email: sanitizedEmail, ip: identifier })
      return json({ error: 'Invalid email or password' }, 401, corsHeaders)
    }

    // Success - get user session
    const { data: { session } } = await supabase.auth.getSession()

    logSecurityEvent('auth_sign_in_success', { email: sanitizedEmail, ip: identifier })

    return json(
      {
        success: true,
        message: 'Signed in successfully',
        user: session?.user
          ? { id: session.user.id, email: session.user.email }
          : null,
      },
      200,
      corsHeaders
    )
  } catch (err) {
    console.error('auth-sign-in error:', err)
    logSecurityEvent('auth_sign_in_error', { error: (err as Error).message })
    return json(
      { error: 'An error occurred during sign in. Please try again.' },
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
