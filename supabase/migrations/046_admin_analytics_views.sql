-- Migration 046: Admin analytics views and RPC functions
-- Description: Comprehensive analytics views for dashboard statistics
-- Date: 2026-09-26

-- Drop existing views/functions to allow re-running
DROP FUNCTION IF EXISTS get_dashboard_overview(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;
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
DROP VIEW IF EXISTS admin_dashboard_overview CASCADE;
DROP VIEW IF EXISTS sales_by_category CASCADE;
DROP VIEW IF EXISTS sales_by_location CASCADE;
DROP VIEW IF EXISTS product_performance CASCADE;

-- ==============================================================================
-- DASHBOARD OVERVIEW VIEW
-- ==============================================================================
CREATE VIEW admin_dashboard_overview AS
WITH date_ranges AS (
  SELECT
    NOW() - INTERVAL '30 days' AS pp_start,
    NOW() AS pp_end,
    NOW() - INTERVAL '30 days' AS cp_start,
    NOW() AS cp_end
),
revenue_data AS (
  SELECT
    COALESCE(SUM(CASE WHEN o.status != 'cancelled' AND o.created_at >= dr.cp_start AND o.created_at <= dr.cp_end THEN o.total ELSE 0 END), 0) AS current_revenue,
    COALESCE(SUM(CASE WHEN o.status != 'cancelled' AND o.created_at >= dr.pp_start AND o.created_at <= dr.pp_end THEN o.total ELSE 0 END), 0) AS previous_revenue,
    COALESCE(SUM(CASE WHEN o.status IN ('delivered', 'shipped') THEN o.total ELSE 0 END), 0) AS gross_sales,
    COALESCE(SUM(CASE WHEN o.status = 'refunded' THEN -o.total ELSE 0 END), 0) AS total_refunds,
    COALESCE(SUM(o.discount_amount), 0) AS total_discounts
  FROM orders o
  CROSS JOIN date_ranges dr
),
order_data AS (
  SELECT
    COUNT(CASE WHEN o.created_at >= dr.cp_start AND o.created_at <= dr.cp_end THEN 1 END) AS current_orders,
    COUNT(CASE WHEN o.created_at >= dr.pp_start AND o.created_at <= dr.pp_end THEN 1 END) AS previous_orders,
    COUNT(CASE WHEN o.status = 'placed' OR o.status = 'processing' THEN 1 END) AS pending_orders,
    COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) AS completed_orders,
    COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) AS cancelled_orders
  FROM orders o
  CROSS JOIN date_ranges dr
),
customer_data AS (
  SELECT
    COUNT(DISTINCT CASE WHEN c.created_at >= dr.cp_start THEN c.id END) AS new_customers,
    COUNT(DISTINCT c.id) AS total_customers,
    COUNT(DISTINCT CASE WHEN EXISTS (
      SELECT 1 FROM orders o2
      WHERE o2.customer_id = c.id
      AND o2.status != 'cancelled'
      GROUP BY o2.customer_id
      HAVING COUNT(*) > 1
    ) THEN c.id END) AS returning_customers
  FROM customers c
  CROSS JOIN date_ranges dr
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
    COALESCE(SUM(CASE WHEN rf.status = 'completed' THEN rf.amount ELSE 0 END), 0) AS total_refund_amount
  FROM order_return_requests r
  LEFT JOIN refunds rf ON rf.order_id = r.order_id
  WHERE r.type = 'return'
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
  COALESCE(rd.total_refunds, 0) + COALESCE(ret.total_refund_amount, 0) AS total_refund_amount,
  ret.total_returns,
  CASE WHEN od.current_orders > 0 THEN rd.current_revenue / od.current_orders ELSE 0 END AS average_order_value,
  CASE WHEN od.current_orders > 0 THEN (ret.total_returns * 100.0) / od.current_orders ELSE 0 END AS return_rate,
  CASE WHEN rd.previous_revenue > 0 THEN ((rd.current_revenue - rd.previous_revenue) * 100.0) / rd.previous_revenue ELSE 0 END AS revenue_growth_percentage,
  CASE WHEN od.previous_orders > 0 THEN ((od.current_orders - od.previous_orders) * 100.0) / od.previous_orders ELSE 0 END AS order_growth_percentage
FROM revenue_data rd
CROSS JOIN order_data od
CROSS JOIN customer_data cd
CROSS JOIN product_data pd
CROSS JOIN return_data ret;

-- ==============================================================================
-- DASHBOARD OVERVIEW RPC FUNCTION
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
  order_growth_percentage NUMERIC
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
      COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) AS cancelled_orders
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
      COALESCE(SUM(CASE WHEN rf.status = 'completed' THEN rf.amount ELSE 0 END), 0) AS total_refund_amount
    FROM order_return_requests r
    LEFT JOIN refunds rf ON rf.order_id = r.order_id
    WHERE r.type = 'return'
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
    CASE WHEN od.previous_orders > 0 THEN ((od.current_orders - od.previous_orders) * 100.0) / od.previous_orders ELSE 0 END
  FROM revenue_data rd, order_data od, customer_data cd, product_data pd, return_data ret;
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_overview(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ==============================================================================
-- DAILY SALES RPC FUNCTION
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
BEGIN
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

GRANT EXECUTE ON FUNCTION get_daily_sales(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ==============================================================================
-- MONTHLY SALES RPC FUNCTION
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
BEGIN
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

GRANT EXECUTE ON FUNCTION get_monthly_sales(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ==============================================================================
-- TOP PRODUCTS RPC FUNCTION
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
BEGIN
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

GRANT EXECUTE ON FUNCTION get_top_products(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ==============================================================================
-- RETURN ANALYTICS RPC FUNCTION
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
  v_total_orders BIGINT;
  v_total_returned_orders BIGINT;
BEGIN
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
    -- Returns by product
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
    -- Returns by category
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'category', p.category,
          'count', COUNT(DISTINCT r.id)
        )
      ) FILTER (WHERE p.category IS NOT NULL),
      '[]'::JSONB
    ) AS returns_by_category,
    -- Returns by size
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

GRANT EXECUTE ON FUNCTION get_return_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ==============================================================================
-- CUSTOMER STATISTICS RPC FUNCTION
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
BEGIN
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
    -- Customers by location
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'city', c.city,
          'count', COUNT(*)
        )
      ) FILTER (WHERE c.city IS NOT NULL),
      '[]'::JSONB
    ) AS customers_by_location,
    -- Average order value
    (SELECT COALESCE(AVG(total), 0) FROM orders WHERE status != 'cancelled') AS average_order_value,
    -- Customer lifetime value
    (SELECT COALESCE(AGGREGATE_SUM, 0) FROM (
      SELECT SUM(o.total) AS AGGREGATE_SUM
      FROM orders o
      WHERE o.status != 'cancelled'
    ) sub) / NULLIF((SELECT COUNT(DISTINCT customer_id) FROM orders WHERE status != 'cancelled'), 0) AS customer_lifetime_value
  FROM customers c
  LEFT JOIN orders o ON c.id = o.customer_id AND o.status != 'cancelled';
END;
$$;

-- ==============================================================================
-- INVENTORY STATISTICS RPC FUNCTION
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
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(pi.stock_quantity * p.price), 0) AS total_inventory_value,
    COUNT(DISTINCT CASE WHEN pi.stock_quantity <= COALESCE(pi.low_stock_threshold, 5) THEN pi.id END) AS low_stock_count,
    COUNT(DISTINCT CASE WHEN pi.stock_quantity = 0 THEN pi.id END) AS out_of_stock_count,
    -- Inventory by category
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
    -- Stock status by product
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
-- REVENUE BREAKDOWN RPC FUNCTION
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
BEGIN
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
-- SALES BY CATEGORY RPC FUNCTION
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
BEGIN
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
-- SALES BY LOCATION RPC FUNCTION
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
BEGIN
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
-- ORDER STATUS DISTRIBUTION RPC FUNCTION
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
  v_total BIGINT;
BEGIN
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
-- PRODUCT PERFORMANCE VIEW
-- ==============================================================================
CREATE VIEW product_performance AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.slug AS product_slug,
  p.category,
  p.price,
  COALESCE(SUM(oi.quantity), 0) AS total_units_sold,
  COALESCE(SUM(oi.subtotal), 0) AS total_revenue,
  COUNT(DISTINCT oi.order_id) AS order_count,
  COUNT(DISTINCT CASE WHEN r.status = 'completed' THEN r.id END) AS return_count,
  COALESCE(SUM(pi.stock_quantity), 0) AS total_stock,
  COUNT(DISTINCT pi.id) AS variant_count,
  MAX(pi.stock_quantity) AS max_stock,
  MIN(pi.stock_quantity) AS min_stock,
  CASE WHEN MIN(pi.stock_quantity) <= COALESCE(MAX(pi.low_stock_threshold), 5) THEN TRUE ELSE FALSE END AS is_low_stock,
  CASE WHEN MIN(pi.stock_quantity) = 0 THEN TRUE ELSE FALSE END AS is_out_of_stock
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN order_return_requests r ON oi.order_id = r.order_id AND r.type = 'return' AND r.status = 'completed'
LEFT JOIN product_inventory pi ON p.id = pi.product_id
WHERE p.is_active = TRUE
GROUP BY p.id, p.name, p.slug, p.category, p.price;

-- ==============================================================================
-- PRODUCT PERFORMANCE VIEW CONTINUES
-- RLS is enforced via the backing tables and admin checks in the app layer.
-- ==============================================================================

-- ==============================================================================
-- SALES BY CATEGORY VIEW
-- ==============================================================================
CREATE VIEW sales_by_category AS
SELECT
  p.category,
  COUNT(DISTINCT oi.order_id) AS order_count,
  COALESCE(SUM(oi.subtotal), 0) AS revenue,
  COALESCE(SUM(oi.quantity), 0) AS units_sold,
  COUNT(DISTINCT p.id) AS product_count
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id
WHERE p.is_active = TRUE
GROUP BY p.category;

-- ==============================================================================
-- SALES BY LOCATION VIEW
-- ==============================================================================
CREATE VIEW sales_by_location AS
SELECT
  o.governorate,
  COUNT(DISTINCT o.id) AS order_count,
  COALESCE(SUM(CASE WHEN o.status NOT IN ('cancelled', 'refunded') THEN o.total ELSE 0 END), 0) AS revenue,
  COUNT(DISTINCT CASE WHEN o.customer_id IS NOT NULL THEN o.customer_id END) AS customer_count
FROM orders o
GROUP BY o.governorate;

-- ==============================================================================
-- GRANTS
-- ==============================================================================
GRANT EXECUTE ON FUNCTION get_customer_statistics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_revenue_breakdown(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_by_category(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_by_location(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_status_distribution(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
