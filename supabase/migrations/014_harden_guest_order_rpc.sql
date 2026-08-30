-- ============================================================================
-- NERVE — Migration 014: Harden guest order lookup (remove anon bypass)
--
-- Problem: 012 granted lookup_guest_order to anon/authenticated, allowing
-- direct PostgREST calls with the publishable anon key, bypassing the
-- verify-guest-order edge function's rate limiting (in-memory, non-distributed).
-- Token comparison is hashed and correct, but rate-limit bypass is real.
--
-- Fix: REVOKE anon/authenticated, keep service_role + authenticated via edge
-- function only. Direct RPC now requires service_role JWT (edge function's
-- SUPABASE_SERVICE_ROLE_KEY). Browser must go through /functions/v1/verify-guest-order.
-- COD-only: no Paymob webhook changes.
-- ============================================================================

-- Ensure the function exists (idempotent)
-- The function itself is correct — only grants are hardened.

REVOKE ALL ON FUNCTION lookup_guest_order(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION lookup_guest_order(TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION lookup_guest_order(TEXT, TEXT, TEXT) FROM authenticated;

-- Edge function uses service_role (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
-- Admin UI (if any) can also call via service_role through edge.
GRANT EXECUTE ON FUNCTION lookup_guest_order(TEXT, TEXT, TEXT) TO service_role;

-- Optional: if you want authenticated users to still call directly via their JWT
-- for own orders, uncomment the next line. For COD-only with guest orders,
-- service_role-only is the stricter and recommended default.
-- GRANT EXECUTE ON FUNCTION lookup_guest_order(TEXT, TEXT, TEXT) TO authenticated;
