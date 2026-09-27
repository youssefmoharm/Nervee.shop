-- Migration 050: Admin operations hardening
-- Date: 2026-09-27
--
-- Fixes four audited problems in one place:
--   1. `update_inventory_with_lock` was called by adminService.setInventory
--      but never created anywhere — admin inventory updates via the RPC
--      failed with "function does not exist". Create it: row-locked,
--      admin-gated, negative-stock-proof, in_stock kept consistent.
--   2. `update_order_status` was only a 5-parameter function, but the
--      update-order-status edge function passes `p_changed_by` (6 args) —
--      every admin status change failed function resolution. Recreate with
--      the audit column and an authoritative transition map (the UI map is
--      now derived from the same rules), closing two server-side holes:
--      cancelled↔refunded re-entry and state skipping (placed→delivered).
--   3. Migration 043 added an AFTER UPDATE trigger that double-logs
--      history rows on top of the RPC's own insert. Drop it — the RPC is
--      the single writer (reason + changed_by recorded).
--   4. `discount_codes.discount_value` had no upper bound for percentage
--      codes (500% off was storable; totals were only saved by a floor in
--      place_order). Clamp existing rows and constrain future ones.

-- ============================================================================
-- 1) INVENTORY: locked, admin-only, non-negative absolute stock set
-- ============================================================================

CREATE OR REPLACE FUNCTION update_inventory_with_lock(
  p_product_id TEXT,
  p_size TEXT,
  p_new_quantity INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF p_size IS NULL OR length(trim(p_size)) = 0 THEN
    RAISE EXCEPTION 'size is required' USING ERRCODE = 'P0001';
  END IF;

  IF p_new_quantity IS NULL OR p_new_quantity < 0 THEN
    RAISE EXCEPTION 'Stock quantity cannot be negative (got %)', p_new_quantity
      USING ERRCODE = 'P0001';
  END IF;

  -- Upsert under a row lock so a concurrent place_order decrement can never
  -- be overwritten by a stale admin write without this function waiting:
  -- whichever transaction commits last wins, but the CHECK (stock >= 0) and
  -- the FOR UPDATE serialization keep the row consistent throughout.
  INSERT INTO product_inventory (product_id, size, stock_quantity, in_stock)
  VALUES (p_product_id, trim(p_size), p_new_quantity, p_new_quantity > 0)
  ON CONFLICT (product_id, size) DO UPDATE
    SET stock_quantity = EXCLUDED.stock_quantity,
        in_stock = EXCLUDED.in_stock;
END;
$$;

-- products.id / product_inventory.product_id are TEXT (slug PKs), hence TEXT above.
REVOKE ALL ON FUNCTION update_inventory_with_lock(TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
-- Authenticated callers are gated inside the function (admin_users check);
-- RLS alone would not protect a SECURITY DEFINER body.
GRANT EXECUTE ON FUNCTION update_inventory_with_lock(TEXT, TEXT, INTEGER)
  TO authenticated, service_role;

-- ============================================================================
-- 2) ORDER STATUS: authoritative transitions + audit column
-- ============================================================================

-- The edge function invokes the 6-parameter form; retire the 5-parameter
-- overload so resolution can never fall back to the un-audited version.
DROP FUNCTION IF EXISTS update_order_status(UUID, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION update_order_status(
  p_order_id UUID,
  p_status TEXT,
  p_tracking_number TEXT DEFAULT NULL,
  p_tracking_url TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_changed_by UUID DEFAULT NULL
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

  -- Authoritative transition map. Must stay in sync with
  -- src/lib/adminOrders.ts (unit-tested against this contract):
  --   placed     -> processing, cancelled
  --   processing -> shipped, cancelled
  --   shipped    -> delivered, cancelled
  --   delivered  -> refunded
  --   cancelled / refunded are terminal (no cancelled<->refunded shuffle,
  --   no un-cancelling, no skipping placed -> delivered).
  IF NOT (
    (v_from_status = 'placed'       AND p_status IN ('processing', 'cancelled')) OR
    (v_from_status = 'processing'   AND p_status IN ('shipped', 'cancelled')) OR
    (v_from_status = 'shipped'      AND p_status IN ('delivered', 'cancelled')) OR
    (v_from_status = 'delivered'    AND p_status IN ('refunded')) OR
    (v_from_status = p_status)
  ) THEN
    RAISE EXCEPTION 'Cannot move order from % to %', v_from_status, p_status
      USING ERRCODE = 'P0001';
  END IF;

  -- Restock once, only on the transition INTO cancelled/refunded.
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

  -- Single audit writer (migration 043's duplicate trigger is dropped below).
  IF v_from_status IS DISTINCT FROM p_status THEN
    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, reason)
    VALUES (p_order_id, v_from_status, p_status, p_changed_by, p_reason);
  END IF;

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION update_order_status(UUID, TEXT, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION update_order_status(UUID, TEXT, TEXT, TEXT, TEXT, UUID)
  TO service_role;

-- ============================================================================
-- 3) Drop the duplicate status-history trigger (RPC owns the audit trail)
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_order_status_history ON orders;
DROP FUNCTION IF EXISTS update_order_status_history();

-- ============================================================================
-- 4) Discounts: percentage codes are 1..100 only
-- ============================================================================

-- Clamp any existing out-of-range rows before the constraint lands.
UPDATE discount_codes
SET discount_value = 100
WHERE discount_type = 'percentage' AND discount_value > 100;

UPDATE discount_codes
SET discount_value = 1
WHERE discount_type = 'percentage' AND discount_value < 1;

ALTER TABLE discount_codes DROP CONSTRAINT IF EXISTS valid_percentage_discount;
ALTER TABLE discount_codes ADD CONSTRAINT valid_percentage_discount
  CHECK (discount_type <> 'percentage' OR (discount_value BETWEEN 1 AND 100));

-- ============================================================================
-- 5) Dashboard overview: operational columns the admin UI actually needs
-- =============================================================================

DROP FUNCTION IF EXISTS get_dashboard_overview(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;

CREATE OR REPLACE FUNCTION get_dashboard_overview(
  p_previous_period_start TIMESTAMPTZ,
  p_previous_period_end TIMESTAMPTZ,
  p_current_period_start TIMESTAMPTZ,
  p_current_period_end TIMESTAMPTZ
)
RETURNS TABLE (
  current_revenue BIGINT,
  previous_revenue BIGINT,
  gross_sales BIGINT,
  total_refunds BIGINT,
  total_discounts BIGINT,
  current_orders BIGINT,
  previous_orders BIGINT,
  pending_orders BIGINT,
  completed_orders BIGINT,
  cancelled_orders BIGINT,
  new_customers BIGINT,
  total_customers BIGINT,
  returning_customers BIGINT,
  total_products BIGINT,
  inactive_products BIGINT,
  low_stock_products BIGINT,
  out_of_stock_products BIGINT,
  total_refund_amount BIGINT,
  total_returns BIGINT,
  average_order_value NUMERIC,
  return_rate NUMERIC,
  revenue_growth_percentage NUMERIC,
  order_growth_percentage NUMERIC,
  processing_orders BIGINT,
  shipped_orders BIGINT,
  delivered_orders BIGINT,
  pending_returns BIGINT,
  approved_returns BIGINT,
  products_sold BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH revenue_data AS (
    SELECT
      COALESCE(SUM(CASE WHEN o.status != 'cancelled' AND o.created_at >= p_current_period_start AND o.created_at <= p_current_period_end THEN o.total ELSE 0 END), 0) AS current_revenue,
      COALESCE(SUM(CASE WHEN o.status != 'cancelled' AND o.created_at >= p_previous_period_start AND o.created_at <= p_previous_period_end THEN o.total ELSE 0 END), 0) AS previous_revenue,
      COALESCE(SUM(CASE WHEN o.status IN ('delivered', 'shipped') THEN o.total ELSE 0 END), 0) AS gross_sales,
      COALESCE(SUM(CASE WHEN o.status = 'refunded' THEN -o.total ELSE 0 END), 0) AS total_refunds,
      COALESCE(SUM(o.discount_amount), 0) AS total_discounts
    FROM orders o
  ),
  order_data AS (
    SELECT
      COUNT(CASE WHEN o.created_at >= p_current_period_start AND o.created_at <= p_current_period_end THEN 1 END) AS current_orders,
      COUNT(CASE WHEN o.created_at >= p_previous_period_start AND o.created_at <= p_previous_period_end THEN 1 END) AS previous_orders,
      COUNT(CASE WHEN o.status = 'placed' OR o.status = 'processing' THEN 1 END) AS pending_orders,
      COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) AS completed_orders,
      COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) AS cancelled_orders,
      COUNT(CASE WHEN o.status = 'processing' THEN 1 END) AS processing_orders,
      COUNT(CASE WHEN o.status = 'shipped' THEN 1 END) AS shipped_orders,
      COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) AS delivered_orders
    FROM orders o
  ),
  customer_data AS (
    SELECT
      COUNT(DISTINCT CASE WHEN c.created_at >= p_current_period_start THEN c.id END) AS new_customers,
      COUNT(DISTINCT c.id) AS total_customers,
      COUNT(DISTINCT CASE WHEN EXISTS (
        SELECT 1 FROM orders o2
        WHERE o2.customer_id = c.id
        AND o2.status != 'cancelled'
        GROUP BY o2.customer_id
        HAVING COUNT(*) > 1
      ) THEN c.id END) AS returning_customers
    FROM customers c
  ),
  product_data AS (
    SELECT
      COUNT(*) AS total_products,
      COUNT(CASE WHEN p.is_active = FALSE THEN 1 END) AS inactive_products,
      COUNT(DISTINCT CASE WHEN pi.stock_quantity <= COALESCE(pi.low_stock_threshold, 5) THEN p.id END) AS low_stock_products,
      COUNT(DISTINCT CASE WHEN pi.stock_quantity = 0 THEN p.id END) AS out_of_stock_products
    FROM products p
    LEFT JOIN product_inventory pi ON p.id = pi.product_id
  ),
  return_data AS (
    SELECT
      COUNT(*) AS total_returns,
      COALESCE(SUM(CASE WHEN rf.status = 'completed' THEN rf.amount ELSE 0 END), 0) AS total_refund_amount,
      COUNT(CASE WHEN r.status = 'pending' THEN 1 END) AS pending_returns,
      COUNT(CASE WHEN r.status = 'approved' THEN 1 END) AS approved_returns
    FROM order_return_requests r
    LEFT JOIN refunds rf ON rf.order_id = r.order_id
    WHERE r.type = 'return'
  ),
  items_data AS (
    SELECT COALESCE(SUM(oi.quantity), 0) AS products_sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status != 'cancelled'
  )
  SELECT
    rd.current_revenue,
    rd.previous_revenue,
    rd.gross_sales,
    rd.total_refunds,
    rd.total_discounts,
    od.current_orders,
    od.previous_orders,
    od.pending_orders,
    od.completed_orders,
    od.cancelled_orders,
    cd.new_customers,
    cd.total_customers,
    cd.returning_customers,
    pd.total_products,
    pd.inactive_products,
    pd.low_stock_products,
    pd.out_of_stock_products,
    COALESCE(rd.total_refunds, 0) + COALESCE(ret.total_refund_amount, 0),
    ret.total_returns,
    CASE WHEN od.current_orders > 0 THEN rd.current_revenue::NUMERIC / od.current_orders ELSE 0 END,
    CASE WHEN od.current_orders > 0 THEN (ret.total_returns * 100.0) / od.current_orders ELSE 0 END,
    CASE WHEN rd.previous_revenue > 0 THEN ((rd.current_revenue - rd.previous_revenue) * 100.0) / rd.previous_revenue ELSE 0 END,
    CASE WHEN od.previous_orders > 0 THEN ((od.current_orders - od.previous_orders) * 100.0) / od.previous_orders ELSE 0 END,
    od.processing_orders,
    od.shipped_orders,
    od.delivered_orders,
    ret.pending_returns,
    ret.approved_returns,
    idata.products_sold
  FROM revenue_data rd, order_data od, customer_data cd, product_data pd, return_data ret,
       items_data idata;
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_overview(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated, service_role;
