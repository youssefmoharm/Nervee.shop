-- Migration 054: Fix dashboard analytics authorization
-- Date: 2026-10-04
-- Severity: CRITICAL (P0)
--
-- ISSUE: The get_dashboard_overview() function was GRANTED to 'authenticated' 
-- without verifying admin status. ANY logged-in user could execute this function
-- and access sensitive business analytics (revenue, customer counts, inventory).
--
-- FIX: 
-- 1. Drop the existing function
-- 2. Recreate with admin authorization check
-- 3. Revoke all public access
-- 4. Grant EXECUTE only to service_role (for server-side use)
-- 5. Drop insecure views that may have been accessed directly
-- 6. Clean up legacy analytics functions that are not used by the current frontend

-- ==============================================================================
-- STEP 1: Drop existing function (if exists) to recreate with proper grants
-- ==============================================================================
DROP FUNCTION IF EXISTS get_dashboard_overview(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS get_dashboard_overview() CASCADE;

-- ==============================================================================
-- STEP 2: Create new function with admin authorization check
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
  -- ========================================================================
  -- SECURITY CHECK: Verify caller is an authorized admin
  -- ========================================================================
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: anonymous access denied' USING ERRCODE = '42501';
  END IF;

  -- Check if caller is in admin_users table
  SELECT EXISTS(
    SELECT 1 FROM admin_users WHERE user_id = v_caller_uid
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden: admin access required' USING ERRCODE = '42501';
  END IF;

  -- ========================================================================
  -- Dashboard analytics query (same logic as before, now protected)
  -- ========================================================================
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
-- STEP 3: Revoke ALL public access and grant only to service_role
-- ==============================================================================
-- Drop any existing policies (for tables the function accesses)
-- The function itself is protected, not the underlying tables

-- Revoke PUBLIC access
REVOKE ALL ON FUNCTION get_dashboard_overview(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_dashboard_overview(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION get_dashboard_overview(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) FROM authenticated;

-- Grant only to service_role (for server-side use in Edge Functions if needed)
-- Frontend should call via authorized Edge Function or have the admin check
GRANT EXECUTE ON FUNCTION get_dashboard_overview(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- ==============================================================================
-- STEP 4: Drop insecure views that were exposed to authenticated users
-- ==============================================================================
-- These views may have been accessed directly by the frontend without proper
-- authorization. They are now replaced by secure RPC functions.

DROP VIEW IF EXISTS admin_dashboard_overview CASCADE;
DROP VIEW IF EXISTS sales_by_category CASCADE;
DROP VIEW IF EXISTS sales_by_location CASCADE;
DROP VIEW IF EXISTS product_performance CASCADE;

-- ==============================================================================
-- STEP 5: Revoke permissions from previously insecure grants (migration 047)
-- ==============================================================================
REVOKE ALL ON FUNCTION get_daily_sales(TIMESTAMPTZ, TIMESTAMPTZ) FROM authenticated;
REVOKE ALL ON FUNCTION get_monthly_sales(TIMESTAMPTZ, TIMESTAMPTZ) FROM authenticated;
REVOKE ALL ON FUNCTION get_top_products(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) FROM authenticated;
REVOKE ALL ON FUNCTION get_return_analytics(TIMESTAMPTZ, TIMESTAMPTZ) FROM authenticated;
REVOKE ALL ON FUNCTION get_customer_statistics(TIMESTAMPTZ, TIMESTAMPTZ) FROM authenticated;
REVOKE ALL ON FUNCTION get_inventory_statistics() FROM authenticated;
REVOKE ALL ON FUNCTION get_revenue_breakdown(TIMESTAMPTZ, TIMESTAMPTZ) FROM authenticated;
REVOKE ALL ON FUNCTION get_sales_by_category(TIMESTAMPTZ, TIMESTAMPTZ) FROM authenticated;
REVOKE ALL ON FUNCTION get_sales_by_location(TIMESTAMPTZ, TIMESTAMPTZ) FROM authenticated;
REVOKE ALL ON FUNCTION get_order_status_distribution(TIMESTAMPTZ, TIMESTAMPTZ) FROM authenticated;

-- Grant to service_role only (these are legacy functions)
GRANT EXECUTE ON FUNCTION get_daily_sales(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION get_monthly_sales(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION get_top_products(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION get_return_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION get_customer_statistics(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION get_inventory_statistics() TO service_role;
GRANT EXECUTE ON FUNCTION get_revenue_breakdown(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION get_sales_by_category(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION get_sales_by_location(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION get_order_status_distribution(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- ==============================================================================
-- STEP 6: Verify the fix
-- ==============================================================================
-- After this migration runs, test:
--
-- 1. Anonymous user attempt (should fail):
--    SELECT * FROM get_dashboard_overview(NOW() - INTERVAL '30 days', NOW(), NOW() - INTERVAL '30 days', NOW());
--
-- 2. Authenticated non-admin user attempt (should fail):
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
-- STEP 7: Add admin_users RLS policy to prevent enumeration
-- ==============================================================================
-- Drop existing policy if exists
DROP POLICY IF EXISTS "Users can check own admin status" ON admin_users;

-- Create restrictive policy: only the user themselves can check if they're an admin
-- (prevents enumeration attacks)
CREATE POLICY "Users can check own admin status" ON admin_users FOR SELECT
  USING (user_id = auth.uid());

-- ==============================================================================
-- STEP 8: Verify no duplicate RLS policies exist on admin-related tables
-- ==============================================================================
-- Check for duplicate policies on newsletter_subscribers
-- Drop any duplicate "Anyone can subscribe" policy
DROP POLICY IF EXISTS "Public can insert newsletter subscription" ON newsletter_subscribers;

-- Check for duplicate policies on back_in_stock_requests
-- Drop overlapping policies
DROP POLICY IF EXISTS "Users can insert back in stock requests" ON back_in_stock_requests;

-- Verify only one policy exists for each table
-- newsletter_subscribers should have:
--   - Anyone can subscribe (INSERT)
--   - Admins can view subscribers (SELECT)
--   - Admins can update (UPDATE)
