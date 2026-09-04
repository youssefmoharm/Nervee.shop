// Environment-aware CORS. In production only the official NERVE origins are
// allowed; in development localhost is permitted as well. Every edge function
// imports this single source of truth.

const PROD_ORIGINS = new Set([

  'https://nerveey.shop',
  'https://www.nerveey.shop',
])

const DEV_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
])

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  if (PROD_ORIGINS.has(origin)) return true
  // Localhost allowed in any environment for local dev / preview
  if (DEV_ORIGINS.has(origin)) return true
  // Allow Vercel preview deployments for this project
  if (/^https:\/\/nerve.*\.vercel\.app$/.test(origin)) return true
  return false
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin')

  // Three distinct cases, handled explicitly so a disallowed origin can
  // never silently fall through to '*':
  //   1. No Origin header at all -> server-to-server / edge-to-edge call
  //      (service_role JWT is the real gate here) -> '*' is intentional.
  //   2. Origin header present and allowlisted -> echo that exact origin.
  //   3. Origin header present but NOT allowlisted -> omit the header
  //      entirely so the browser blocks the response. Do NOT fall back
  //      to '*' — that would defeat the allowlist.
  let allowOrigin: string
  if (!origin) {
    allowOrigin = '*'
  } else if (isAllowedOrigin(origin)) {
    allowOrigin = origin
  } else {
    allowOrigin = ''
  }

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }

  // Only set Access-Control-Allow-Origin when we actually have a value to
  // grant. An empty string is not a valid header value and, more
  // importantly, must never be coerced back into '*' by a caller.
  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin
  }

  return headers
}
