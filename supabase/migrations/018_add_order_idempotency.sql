-- ============================================================================
-- NERVE — Migration 018
-- Idempotency Key for Order Creation
--
-- Prevents duplicate orders from duplicate checkout requests (retry, back-forward, etc.)
-- Maps idempotency_key → order_id. Same request = same order.
-- ============================================================================

-- Add idempotency_key column to orders table (unique constraint)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS orders_idempotency_key_idx ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- Create idempotency tracking table (alternative lightweight approach)
-- Maps idempotency_key → order_id, expires after 24 hours
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS order_idempotency_key_idx ON order_idempotency(idempotency_key);
CREATE INDEX IF NOT EXISTS order_idempotency_expires_idx ON order_idempotency(expires_at);

-- Service role can clean up expired entries
ALTER TABLE order_idempotency ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can access" ON order_idempotency;
CREATE POLICY "Service role can access" ON order_idempotency FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- Enhanced place_order() function with idempotency
-- ============================================================================
CREATE OR REPLACE FUNCTION place_order_with_idempotency(
  p_customer_id UUID,
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_phone TEXT,
  p_address TEXT,
  p_city TEXT,
  p_governorate TEXT,
  p_postal_code TEXT,
  p_delivery_method TEXT,
  p_payment_provider TEXT,
  p_discount_code TEXT,
  p_items JSONB,
  p_idempotency_key TEXT
)
RETURNS TABLE (order_id UUID, order_number TEXT, total INTEGER, is_duplicate BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_order_id UUID;
  v_order orders;
  v_result_order_id UUID;
  v_result_order_number TEXT;
  v_result_total INTEGER;
BEGIN
  -- Validate idempotency key
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'Idempotency key is required' USING ERRCODE = 'P0001';
  END IF;

  -- Check if this idempotency key has already been processed
  SELECT order_id INTO v_existing_order_id FROM order_idempotency
    WHERE idempotency_key = p_idempotency_key
      AND expires_at > NOW()
    LIMIT 1;

  IF v_existing_order_id IS NOT NULL THEN
    -- Return the existing order (duplicate request)
    SELECT id, order_number, total INTO v_result_order_id, v_result_order_number, v_result_total
      FROM orders WHERE id = v_existing_order_id;

    RETURN QUERY SELECT v_result_order_id, v_result_order_number, v_result_total, true;
    RETURN;
  END IF;

  -- Process the order (existing place_order logic)
  SELECT * INTO v_order FROM place_order(
    p_customer_id, p_email, p_first_name, p_last_name, p_phone,
    p_address, p_city, p_governorate, p_postal_code,
    p_delivery_method, p_payment_provider, p_discount_code, p_items
  );

  -- Record idempotency key
  INSERT INTO order_idempotency (idempotency_key, order_id)
    VALUES (p_idempotency_key, v_order.id)
    ON CONFLICT (idempotency_key) DO NOTHING;

  -- Also store idempotency_key on the order itself (for audit)
  UPDATE orders SET idempotency_key = p_idempotency_key WHERE id = v_order.id;

  RETURN QUERY SELECT v_order.id, v_order.order_number, v_order.total, false;
END;
$$;

REVOKE ALL ON FUNCTION place_order_with_idempotency FROM PUBLIC;
GRANT EXECUTE ON FUNCTION place_order_with_idempotency TO service_role;

-- ============================================================================
-- Cleanup function: remove expired idempotency keys (run via scheduler)
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM order_idempotency WHERE expires_at < NOW();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_expired_idempotency() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_idempotency() TO service_role;

