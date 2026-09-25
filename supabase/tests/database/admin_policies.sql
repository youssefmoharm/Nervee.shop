-- Admin RLS policies on customers / order_items (migration 038, audit SEC-01)
--
-- Guards the regression that broke Admin → Customers, the Dashboard customer
-- count, review-author embeds for admins, and admin order line-item reads:
-- owner-only SELECT policies with no admin policy anywhere.
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/database/admin_policies.sql
--  or: supabase test db

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Required admin policies must exist with the standard admin predicate
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE (tablename, policyname) IN (
      ('customers', 'Admins can view all customers'),
      ('order_items', 'Admins can view all order items')
    )
    AND cmd = 'SELECT'
    AND qual::text LIKE '%admin_users%';

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL: expected admin SELECT policies on customers + order_items (found %)', v_count;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Every other admin-facing table keeps an admin policy too (no regressions)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_missing TEXT;
BEGIN
  SELECT string_agg(t, ', ') INTO v_missing
  FROM unnest(ARRAY['orders', 'discount_codes', 'contact_messages',
                    'newsletter_subscribers', 'order_return_requests',
                    'refunds', 'order_status_history']) AS t
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.tablename = t AND p.qual::text LIKE '%admin_users%'
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: missing admin policy on: %', v_missing;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Owner policies must still exist (permissive-OR: admins don't break users)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE (tablename, policyname) IN (
      ('customers', 'Users can view own profile'),
      ('order_items', 'Users can view own order items')
    )
    AND cmd = 'SELECT';

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL: owner SELECT policies on customers/order_items missing (found %)', v_count;
  END IF;
END $$;

ROLLBACK;
