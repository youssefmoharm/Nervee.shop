-- ============================================================================
-- NERVE — Migration 019: Fix lookup_guest_order RPC Grant Regression
--
-- CRITICAL BUG: Migration 012 granted lookup_guest_order to anon+authenticated.
-- Migration 014 intended to revoke these but the grants were never removed.
--
-- RISK: Clients can call lookup_guest_order directly, bypassing the
-- verify-guest-order edge function's rate limiting.
--
-- FIX: Revoke anon/authenticated, grant service_role only.
-- This forces all guest order lookups through the rate-limited edge function.
-- ============================================================================

-- Revoke from anon and authenticated (undo the overly permissive grants in 012)
REVOKE ALL ON FUNCTION lookup_guest_order(TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION lookup_guest_order(TEXT, TEXT, TEXT) FROM authenticated;

-- Ensure service_role (and postgres owner) can still call it
GRANT EXECUTE ON FUNCTION lookup_guest_order(TEXT, TEXT, TEXT) TO service_role;

-- Note: postgres (owner) retains default full privileges — no need to explicitly grant
