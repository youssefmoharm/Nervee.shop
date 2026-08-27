// Environment-aware CORS. In production only the official NERVE origins are
// allowed; in development localhost is permitted as well. Every edge function
// imports this single source of truth.

const PROD_ORIGINS = new Set([
  'https://nerve-store.com',
  'https://www.nerve-store.com',
  'https://nerve-weld.vercel.app',
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
  const allowedOrigin = origin && isAllowedOrigin(origin) ? origin : ''

  // If no origin header (server-to-server / edge-to-edge calls with
  // service_role JWT), return permissive CORS — the auth check is the
  // real gate. Browser calls always have an origin.
  const allowOrigin = origin ? allowedOrigin || '' : '*'

  return {
    'Access-Control-Allow-Origin': allowOrigin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

// Backwards compat: existing handlers do `headers: corsHeaders`. Keep a
// permissive default for build-time import but prefer getCorsHeaders(req)
// at request time.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}
