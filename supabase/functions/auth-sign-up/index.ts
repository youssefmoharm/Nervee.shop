// supabase/functions/auth-sign-up/index.ts
//
// Rate-limited registration endpoint
// Prevents abuse by limiting registration attempts per IP
//
// Deploy: supabase functions deploy auth-sign-up

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getCorsHeaders } from '../_shared/cors.ts';
import { logSecurityEvent } from '../_shared/secure-logging.ts';
import { clientIp, distributedRateLimit, getRateLimitHeaders } from '../_shared/ratelimit.ts';
import { validateEmail, validatePassword, validateName } from '../_shared/validation.ts';

interface AuthSignUpBody {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  meta?: Record<string, unknown>;
}

serve(async req => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Rate limiting: 3 attempts per 15 minutes per IP
    // Pre-auth, so bucket by client IP only (no user JWT exists yet).
    const identifier = clientIp(req);
    const rateLimitResult = await distributedRateLimit(supabase, `auth-sign-up:${identifier}`, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 3,
    });

    if (!rateLimitResult.allowed) {
      logSecurityEvent('auth_rate_limit_exceeded', { ip: identifier });
      const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
      return new Response(
        JSON.stringify({ error: 'Too many registration attempts. Please try again later.' }),
        {
          status: 429,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const body: AuthSignUpBody = await req.json();

    // Validate email
    const emailErrors = validateEmail(body.email);
    if (emailErrors.length > 0) {
      return json({ error: emailErrors[0].message, details: emailErrors }, 400, corsHeaders);
    }
    const sanitizedEmail = body.email.trim().toLowerCase();

    // Validate password with strong requirements
    const passwordErrors = validatePassword(body.password);
    if (passwordErrors.length > 0) {
      return json({ error: passwordErrors[0].message, details: passwordErrors }, 400, corsHeaders);
    }

    // Validate names
    const firstNameErrors = validateName(body.firstName, 'First name');
    if (firstNameErrors.length > 0) {
      return json(
        { error: firstNameErrors[0].message, details: firstNameErrors },
        400,
        corsHeaders,
      );
    }

    const lastNameErrors = validateName(body.lastName, 'Last name');
    if (lastNameErrors.length > 0) {
      return json({ error: lastNameErrors[0].message, details: lastNameErrors }, 400, corsHeaders);
    }

    // Attempt sign up
    const { error } = await supabase.auth.signUp({
      email: sanitizedEmail,
      password: body.password,
      options: {
        data: {
          first_name: body.firstName.trim(),
          last_name: body.lastName.trim(),
          ...body.meta,
        },
      },
    });

    if (error) {
      // Don't reveal whether email exists - prevent email enumeration
      logSecurityEvent('auth_sign_up_failed', {
        email: sanitizedEmail,
        ip: identifier,
        error: error.message,
      });
      return json({ error: 'Registration failed. Please try again.' }, 400, corsHeaders);
    }

    logSecurityEvent('auth_sign_up_success', { email: sanitizedEmail, ip: identifier });

    return json(
      {
        success: true,
        message: 'Registration successful. Please check your email to confirm your account.',
      },
      200,
      corsHeaders,
    );
  } catch (err) {
    console.error('auth-sign-up error:', err);
    logSecurityEvent('auth_sign_up_error', { error: (err as Error).message });
    return json(
      { error: 'An error occurred during registration. Please try again.' },
      500,
      getCorsHeaders(req),
    );
  }
});

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
