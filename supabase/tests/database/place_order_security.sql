-- place_order / update_order_status security + behavior
-- Portable DO-block assertions (RAISE EXCEPTION on failure) so the suite
-- fails loudly with or without pgTAP. Wrap in BEGIN/ROLLBACK for pg_prove /
-- `supabase test db` conventions — no fixtures persist.
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/database/place_order_security.sql
--  or: supabase test db

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. place_order grants: no PUBLIC / anon / authenticated; service_role only
--    (final state from migration 017)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF has_function_privilege('anon', 'place_order(uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon must not EXECUTE place_order';
  END IF;

  IF has_function_privilege('authenticated', 'place_order(uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated must not EXECUTE place_order (p_customer_id is untrusted)';
  END IF;

  IF NOT has_function_privilege('service_role', 'place_order(uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: service_role must be able to EXECUTE place_order';
  END IF;

  -- PUBLIC grant (grantee oid 0) must not include EXECUTE
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
    WHERE n.nspname = 'public'
      AND p.proname = 'place_order'
      AND a.grantee = 0
      AND a.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: place_order has a PUBLIC EXECUTE grant';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. update_order_status: service_role only (migration 027)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF has_function_privilege('anon', 'update_order_status(uuid,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon must not EXECUTE update_order_status';
  END IF;

  IF has_function_privilege('authenticated', 'update_order_status(uuid,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated must not EXECUTE update_order_status';
  END IF;

  IF NOT has_function_privilege('service_role', 'update_order_status(uuid,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: service_role must be able to EXECUTE update_order_status';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Fixtures + behavior: history written, invalid transitions rejected
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_order_id UUID;
  v_history_before INTEGER;
  v_history_after INTEGER;
  v_status TEXT;
  v_raised BOOLEAN;
BEGIN
  INSERT INTO orders (
    order_number, email, first_name, last_name, phone,
    address, city, governorate, subtotal, shipping_cost, total,
    delivery_method, status
  ) VALUES (
    'NRV-TEST-' || floor(random() * 1000000)::text,
    'pgtap@example.test', 'Test', 'Order', '01012345678',
    '15 Test Street', 'Cairo', 'Cairo', 500, 100, 600,
    'standard', 'placed'
  ) RETURNING id INTO v_order_id;

  SELECT COUNT(*) INTO v_history_before
    FROM order_status_history WHERE order_id = v_order_id;

  -- Happy path: placed → processing writes an audit row
  PERFORM update_order_status(v_order_id, 'processing', NULL, NULL, 'pgTAP happy path');

  SELECT COUNT(*) INTO v_history_after
    FROM order_status_history WHERE order_id = v_order_id;

  IF v_history_after <= v_history_before THEN
    RAISE EXCEPTION 'FAIL: update_order_status did not write order_status_history';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM order_status_history
    WHERE order_id = v_order_id
      AND from_status = 'placed'
      AND to_status = 'processing'
  ) THEN
    RAISE EXCEPTION 'FAIL: history row missing placed→processing transition';
  END IF;

  SELECT status INTO v_status FROM orders WHERE id = v_order_id;
  IF v_status <> 'processing' THEN
    RAISE EXCEPTION 'FAIL: expected status=processing, got %', v_status;
  END IF;

  -- Terminal state: move to cancelled, then any non-terminal transition must raise
  PERFORM update_order_status(v_order_id, 'cancelled', NULL, NULL, 'cancel for transition test');

  v_raised := FALSE;
  BEGIN
    PERFORM update_order_status(v_order_id, 'shipped', NULL, NULL, 'should be rejected');
  EXCEPTION WHEN OTHERS THEN
    v_raised := TRUE;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'FAIL: cancelled→shipped should raise but did not';
  END IF;

  -- delivered → processing is also illegal
  UPDATE orders SET status = 'delivered', cancelled_at = NULL WHERE id = v_order_id;
  v_raised := FALSE;
  BEGIN
    PERFORM update_order_status(v_order_id, 'processing', NULL, NULL, 'should be rejected');
  EXCEPTION WHEN OTHERS THEN
    v_raised := TRUE;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'FAIL: delivered→processing should raise but did not';
  END IF;

  -- Unknown status value must raise
  v_raised := FALSE;
  BEGIN
    PERFORM update_order_status(v_order_id, 'teleported', NULL, NULL, 'invalid enum');
  EXCEPTION WHEN OTHERS THEN
    v_raised := TRUE;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'FAIL: invalid status value should raise but did not';
  END IF;
END $$;

ROLLBACK;
