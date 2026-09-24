-- Migration 027: orders.tracking_number + update_order_status hardening
--
-- update_order_status (migration 003) already references tracking_number and
-- payment_status, but orders.tracking_number was never added (003 only added
-- tracking_url). Recreate the function with:
--   - status-transition validation
--   - automatic order_status_history insert (table from migration 013)
--   - p_reason parameter for audit trail
-- DROP the old 4-arg signature first so the 5-arg (p_reason) version is the
-- only executable one.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;

-- Drop the previous signature (order_id, status, tracking_number, tracking_url)
DROP FUNCTION IF EXISTS update_order_status(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION update_order_status(
  p_order_id UUID,
  p_status TEXT,
  p_tracking_number TEXT DEFAULT NULL,
  p_tracking_url TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders;
  v_item order_items%ROWTYPE;
  v_from_status TEXT;
BEGIN
  IF p_status NOT IN ('placed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0001';
  END IF;

  v_from_status := v_order.status;

  -- Status transition validation (terminal states cannot be left).
  IF v_from_status IN ('cancelled', 'refunded') AND p_status NOT IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Cannot move order from % to %', v_from_status, p_status USING ERRCODE = 'P0001';
  END IF;
  IF v_from_status = 'delivered' AND p_status NOT IN ('delivered', 'refunded') THEN
    RAISE EXCEPTION 'Cannot move order from delivered to %', p_status USING ERRCODE = 'P0001';
  END IF;

  -- Restock once, only on the transition INTO cancelled/refunded (never twice).
  IF p_status IN ('cancelled', 'refunded') AND v_from_status NOT IN ('cancelled', 'refunded') THEN
    FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id
    LOOP
      UPDATE product_inventory
        SET stock_quantity = stock_quantity + v_item.quantity,
            in_stock = TRUE
        WHERE product_id = v_item.product_id AND size = v_item.size;
    END LOOP;
  END IF;

  UPDATE orders SET
    status = p_status,
    payment_status = CASE WHEN p_status = 'refunded' THEN 'refunded' ELSE payment_status END,
    tracking_number = COALESCE(p_tracking_number, tracking_number),
    tracking_url = COALESCE(p_tracking_url, tracking_url),
    shipped_at = CASE WHEN p_status = 'shipped' AND shipped_at IS NULL THEN NOW() ELSE shipped_at END,
    delivered_at = CASE WHEN p_status = 'delivered' AND delivered_at IS NULL THEN NOW() ELSE delivered_at END,
    cancelled_at = CASE WHEN p_status = 'cancelled' AND cancelled_at IS NULL THEN NOW() ELSE cancelled_at END
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  -- Audit trail (table exists since migration 013).
  INSERT INTO order_status_history (order_id, from_status, to_status, reason)
  VALUES (p_order_id, v_from_status, p_status, p_reason);

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION update_order_status(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION update_order_status(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
