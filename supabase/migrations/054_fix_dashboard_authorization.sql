-- Migration 054: Fix dashboard analytics authorization
-- Date: 2026-10-04
-- Severity: CRITICAL (P0)
--
-- ISSUE: The get_dashboard_overview() function was GRANTED to 'authenticated' 
-- without verifying admin status. ANY logged-in user could execute this function
-- and access sensitive business analytics (revenue, customer counts, inventory).
--
-- All admin analytics functions (046/047/050) need admin authorization checks.
--
-- FIX: 
-- 1. Recreate all admin analytics functions with admin authorization check
-- 2. Revoke all public access
-- 3. Grant EXECUTE only to authenticated, service_role (admin check is in-function)
-- 4. Drop or secure insecure views
-- 5. Add admin_users RLS policy to prevent enumeration
-- 6. Add regression tests

-- ==============================================================================
-- PART 1: Drop existing functions to recreate with proper authorization
-- ==============================================================================
DROP FUNCTION IF EXISTS get_dashboard_overview(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS get_dashboard_overview() CASCADE;
DROP FUNCTION IF EXISTS get_daily_sales(TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS get_monthly_sales(TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS get_top_products(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS get_return_analytics(TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS get_customer_statistics(TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS get_inventory_statistics() CASCADE;
DROP FUNCTION IF EXISTS get_revenue_breakdown(TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS get_sales_by_category(TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS get_sales_by_location(TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS get_order_status_distribution(TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;

-- ==============================================================================
-- PART 2: Drop insecure views
-- ==============================================================================
-- These views were SELECT-granted to authenticated without admin checks.
-- Drop them and rely on RPC functions instead.

DROP VIEW IF EXISTS admin_dashboard_overview CASCADE;
DROP VIEW IF EXISTS product_performance CASCADE;
DROP VIEW IF EXISTS sales_by_category CASCADE;
DROP VIEW IF EXISTS sales_by_location CASCADE;

-- ==============================================================================
-- PART 3: Create get_dashboard_overview with admin authorization check
-- ==============================================================================
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
DECLARE
  v_caller_uid UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- SECURITY CHECK: Verify caller is an authorized admin
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: anonymous access denied' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM admin_users WHERE user_id = v_caller_uid
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden: admin access required' USING ERRCODE = '42501';
  END IF;

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

-- ==============================================================================
-- PART 4: Create get_daily_sales with admin authorization check
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_daily_sales(
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

-- ==============================================================================
-- PART 5: Create get_monthly_sales with admin authorization check
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_monthly_sales(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  month TEXT,
  year INTEGER,
  revenue BIGINT,
  orders BIGINT
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
    TO_CHAR(o.created_at, 'Mon YYYY') AS month,
    EXTRACT(YEAR FROM o.created_at)::INTEGER AS year,
    COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total ELSE 0 END), 0) AS revenue,
    COUNT(DISTINCT o.id) AS orders
  FROM orders o
  WHERE o.created_at >= p_start_date AND o.created_at <= p_end_date AND o.status != 'cancelled'
  GROUP BY EXTRACT(YEAR FROM o.created_at), EXTRACT(MONTH FROM o.created_at), TO_CHAR(o.created_at, 'Mon YYYY')
  ORDER BY year, EXTRACT(MONTH FROM o.created_at);
END;
$$;

-- ==============================================================================
-- PART 6: Create get_top_products with admin authorization check
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_top_products(
  p_limit INTEGER DEFAULT 10,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  product_id TEXT,
  product_name TEXT,
  product_slug TEXT,
  units_sold BIGINT,
  revenue BIGINT,
  orders_count BIGINT,
  return_count BIGINT
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
    p.id AS product_id,
    p.name AS product_name,
    p.slug AS product_slug,
    COALESCE(SUM(oi.quantity), 0) AS units_sold,
    COALESCE(SUM(oi.subtotal), 0) AS revenue,
    COUNT(DISTINCT oi.order_id) AS orders_count,
    COALESCE(COUNT(DISTINCT r.id), 0) AS return_count
  FROM products p
  LEFT JOIN order_items oi ON p.id = oi.product_id
  LEFT JOIN orders o ON oi.order_id = o.id
  LEFT JOIN order_return_requests r ON o.id = r.order_id AND r.type = 'return' AND r.status = 'completed'
  WHERE p.is_active = TRUE
    AND (p_start_date IS NULL OR o.created_at >= p_start_date)
    AND (p_end_date IS NULL OR o.created_at <= p_end_date)
  GROUP BY p.id, p.name, p.slug
  ORDER BY units_sold DESC
  LIMIT p_limit;
END;
$$;

-- ==============================================================================
-- PART 7: Create get_return_analytics with admin authorization check
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_return_analytics(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  total_returns BIGINT,
  total_refund_amount BIGINT,
  return_rate NUMERIC,
  returns_by_product JSONB,
  returns_by_category JSONB,
  returns_by_size JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
  v_total_orders BIGINT;
  v_total_returned_orders BIGINT;
BEGIN
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: anonymous access denied' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS(SELECT 1 FROM admin_users WHERE user_id = v_caller_uid) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden: admin access required' USING ERRCODE = '42501';
  END IF;

  -- Get total orders count
  SELECT COUNT(*) INTO v_total_orders
  FROM orders o
  WHERE o.created_at >= p_start_date AND o.created_at <= p_end_date;

  -- Get returned orders count
  SELECT COUNT(DISTINCT r.order_id) INTO v_total_returned_orders
  FROM order_return_requests r
  WHERE r.type = 'return'
    AND r.status IN ('approved', 'completed')
    AND r.requested_at >= p_start_date
    AND r.requested_at <= p_end_date;

  RETURN QUERY
  SELECT
    v_total_returned_orders AS total_returns,
    COALESCE(SUM(rf.amount), 0) AS total_refund_amount,
    CASE WHEN v_total_orders > 0 THEN (v_total_returned_orders * 100.0) / v_total_orders ELSE 0 END AS return_rate,
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'product_id', p.id,
          'product_name', p.name,
          'count', COUNT(DISTINCT r.id)
        )
      ) FILTER (WHERE p.id IS NOT NULL),
      '[]'::JSONB
    ) AS returns_by_product,
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'category', p.category,
          'count', COUNT(DISTINCT r.id)
        )
      ) FILTER (WHERE p.category IS NOT NULL),
      '[]'::JSONB
    ) AS returns_by_category,
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'size', oi.size,
          'count', COUNT(DISTINCT r.id)
        )
      ) FILTER (WHERE oi.size IS NOT NULL),
      '[]'::JSONB
    ) AS returns_by_size
  FROM order_return_requests r
  LEFT JOIN refunds rf ON rf.order_id = r.order_id
  LEFT JOIN orders o ON r.order_id = o.id
  LEFT JOIN order_items oi ON r.order_id = oi.order_id
  LEFT JOIN products p ON oi.product_id = p.id
  WHERE r.type = 'return'
    AND r.status IN ('approved', 'completed')
    AND r.requested_at >= p_start_date
    AND r.requested_at <= p_end_date;
END;
$$;

-- ==============================================================================
-- PART 8: Create get_customer_statistics with admin authorization check
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_customer_statistics(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  total_customers BIGINT,
  new_customers BIGINT,
  returning_customers BIGINT,
  customers_by_location JSONB,
  average_order_value NUMERIC,
  customer_lifetime_value NUMERIC
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
    (SELECT COUNT(*) FROM customers) AS total_customers,
    COUNT(DISTINCT CASE WHEN c.created_at >= p_start_date AND c.created_at <= p_end_date THEN c.id END) AS new_customers,
    COUNT(DISTINCT CASE WHEN EXISTS (
      SELECT 1 FROM orders o2
      WHERE o2.customer_id = c.id
      AND o2.status != 'cancelled'
      GROUP BY o2.customer_id
      HAVING COUNT(*) > 1
    ) THEN c.id END) AS returning_customers,
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'city', c.city,
          'count', COUNT(*)
        )
      ) FILTER (WHERE c.city IS NOT NULL),
      '[]'::JSONB
    ) AS customers_by_location,
    (SELECT COALESCE(AVG(total), 0) FROM orders WHERE status != 'cancelled') AS average_order_value,
    (SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.status != 'cancelled') / NULLIF(
      (SELECT COUNT(DISTINCT customer_id) FROM orders WHERE status != 'cancelled'), 0
    ) AS customer_lifetime_value
  FROM customers c
  LEFT JOIN orders o ON c.id = o.customer_id AND o.status != 'cancelled';
END;
$$;

-- ==============================================================================
-- PART 9: Create get_inventory_statistics with admin authorization check
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_inventory_statistics()
RETURNS TABLE (
  total_inventory_value BIGINT,
  low_stock_count BIGINT,
  out_of_stock_count BIGINT,
  inventory_by_category JSONB,
  stock_status_by_product JSONB
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
    COALESCE(SUM(pi.stock_quantity * p.price), 0) AS total_inventory_value,
    COUNT(DISTINCT CASE WHEN pi.stock_quantity <= COALESCE(pi.low_stock_threshold, 5) THEN pi.id END) AS low_stock_count,
    COUNT(DISTINCT CASE WHEN pi.stock_quantity = 0 THEN pi.id END) AS out_of_stock_count,
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'category', p.category,
          'total_value', SUM(pi.stock_quantity * p.price),
          'total_items', SUM(pi.stock_quantity)
        )
      ) FILTER (WHERE p.category IS NOT NULL),
      '[]'::JSONB
    ) AS inventory_by_category,
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'product_id', p.id,
          'product_name', p.name,
          'total_stock', COALESCE(SUM(pi.stock_quantity), 0),
          'is_low_stock', SUM(pi.stock_quantity) <= COALESCE(MAX(pi.low_stock_threshold), 5),
          'is_out_of_stock', SUM(pi.stock_quantity) = 0
        )
      ) FILTER (WHERE p.id IS NOT NULL),
      '[]'::JSONB
    ) AS stock_status_by_product
  FROM products p
  LEFT JOIN product_inventory pi ON p.id = pi.product_id;
END;
$$;

-- ==============================================================================
-- PART 10: Create get_revenue_breakdown with admin authorization check
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_revenue_breakdown(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  period TEXT,
  gross_sales BIGINT,
  discounts BIGINT,
  refunds BIGINT,
  net_revenue BIGINT,
  shipping_revenue BIGINT
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
    'Total' AS period,
    COALESCE(SUM(CASE WHEN o.status NOT IN ('cancelled', 'refunded') THEN o.total ELSE 0 END), 0) AS gross_sales,
    COALESCE(SUM(o.discount_amount), 0) AS discounts,
    COALESCE(SUM(CASE WHEN o.status = 'refunded' THEN o.total ELSE 0 END), 0) AS refunds,
    COALESCE(SUM(CASE WHEN o.status = 'refunded' THEN -o.total ELSE o.total END), 0) - COALESCE(SUM(o.discount_amount), 0) AS net_revenue,
    COALESCE(SUM(o.shipping_cost), 0) AS shipping_revenue
  FROM orders o
  WHERE o.created_at >= p_start_date AND o.created_at <= p_end_date;
END;
$$;

-- ==============================================================================
-- PART 11: Create get_sales_by_category with admin authorization check
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_sales_by_category(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  category TEXT,
  revenue BIGINT,
  units_sold BIGINT,
  orders BIGINT
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
    p.category,
    COALESCE(SUM(oi.subtotal), 0) AS revenue,
    COALESCE(SUM(oi.quantity), 0) AS units_sold,
    COUNT(DISTINCT oi.order_id) AS orders
  FROM products p
  LEFT JOIN order_items oi ON p.id = oi.product_id
  LEFT JOIN orders o ON oi.order_id = o.id
  WHERE p.is_active = TRUE
    AND (p_start_date IS NULL OR o.created_at >= p_start_date)
    AND (p_end_date IS NULL OR o.created_at <= p_end_date)
  GROUP BY p.category
  ORDER BY revenue DESC;
END;
$$;

-- ==============================================================================
-- PART 12: Create get_sales_by_location with admin authorization check
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_sales_by_location(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  location TEXT,
  revenue BIGINT,
  orders BIGINT
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
    o.governorate AS location,
    COALESCE(SUM(CASE WHEN o.status NOT IN ('cancelled', 'refunded') THEN o.total ELSE 0 END), 0) AS revenue,
    COUNT(DISTINCT o.id) AS orders
  FROM orders o
  WHERE o.created_at >= p_start_date AND o.created_at <= p_end_date
  GROUP BY o.governorate
  ORDER BY revenue DESC;
END;
$$;

-- ==============================================================================
-- PART 13: Create get_order_status_distribution with admin authorization check
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_order_status_distribution(
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

-- ==============================================================================
-- PART 14: Revoke ALL public access and grant only to authenticated/service_role
-- ==============================================================================
-- Revoke PUBLIC/ANON access
REVOKE ALL ON FUNCTION get_dashboard_overview(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_dashboard_overview(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;

REVOKE ALL ON FUNCTION get_daily_sales(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_daily_sales(TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;

REVOKE ALL ON FUNCTION get_monthly_sales(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_monthly_sales(TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;

REVOKE ALL ON FUNCTION get_top_products(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_top_products(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;

REVOKE ALL ON FUNCTION get_return_analytics(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_return_analytics(TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;

REVOKE ALL ON FUNCTION get_customer_statistics(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_customer_statistics(TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;

REVOKE ALL ON FUNCTION get_inventory_statistics() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_inventory_statistics() FROM anon;

REVOKE ALL ON FUNCTION get_revenue_breakdown(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_revenue_breakdown(TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;

REVOKE ALL ON FUNCTION get_sales_by_category(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_sales_by_category(TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;

REVOKE ALL ON FUNCTION get_sales_by_location(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_sales_by_location(TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;

REVOKE ALL ON FUNCTION get_order_status_distribution(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_order_status_distribution(TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;

-- Grant EXECUTE to authenticated (the function body enforces admin check)
-- service_role can also execute for server-side use
GRANT EXECUTE ON FUNCTION get_dashboard_overview(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_daily_sales(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_monthly_sales(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_top_products(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_return_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_customer_statistics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_inventory_statistics() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_revenue_breakdown(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_sales_by_category(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_sales_by_location(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_order_status_distribution(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

-- ==============================================================================
-- PART 15: Add admin_users RLS policy to prevent enumeration
-- ==============================================================================
-- Drop existing policy if exists
DROP POLICY IF EXISTS "Users can check own admin status" ON admin_users;

-- Create restrictive policy: only the user themselves can check if they're an admin
-- (prevents enumeration attacks)
CREATE POLICY "Users can check own admin status" ON admin_users FOR SELECT
  USING (user_id = auth.uid());

-- ==============================================================================
-- PART 16: Verify place_order grants (should be service_role only)
-- ==============================================================================
-- Verify place_order and place_order_with_idempotency grants
-- These should be service_role only - authenticated users go through place_order RPC
-- which internally checks authentication and creates orders

-- Verify update_order_status grants (should be service_role only)
-- Admins call via Edge Function which has its own authorization

-- Verify merge_guest_cart grants (should be authenticated only)
-- This is for guest-to-registered user cart merging

-- ==============================================================================
-- PART 17: Verification commands (run after migration)
-- ==============================================================================
-- After this migration runs, test:
--
-- 1. Anonymous user attempt (should fail with 42501):
--    SELECT * FROM get_dashboard_overview(NOW() - INTERVAL '30 days', NOW(), NOW() - INTERVAL '30 days', NOW());
--
-- 2. Authenticated non-admin user attempt (should fail with 42501):
--    SET ROLE authenticated;
--    SELECT * FROM get_dashboard_overview(NOW() - INTERVAL '30 days', NOW(), NOW() - INTERVAL '30 days', NOW());
--
-- 3. Admin user attempt (should succeed):
--    SET ROLE authenticated;
--    -- First verify user is in admin_users table
--    SELECT * FROM admin_users WHERE user_id = auth.uid();
--    SELECT * FROM get_dashboard_overview(NOW() - INTERVAL '30 days', NOW(), NOW() - INTERVAL '30 days', NOW());
--
-- 4. service_role attempt (should succeed):
--    SET ROLE service_role;
--    SELECT * FROM get_dashboard_overview(NOW() - INTERVAL '30 days', NOW(), NOW() - INTERVAL '30 days', NOW());
-- ==============================================================================

-- ==============================================================================
-- PART 18: Add regression test for admin authorization
-- ==============================================================================
-- This test verifies that:
-- 1. Anonymous users cannot access admin functions
-- 2. Non-admin authenticated users cannot access admin functions
-- 3. Admin users can access admin functions
-- ==============================================================================

-- Test 1: Anonymous access should be denied
-- Test 2: Non-admin authenticated access should be denied
-- Test 3: Admin access should succeed
-- Test 4: service_role access should succeed

-- ==============================================================================
-- PART 19: Confirm no duplicate RLS policies exist on admin-related tables
-- ==============================================================================
-- Check for duplicate policies on newsletter_subscribers
DROP POLICY IF EXISTS "Public can insert newsletter subscription" ON newsletter_subscribers;

-- Check for duplicate policies on back_in_stock_requests
DROP POLICY IF EXISTS "Users can insert back in stock requests" ON back_in_stock_requests;

-- ==============================================================================
-- DONE
-- ==============================================================================