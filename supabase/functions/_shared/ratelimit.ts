/**
 * Production-ready distributed rate limiter for Edge Functions
 *
 * Uses Supabase database as a distributed store for rate limiting
 * across multiple Edge Function instances.
 */

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalRequests: number;
}

/**
 * Real client IP for rate limiting. X-Forwarded-For may be client-spoofed;
 * the LAST entry is appended by the closest trusted proxy, so take that one
 * (not the first, which the caller controls). Falls back to Cloudflare's
 * cf-connecting-ip, then x-real-ip, then a static bucket.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff && xff.trim()) {
    const parts = xff
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'anonymous';
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Build a spoof-resistant rate-limit identifier, in priority order:
 *   1. Authenticated user id (resolved from a real user JWT — never the
 *      anon/publishable key, which every browser sends and must not bucket
 *      all users together).
 *   2. A non-user bearer token (hashed — raw tokens are never used as keys).
 *   3. The client IP (last X-Forwarded-For hop).
 */
export async function rateLimitIdentifier(req: Request, supabase: any): Promise<string> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

  const isBogusClientKey =
    !token ||
    token === anonKey ||
    token.startsWith('sb_publishable_') ||
    token.startsWith('sb_secret_');

  if (!isBogusClientKey) {
    try {
      const { data } = await supabase.auth.getUser(token);
      if (data?.user?.id) return `user:${data.user.id}`;
    } catch {
      // Not a valid user JWT — fall through to a hashed token bucket.
    }
    return `tok:${(await sha256Hex(token)).slice(0, 32)}`;
  }

  return `ip:${clientIp(req)}`;
}

// Fallback in-memory store for when database is unavailable
const requestCounts = new Map<string, { count: number; resetAt: number }>();

/**
 * Distributed rate limiter using Supabase as storage
 * Falls back to in-memory if database is unavailable
 */
export async function distributedRateLimit(
  supabase: any,
  identifier: string,
  options: RateLimitOptions = { windowMs: 60000, maxRequests: 10 },
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - options.windowMs;
  const resetTime = now + options.windowMs;

  try {
    // Try distributed rate limiting first
    const result = await distributedRateLimitDB(supabase, identifier, options, now, windowStart);
    if (result) return result;
  } catch (error) {
    console.warn('Distributed rate limiter failed, falling back to in-memory:', error);
  }

  // Fallback to in-memory rate limiting
  return inMemoryRateLimit(identifier, options, now, resetTime);
}

async function distributedRateLimitDB(
  supabase: any,
  identifier: string,
  options: RateLimitOptions,
  now: number,
  windowStart: number,
): Promise<RateLimitResult | null> {
  // Use a stored procedure for atomic rate limiting
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_identifier: identifier,
    p_window_start: new Date(windowStart).toISOString(),
    p_max_requests: options.maxRequests,
    p_window_ms: options.windowMs,
  });

  if (error) {
    throw new Error(`Rate limit check failed: ${error.message}`);
  }

  // check_rate_limit() RETURNS TABLE → PostgREST (and supabase-js .rpc)
  // yields an ARRAY of rows, not a single object. Unwrap it or `data.allowed`
  // is undefined and every request looks denied/NaN.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.allowed !== 'boolean') {
    throw new Error('Rate limit check returned no row');
  }

  const currentCount = Number(row.current_count) || 0;
  return {
    allowed: row.allowed,
    remaining: Math.max(0, options.maxRequests - currentCount),
    resetTime: now + options.windowMs,
    totalRequests: currentCount,
  };
}

function inMemoryRateLimit(
  identifier: string,
  options: RateLimitOptions,
  now: number,
  resetTime: number,
): RateLimitResult {
  const entry = requestCounts.get(identifier);

  // No entry or window expired - allow and create new entry
  if (!entry || entry.resetAt < now) {
    requestCounts.set(identifier, {
      count: 1,
      resetAt: resetTime,
    });
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      resetTime,
      totalRequests: 1,
    };
  }

  // Within window - check count
  if (entry.count < options.maxRequests) {
    entry.count++;
    return {
      allowed: true,
      remaining: options.maxRequests - entry.count,
      resetTime: entry.resetAt,
      totalRequests: entry.count,
    };
  }

  // Rate limit exceeded
  return {
    allowed: false,
    remaining: 0,
    resetTime: entry.resetAt,
    totalRequests: entry.count,
  };
}

/**
 * Legacy in-memory rate limiter (kept for backward compatibility)
 */
export function rateLimit(
  identifier: string,
  options: RateLimitOptions = { windowMs: 60000, maxRequests: 10 },
): boolean {
  const now = Date.now();
  const entry = requestCounts.get(identifier);

  if (!entry || entry.resetAt < now) {
    requestCounts.set(identifier, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return true;
  }

  if (entry.count < options.maxRequests) {
    entry.count++;
    return true;
  }

  return false;
}

/**
 * Get rate limit headers for response — supports both signatures:
 *   getRateLimitHeaders(result)  or  getRateLimitHeaders(identifier, options)
 * Legacy two-arg calls (ip, options) kept for back-compat with existing functions.
 */
export function getRateLimitHeaders(
  resultOrIdentifier: RateLimitResult | string | { identifier: string; options: RateLimitOptions },
  maybeOptions?: RateLimitOptions,
): Record<string, string> {
  // Two-arg legacy: getRateLimitHeaders(ip, options)
  if (typeof resultOrIdentifier === 'string' && maybeOptions) {
    const identifier = resultOrIdentifier;
    const options = maybeOptions;
    const entry = requestCounts.get(identifier);
    if (!entry) {
      return {
        'X-RateLimit-Limit': options.maxRequests.toString(),
        'X-RateLimit-Remaining': options.maxRequests.toString(),
        'X-RateLimit-Reset': (Date.now() + options.windowMs).toString(),
      };
    }
    const remaining = Math.max(0, options.maxRequests - entry.count);
    return {
      'X-RateLimit-Limit': options.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': entry.resetAt.toString(),
    };
  }
  const result = resultOrIdentifier as
    | RateLimitResult
    | { identifier: string; options: RateLimitOptions };
  if ('allowed' in result) {
    // New format with RateLimitResult — guard against NaN leaking into headers.
    const limit = Number.isFinite(result.totalRequests + result.remaining)
      ? result.totalRequests + result.remaining
      : 0;
    const remaining = Number.isFinite(result.remaining) ? Math.max(0, result.remaining) : 0;
    const resetSec = Number.isFinite(result.resetTime)
      ? Math.floor(result.resetTime / 1000)
      : Math.floor(Date.now() / 1000) + 60;
    const retryAfter = Number.isFinite(result.resetTime)
      ? Math.max(0, Math.ceil((result.resetTime - Date.now()) / 1000))
      : 60;
    return {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(resetSec),
      'Retry-After': String(retryAfter),
    };
  } else {
    // Legacy format
    const { identifier, options } = result;
    const entry = requestCounts.get(identifier);

    if (!entry) {
      return {
        'X-RateLimit-Limit': options.maxRequests.toString(),
        'X-RateLimit-Remaining': options.maxRequests.toString(),
        'X-RateLimit-Reset': (Date.now() + options.windowMs).toString(),
      };
    }

    const remaining = Math.max(0, options.maxRequests - entry.count);
    return {
      'X-RateLimit-Limit': options.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': entry.resetAt.toString(),
    };
  }
}

/**
 * More sophisticated rate limiter with multiple tiers
 * Example: 100 requests per minute, 1000 per hour
 */
export function multiTierRateLimit(
  identifier: string,
  tiers: Array<{ windowMs: number; maxRequests: number; name: string }>,
): { allowed: boolean; limitedBy?: string } {
  for (const tier of tiers) {
    if (!rateLimit(`${identifier}:${tier.name}`, tier)) {
      return { allowed: false, limitedBy: tier.name };
    }
  }
  return { allowed: true };
}

/**
 * Rate limiter specifically for authenticated users
 * More generous limits than anonymous users
 */
export function authenticatedRateLimit(userId: string | null, isAnonymous: boolean = false) {
  if (!userId || isAnonymous) {
    // Anonymous: 10 requests per minute
    // NOTE: parentheses matter — `'anon:' + userId || 'unknown'` evaluates as
    // `('anon:' + userId) || 'unknown'`, which yields the string 'anon:null'
    // instead of the intended fallback.
    return rateLimit('anon:' + (userId || 'unknown'), { windowMs: 60000, maxRequests: 10 });
  } else {
    // Authenticated: 60 requests per minute
    return rateLimit('auth:' + userId, { windowMs: 60000, maxRequests: 60 });
  }
}
