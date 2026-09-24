-- guest_orders lockdown + lookup_guest_order service_role-only
-- Portable DO-block assertions; BEGIN/ROLLBACK for side-effect-free runs.
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/database/guest_order_rls.sql
--  or: supabase test db

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. guest_orders: RLS enabled and NO policies for anon SELECT (migration 012
--    dropped the only public policy; deny-by-default for clients).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_rls BOOLEAN;
  v_policy_count INTEGER;
BEGIN
  SELECT relrowsecurity INTO v_rls
    FROM pg_class
    JOIN pg_namespace n ON n.oid = relnamespace
    WHERE n.nspname = 'public' AND relname = 'guest_orders';

  IF v_rls IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'FAIL: guest_orders must have RLS enabled';
  END IF;

  SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'guest_orders'
      AND (command IS NULL OR command = 'ALL' OR command = 'SELECT');

  IF v_policy_count > 0 THEN
    RAISE EXCEPTION 'FAIL: guest_orders must have no client-reachable SELECT policies (found %)', v_policy_count;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. lookup_guest_order: service_role only; no anon/authenticated/PUBLIC
--    (migrations 014 + 019)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT to_regprocedure('public.lookup_guest_order(text,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: lookup_guest_order(text,text,text) is missing';
  END IF;

  IF has_function_privilege('anon', 'lookup_guest_order(text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon must not EXECUTE lookup_guest_order';
  END IF;

  IF has_function_privilege('authenticated', 'lookup_guest_order(text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated must not EXECUTE lookup_guest_order';
  END IF;

  IF NOT has_function_privilege('service_role', 'lookup_guest_order(text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: service_role must be able to EXECUTE lookup_guest_order';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
    WHERE n.nspname = 'public'
      AND p.proname = 'lookup_guest_order'
      AND a.grantee = 0
      AND a.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: lookup_guest_order has a PUBLIC EXECUTE grant';
  END IF;
END $$;

ROLLBACK;
