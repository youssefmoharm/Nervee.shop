/**
 * Production-ready distributed rate limiter for Edge Functions
 * 
 * Uses Supabase database as a distributed store for rate limiting
 * across multiple Edge Function instances.
 */

interface RateLimitOptions {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  totalRequests: number
}

// Fallback in-memory store for when database is unavailable
const requestCounts = new Map<string, { count: number; resetAt: number }>()

/**
 * Distributed rate limiter using Supabase as storage
 * Falls back to in-memory if database is unavailable
 */
export async function distributedRateLimit(
  supabase: any,
  identifier: string,
  options: RateLimitOptions = { windowMs: 60000, maxRequests: 10 }
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowStart = now - options.windowMs
  const resetTime = now + options.windowMs

  try {
    // Try distributed rate limiting first
    const result = await distributedRateLimitDB(supabase, identifier, options, now, windowStart)
    if (result) return result
  } catch (error) {
    console.warn('Distributed rate limiter failed, falling back to in-memory:', error)
  }

  // Fallback to in-memory rate limiting
  return inMemoryRateLimit(identifier, options, now, resetTime)
}

async function distributedRateLimitDB(
  supabase: any,
  identifier: string,
  options: RateLimitOptions,
  now: number,
  windowStart: number
): Promise<RateLimitResult | null> {
  // Use a stored procedure for atomic rate limiting
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_identifier: identifier,
    p_window_start: new Date(windowStart).toISOString(),
    p_max_requests: options.maxRequests,
    p_window_ms: options.windowMs
  })

  if (error) {
    throw new Error(`Rate limit check failed: ${error.message}`)
  }

  return {
    allowed: data.allowed,
    remaining: Math.max(0, options.maxRequests - data.current_count),
    resetTime: now + options.windowMs,
    totalRequests: data.current_count
  }
}

function inMemoryRateLimit(
  identifier: string,
  options: RateLimitOptions,
  now: number,
  resetTime: number
): RateLimitResult {
  const entry = requestCounts.get(identifier)

  // No entry or window expired - allow and create new entry
  if (!entry || entry.resetAt < now) {
    requestCounts.set(identifier, {
      count: 1,
      resetAt: resetTime,
    })
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      resetTime,
      totalRequests: 1
    }
  }

  // Within window - check count
  if (entry.count < options.maxRequests) {
    entry.count++
    return {
      allowed: true,
      remaining: options.maxRequests - entry.count,
      resetTime: entry.resetAt,
      totalRequests: entry.count
    }
  }

  // Rate limit exceeded
  return {
    allowed: false,
    remaining: 0,
    resetTime: entry.resetAt,
    totalRequests: entry.count
  }
}

/**
 * Legacy in-memory rate limiter (kept for backward compatibility)
 */
export function rateLimit(
  identifier: string,
  options: RateLimitOptions = { windowMs: 60000, maxRequests: 10 }
): boolean {
  const now = Date.now()
  const entry = requestCounts.get(identifier)

  if (!entry || entry.resetAt < now) {
    requestCounts.set(identifier, {
      count: 1,
      resetAt: now + options.windowMs,
    })
    return true
  }

  if (entry.count < options.maxRequests) {
    entry.count++
    return true
  }

  return false
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(
  result: RateLimitResult | { identifier: string; options: RateLimitOptions }
): Record<string, string> {
  if ('allowed' in result) {
    // New format with RateLimitResult
    return {
      'X-RateLimit-Limit': String(result.totalRequests + result.remaining),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.floor(result.resetTime / 1000)),
      'Retry-After': String(Math.ceil((result.resetTime - Date.now()) / 1000))
    }
  } else {
    // Legacy format
    const { identifier, options } = result
    const entry = requestCounts.get(identifier)
    
    if (!entry) {
      return {
        'X-RateLimit-Limit': options.maxRequests.toString(),
        'X-RateLimit-Remaining': options.maxRequests.toString(),
        'X-RateLimit-Reset': (Date.now() + options.windowMs).toString(),
      }
    }

    const remaining = Math.max(0, options.maxRequests - entry.count)
    return {
      'X-RateLimit-Limit': options.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': entry.resetAt.toString(),
    }
  }
}

/**
 * More sophisticated rate limiter with multiple tiers
 * Example: 100 requests per minute, 1000 per hour
 */
export function multiTierRateLimit(
  identifier: string,
  tiers: Array<{ windowMs: number; maxRequests: number; name: string }>
): { allowed: boolean; limitedBy?: string } {
  for (const tier of tiers) {
    if (!rateLimit(`${identifier}:${tier.name}`, tier)) {
      return { allowed: false, limitedBy: tier.name }
    }
  }
  return { allowed: true }
}

/**
 * Rate limiter specifically for authenticated users
 * More generous limits than anonymous users
 */
export function authenticatedRateLimit(userId: string | null, isAnonymous: boolean = false) {
  if (!userId || isAnonymous) {
    // Anonymous: 10 requests per minute
    return rateLimit('anon:' + userId || 'unknown', { windowMs: 60000, maxRequests: 10 })
  } else {
    // Authenticated: 60 requests per minute
    return rateLimit('auth:' + userId, { windowMs: 60000, maxRequests: 60 })
  }
}
