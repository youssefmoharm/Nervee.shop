-- validate_discount_code RPC: active / expired / min-purchase / inactive
-- Portable DO-block assertions; BEGIN/ROLLBACK keeps the run side-effect free.
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/database/discount_validation.sql
--  or: supabase test db

BEGIN;

DO $$
DECLARE
  v_active_code TEXT := 'TAP_ACTIVE_10';
  v_expired_code TEXT := 'TAP_EXPIRED';
  v_inactive_code TEXT := 'TAP_INACTIVE';
  v_min_code TEXT := 'TAP_MIN500';
  v_row RECORD;
BEGIN
  -- Fixtures (codes are unique-constrained; conflict-update for re-runs inside a txn)
  INSERT INTO discount_codes (code, description, discount_type, discount_value, minimum_purchase, is_active, valid_from, valid_until)
  VALUES
    (v_active_code, 'pgTAP active 10%', 'percentage', 10, NULL, TRUE, NOW() - INTERVAL '1 day', NULL),
    (v_expired_code, 'pgTAP expired', 'fixed', 50, NULL, TRUE, NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day'),
    (v_inactive_code, 'pgTAP inactive', 'percentage', 25, NULL, FALSE, NOW() - INTERVAL '1 day', NULL),
    (v_min_code, 'pgTAP min purchase', 'fixed', 100, 500, TRUE, NOW() - INTERVAL '1 day', NULL)
  ON CONFLICT (code) DO UPDATE SET
    is_active = EXCLUDED.is_active,
    valid_from = EXCLUDED.valid_from,
    valid_until = EXCLUDED.valid_until,
    minimum_purchase = EXCLUDED.minimum_purchase,
    discount_type = EXCLUDED.discount_type,
    discount_value = EXCLUDED.discount_value;

  -- Active percentage code at any subtotal → valid, amount = 10%
  SELECT * INTO v_row FROM validate_discount_code(v_active_code, 1000);
  IF NOT v_row.valid THEN
    RAISE EXCEPTION 'FAIL: active code should be valid, got message=%', v_row.message;
  END IF;
  IF v_row.discount_type <> 'percentage' OR v_row.discount_value <> 10 THEN
    RAISE EXCEPTION 'FAIL: active code metadata mismatch: % %', v_row.discount_type, v_row.discount_value;
  END IF;
  IF v_row.discount_amount IS DISTINCT FROM 100 THEN
    RAISE EXCEPTION 'FAIL: expected discount_amount=100 for 10%% of 1000, got %', v_row.discount_amount;
  END IF;

  -- Expired code → invalid with expired message
  SELECT * INTO v_row FROM validate_discount_code(v_expired_code, 1000);
  IF v_row.valid THEN
    RAISE EXCEPTION 'FAIL: expired code must not be valid';
  END IF;
  IF v_row.message IS NULL OR v_row.message NOT LIKE '%expired%' THEN
    RAISE EXCEPTION 'FAIL: expected expired message, got %', v_row.message;
  END IF;

  -- Inactive code → invalid with inactive message
  SELECT * INTO v_row FROM validate_discount_code(v_inactive_code, 1000);
  IF v_row.valid THEN
    RAISE EXCEPTION 'FAIL: inactive code must not be valid';
  END IF;
  IF v_row.message IS NULL OR v_row.message NOT LIKE '%no longer active%' THEN
    RAISE EXCEPTION 'FAIL: expected inactive message, got %', v_row.message;
  END IF;

  -- Below minimum purchase → invalid, message mentions minimum
  SELECT * INTO v_row FROM validate_discount_code(v_min_code, 100);
  IF v_row.valid THEN
    RAISE EXCEPTION 'FAIL: code below minimum_purchase must not be valid';
  END IF;
  IF v_row.message IS NULL OR v_row.message NOT LIKE '%Minimum purchase%' THEN
    RAISE EXCEPTION 'FAIL: expected minimum-purchase message, got %', v_row.message;
  END IF;

  -- At/above minimum purchase → valid
  SELECT * INTO v_row FROM validate_discount_code(v_min_code, 500);
  IF NOT v_row.valid THEN
    RAISE EXCEPTION 'FAIL: code at minimum_purchase should be valid, got %', v_row.message;
  END IF;
  IF v_row.discount_amount IS DISTINCT FROM 100 THEN
    RAISE EXCEPTION 'FAIL: fixed 100 EGP discount expected, got %', v_row.discount_amount;
  END IF;

  -- Unknown / empty codes → invalid
  SELECT * INTO v_row FROM validate_discount_code('DOES_NOT_EXIST_XYZ', 1000);
  IF v_row.valid THEN
    RAISE EXCEPTION 'FAIL: unknown code must not be valid';
  END IF;

  SELECT * INTO v_row FROM validate_discount_code(NULL, 1000);
  IF v_row.valid THEN
    RAISE EXCEPTION 'FAIL: NULL code must not be valid';
  END IF;

  SELECT * INTO v_row FROM validate_discount_code('   ', 1000);
  IF v_row.valid THEN
    RAISE EXCEPTION 'FAIL: blank code must not be valid';
  END IF;
END $$;

ROLLBACK;
