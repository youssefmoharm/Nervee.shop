-- Migration 050 behaviors: inventory lock RPC, order transition map,
-- single history writer, percentage discount cap, dashboard columns.
-- Portable DO-block assertions; BEGIN/ROLLBACK keeps the run side-effect free.
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/database/admin_ops_hardening.sql
--  or: supabase test db

BEGIN;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, aud, role)
VALUES
  ('00000000-0000-4000-8000-00000000ad01', 'pgtap-admin@nerve.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000ad99', 'pgtap-intruder@nerve.test', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO admin_users (user_id)
VALUES ('00000000-0000-4000-8000-00000000ad01')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO products (id, slug, name, category, price, description, material, care)
VALUES ('pgtap-inv-product', 'pgtap-inv-product', 'PGTAP Inventory Fixture', 'T-Shirts', 500, 'fixture', 'cotton', '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_inventory (product_id, size, stock_quantity, in_stock, low_stock_threshold)
VALUES ('pgtap-inv-product', 'M', 10, TRUE, 5)
ON CONFLICT (product_id, size) DO UPDATE SET stock_quantity = 10, in_stock = TRUE;

INSERT INTO orders (
  id, order_number, email, first_name, last_name, phone, address, city, governorate,
  subtotal, shipping_cost, total, delivery_method, status
) VALUES
  ('10000000-0000-4000-8000-000000000001', 'PGTAP-ORD-1', 'pgtap1@example.com',
   'Test', 'Fixture', '01000000000', '1 Test St', 'Cairo', 'Cairo',
   500, 0, 500, 'standard', 'placed'),
  ('10000000-0000-4000-8000-000000000002', 'PGTAP-ORD-2', 'pgtap2@example.com',
   'Test', 'Fixture', '01000000001', '2 Test St', 'Giza', 'Giza',
   500, 0, 500, 'standard', 'cancelled')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (order_id, product_id, product_name, product_slug, color, size, image, price, quantity, subtotal)
VALUES ('10000000-0000-4000-8000-000000000001', 'pgtap-inv-product',
        'PGTAP Inventory Fixture', 'pgtap-inv-product', 'Black', 'M',
        'https://example.com/fixture.jpg', 500, 2, 1000);

-- ---------------------------------------------------------------------------
-- 1) update_inventory_with_lock: admin-gated, non-negative, in_stock synced
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_uid UUID := '00000000-0000-4000-8000-00000000ad99';
  v_rejected BOOLEAN := FALSE;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);

  BEGIN
    PERFORM update_inventory_with_lock('pgtap-inv-product', 'M', 3);
  EXCEPTION WHEN insufficient_privilege THEN
    v_rejected := TRUE;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'FAIL: non-admin inventory update was not rejected';
  END IF;

  PERFORM set_config('request.jwt.claims', '', true);
END $$;

DO $$
DECLARE
  v_uid UUID := '00000000-0000-4000-8000-00000000ad01';
  v_row RECORD;
  v_rejected BOOLEAN := FALSE;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);

  -- Admin write: absolute quantity lands, in_stock follows.
  PERFORM update_inventory_with_lock('pgtap-inv-product', 'M', 7);
  SELECT stock_quantity, in_stock INTO v_row
  FROM product_inventory WHERE product_id = 'pgtap-inv-product' AND size = 'M';
  IF v_row.stock_quantity <> 7 OR v_row.in_stock IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'FAIL: expected (7, true) after admin write, got (%, %)',
      v_row.stock_quantity, v_row.in_stock;
  END IF;

  -- Zero clears in_stock.
  PERFORM update_inventory_with_lock('pgtap-inv-product', 'M', 0);
  SELECT stock_quantity, in_stock INTO v_row
  FROM product_inventory WHERE product_id = 'pgtap-inv-product' AND size = 'M';
  IF v_row.stock_quantity <> 0 OR v_row.in_stock IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'FAIL: expected (0, false) after zeroing, got (%, %)',
      v_row.stock_quantity, v_row.in_stock;
  END IF;

  -- Negative rejected even for an admin.
  BEGIN
    PERFORM update_inventory_with_lock('pgtap-inv-product', 'M', -1);
  EXCEPTION WHEN raise_exception THEN
    v_rejected := TRUE;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'FAIL: negative stock quantity was accepted';
  END IF;
  SELECT stock_quantity INTO v_row
  FROM product_inventory WHERE product_id = 'pgtap-inv-product' AND size = 'M';
  IF v_row.stock_quantity <> 0 THEN
    RAISE EXCEPTION 'FAIL: stock changed despite rejected negative write (got %)', v_row.stock_quantity;
  END IF;

  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- Grants: locked down to authenticated (in-function admin gate) + service_role.
DO $$
BEGIN
  IF has_function_privilege('anon', 'update_inventory_with_lock(text,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon must not execute update_inventory_with_lock';
  END IF;
  IF NOT has_function_privilege('authenticated', 'update_inventory_with_lock(text,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated should execute update_inventory_with_lock (gated inside)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) update_order_status: authoritative transition map + single audit writer
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_order UUID := '10000000-0000-4000-8000-000000000001';
  v_admin UUID := '00000000-0000-4000-8000-00000000ad01';
  v_row RECORD;
  v_hist BIGINT;
  v_rejected BOOLEAN;
BEGIN
  -- placed -> processing is valid, audit row carries actor + reason.
  PERFORM update_order_status(v_order, 'processing', NULL, NULL, 'pgtap reason', v_admin);
  SELECT status INTO v_row FROM orders WHERE id = v_order;
  IF v_row.status <> 'processing' THEN
    RAISE EXCEPTION 'FAIL: expected status=processing after valid transition, got %', v_row.status;
  END IF;

  SELECT COUNT(*) INTO v_hist
  FROM order_status_history WHERE order_id = v_order AND to_status = 'processing';
  IF v_hist <> 1 THEN
    RAISE EXCEPTION 'FAIL: expected exactly 1 history row for one transition, got %', v_hist;
  END IF;
  SELECT changed_by, reason INTO v_row
  FROM order_status_history WHERE order_id = v_order AND to_status = 'processing';
  IF v_row.changed_by IS DISTINCT FROM v_admin OR v_row.reason IS DISTINCT FROM 'pgtap reason' THEN
    RAISE EXCEPTION 'FAIL: history row missing changed_by/reason (got %, %)',
      v_row.changed_by, v_row.reason;
  END IF;

  -- processing -> delivered must be rejected (skips shipped).
  v_rejected := FALSE;
  BEGIN
    PERFORM update_order_status(v_order, 'delivered', NULL, NULL, NULL, v_admin);
  EXCEPTION WHEN raise_exception THEN
    v_rejected := TRUE;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'FAIL: state skipping processing->delivered was allowed';
  END IF;

  -- processing -> shipped -> delivered are the valid path.
  PERFORM update_order_status(v_order, 'shipped', NULL, NULL, NULL, v_admin);
  PERFORM update_order_status(v_order, 'delivered', NULL, NULL, NULL, v_admin);
  SELECT status INTO v_row FROM orders WHERE id = v_order;
  IF v_row.status <> 'delivered' THEN
    RAISE EXCEPTION 'FAIL: expected status=delivered, got %', v_row.status;
  END IF;

  -- delivered -> cancelled must be rejected (delivered only moves to refunded).
  v_rejected := FALSE;
  BEGIN
    PERFORM update_order_status(v_order, 'cancelled', NULL, NULL, NULL, v_admin);
  EXCEPTION WHEN raise_exception THEN
    v_rejected := TRUE;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'FAIL: delivered->cancelled was allowed';
  END IF;

  -- delivered -> refunded restocks the 2 fixture units (stock currently 0).
  PERFORM update_order_status(v_order, 'refunded', NULL, NULL, 'customer request', v_admin);
  SELECT stock_quantity INTO v_row
  FROM product_inventory WHERE product_id = 'pgtap-inv-product' AND size = 'M';
  IF v_row.stock_quantity <> 2 THEN
    RAISE EXCEPTION 'FAIL: refund should restock 2 units (stock now %)', v_row.stock_quantity;
  END IF;

  -- Refund restock happened exactly once (not once per history row).
  SELECT COUNT(*) INTO v_hist
  FROM order_status_history WHERE order_id = v_order AND to_status = 'refunded';
  IF v_hist <> 1 THEN
    RAISE EXCEPTION 'FAIL: expected exactly 1 refund history row, got %', v_hist;
  END IF;

  -- No-op same-status update: allowed, but writes no history row.
  PERFORM update_order_status(v_order, 'refunded', NULL, NULL, NULL, v_admin);
  SELECT COUNT(*) INTO v_hist
  FROM order_status_history WHERE order_id = v_order;
  IF v_hist <> 4 THEN
    RAISE EXCEPTION 'FAIL: no-op update must not add history (total rows %, expected 4)', v_hist;
  END IF;

  -- Cancelled orders are terminal: cancelled -> refunded must be rejected.
  v_rejected := FALSE;
  BEGIN
    PERFORM update_order_status('10000000-0000-4000-8000-000000000002', 'refunded', NULL, NULL, NULL, v_admin);
  EXCEPTION WHEN raise_exception THEN
    v_rejected := TRUE;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'FAIL: cancelled->refunded was allowed (terminal states must stay terminal)';
  END IF;
END $$;

-- The duplicate AFTER UPDATE trigger from migration 043 must be gone:
-- the RPC is the single history writer.
DO $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_trigger
  WHERE tgname = 'trigger_order_status_history'
    AND tgrelid = 'orders'::regclass
    AND NOT tgisinternal;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: duplicate order status history trigger still exists';
  END IF;
END $$;

-- Only the edge function's service role may call the RPC — no direct client writes.
DO $$
BEGIN
  IF has_function_privilege('authenticated', 'update_order_status(uuid,text,text,text,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated clients must not execute update_order_status directly';
  END IF;
  IF has_function_privilege('anon', 'update_order_status(uuid,text,text,text,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon must not execute update_order_status';
  END IF;
  IF NOT has_function_privilege('service_role', 'update_order_status(uuid,text,text,text,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: service_role must execute update_order_status (edge function)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Percentage discounts are capped at 1..100; fixed amounts are not
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_rejected BOOLEAN := FALSE;
BEGIN
  BEGIN
    INSERT INTO discount_codes (code, description, discount_type, discount_value, is_active)
    VALUES ('PGTAP_OVER100', 'over 100%', 'percentage', 150, TRUE);
  EXCEPTION WHEN check_violation THEN
    v_rejected := TRUE;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'FAIL: percentage discount above 100 was stored';
  END IF;
END $$;

DO $$
DECLARE v_rejected BOOLEAN := FALSE;
BEGIN
  BEGIN
    INSERT INTO discount_codes (code, description, discount_type, discount_value, is_active)
    VALUES ('PGTAP_FIXED500', 'fixed 500', 'fixed', 500, TRUE);
  EXCEPTION WHEN check_violation THEN
    v_rejected := TRUE;
  END;
  IF v_rejected THEN
    RAISE EXCEPTION 'FAIL: fixed-amount discount of 500 must remain allowed';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) get_dashboard_overview exposes the operational columns the UI reads
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_result TEXT;
  v_row RECORD;
BEGIN
  SELECT pg_get_function_result(p.oid) INTO v_result
  FROM pg_proc p
  WHERE p.proname = 'get_dashboard_overview'
    AND p.prokind = 'f'
  LIMIT 1;

  IF v_result IS NULL
     OR v_result NOT LIKE '%processing_orders%'
     OR v_result NOT LIKE '%pending_returns%'
     OR v_result NOT LIKE '%products_sold%'
     OR v_result NOT LIKE '%shipped_orders%' THEN
    RAISE EXCEPTION 'FAIL: dashboard RPC missing operational columns: %', v_result;
  END IF;

  SELECT * INTO v_row FROM get_dashboard_overview(
    NOW() - INTERVAL '3 months', NOW() - INTERVAL '2 months',
    NOW() - INTERVAL '30 days', NOW()
  );
  IF v_row.products_sold IS NULL OR v_row.processing_orders IS NULL
     OR v_row.pending_returns IS NULL THEN
    RAISE EXCEPTION 'FAIL: dashboard RPC returned NULL operational metrics';
  END IF;
  IF v_row.products_sold < 0 OR v_row.average_order_value < 0 THEN
    RAISE EXCEPTION 'FAIL: dashboard RPC returned negative metrics';
  END IF;
END $$;

ROLLBACK;
