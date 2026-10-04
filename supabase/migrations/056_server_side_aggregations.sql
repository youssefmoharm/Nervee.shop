-- Migration 056: Server-side aggregations for dashboard performance
-- Date: 2026-10-04
-- Severity: HIGH (P1)
--
-- ISSUE: The admin dashboard performs aggregations (daily series, best sellers)
-- client-side with .limit(1000) and .limit(1500) rows. As volume grows, this
-- becomes inaccurate and slow.
--
-- FIX: Add server-side RPCs that do proper aggregation on the database.

-- ==============================================================================
-- PART 1: Create get_daily_sales_summary RPC
-- ==============================================================================
-- This RPC returns daily revenue/Orders for the selected period with proper
-- date filtering and aggregation on the server side.

CREATE OR REPLACE FUNCTION get_daily_sales_summary(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  date TEXT,
  revenue BIGINT,
  orders BIGINT,
  units_sold BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: anonymous access denied' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS(SELECT 1 FROM admin_users WHERE user_id = v_caller_uid) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden: admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    TO_CHAR(date_series.day, 'YYYY-MM-DD') AS date,
    COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total ELSE 0 END), 0) AS revenue,
    COUNT(DISTINCT o.id) AS orders,
    COALESCE(SUM(oi.quantity), 0) AS units_sold
  FROM generate_series(p_start_date, p_end_date, INTERVAL '1 day') AS date_series(day)
  LEFT JOIN orders o ON DATE(o.created_at) = date_series.day::DATE AND o.status != 'cancelled'
  LEFT JOIN order_items oi ON o.id = oi.order_id
  GROUP BY date_series.day
  ORDER BY date_series.day;
END;
$$;

REVOKE ALL ON FUNCTION get_daily_sales_summary(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_daily_sales_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

-- ==============================================================================
-- PART 2: Create get_best_sellers RPC
-- ==============================================================================
-- This RPC returns top selling products with proper aggregation excluding
-- cancelled orders. Uses server-side LIMIT instead of client-side.

CREATE OR REPLACE FUNCTION get_best_sellers(
  p_limit INTEGER DEFAULT 5,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  product_id TEXT,
  product_name TEXT,
  quantity BIGINT,
  revenue BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: anonymous access denied' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS(SELECT 1 FROM admin_users WHERE user_id = v_caller_uid) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden: admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    oi.product_id,
    oi.product_name,
    COALESCE(SUM(oi.quantity), 0) AS quantity,
    COALESCE(SUM(oi.subtotal), 0) AS revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.status != 'cancelled'
    AND (p_start_date IS NULL OR oi.created_at >= p_start_date)
    AND (p_end_date IS NULL OR oi.created_at <= p_end_date)
  GROUP BY oi.product_id, oi.product_name
  ORDER BY quantity DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION get_best_sellers(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_best_sellers(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

-- ==============================================================================
-- PART 3: Create get_order_status_distribution_rpc RPC
-- ==============================================================================
-- This RPC returns order status distribution for the selected period.

CREATE OR REPLACE FUNCTION get_order_status_distribution_rpc(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  status TEXT,
  count BIGINT,
  percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
  v_total BIGINT;
BEGIN
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: anonymous access denied' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS(SELECT 1 FROM admin_users WHERE user_id = v_caller_uid) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden: admin access required' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM orders o
  WHERE o.created_at >= p_start_date AND o.created_at <= p_end_date;

  RETURN QUERY
  SELECT
    o.status,
    COUNT(*) AS count,
    CASE WHEN v_total > 0 THEN (COUNT(*) * 100.0) / v_total ELSE 0 END AS percentage
  FROM orders o
  WHERE o.created_at >= p_start_date AND o.created_at <= p_end_date
  GROUP BY o.status
  ORDER BY count DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_order_status_distribution_rpc(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_order_status_distribution_rpc(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

-- ==============================================================================
-- PART 4: Verification queries
-- ==============================================================================
-- Run these after migration to verify the RPCs work:

-- 1. Daily sales summary:
--    SELECT * FROM get_daily_sales_summary(NOW() - INTERVAL '7 days', NOW());

-- 2. Best sellers (top 5):
--    SELECT * FROM get_best_sellers(5, NOW() - INTERVAL '30 days', NOW());

-- 3. Best sellers (all time):
--    SELECT * FROM get_best_sellers(10);

-- 4. Order status distribution:
--    SELECT * FROM get_order_status_distribution_rpc(NOW() - INTERVAL '30 days', NOW());
-- ==============================================================================
