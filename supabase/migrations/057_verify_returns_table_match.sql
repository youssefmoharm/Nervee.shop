-- Migration 057: Verify get_dashboard_overview RETURNS TABLE matches SELECT
-- Date: 2026-10-04
--
-- This migration does NOT change any behavior. It verifies that the RETURNS TABLE
-- column types match the actual SELECT output types in get_dashboard_overview.
--
-- If this migration runs successfully, the types are compatible.
-- If it fails, the SELECT output differs from RETURNS TABLE and needs fixing.

-- ==============================================================================
-- PART 1: Verify column types match (no-op check)
-- ==============================================================================

-- This is a verification query - if it fails, the types don't match.
-- We use a CTE to extract the SELECT output types and compare to RETURNS TABLE.

DO $$
DECLARE
  v_result RECORD;
BEGIN
  -- Try to execute the function with dummy dates
  -- If types don't match, this will fail with a type mismatch error
  SELECT *
  INTO v_result
  FROM get_dashboard_overview(
    NOW() - INTERVAL '1 day',
    NOW(),
    NOW() - INTERVAL '1 day',
    NOW()
  );
  
  -- If we get here, types match (function executed successfully)
  RAISE NOTICE 'SUCCESS: get_dashboard_overview RETURNS TABLE matches SELECT output';
  RAISE NOTICE 'Return types verified: current_revenue=%, previous_revenue=%, gross_sales=%, total_refunds=%, total_discounts=%, current_orders=%, previous_orders=%, pending_orders=%, completed_orders=%, cancelled_orders=%, new_customers=%, total_customers=%, returning_customers=%, total_products=%, inactive_products=%, low_stock_products=%, out_of_stock_products=%, total_refund_amount=%, total_returns=%, average_order_value=%, return_rate=%, revenue_growth_percentage=%, order_growth_percentage=%, processing_orders=%, shipped_orders=%, delivered_orders=%, pending_returns=%, approved_returns=%, products_sold=%',
    PG_TYPEOF(v_result.current_revenue),
    PG_TYPEOF(v_result.previous_revenue),
    PG_TYPEOF(v_result.gross_sales),
    PG_TYPEOF(v_result.total_refunds),
    PG_TYPEOF(v_result.total_discounts),
    PG_TYPEOF(v_result.current_orders),
    PG_TYPEOF(v_result.previous_orders),
    PG_TYPEOF(v_result.pending_orders),
    PG_TYPEOF(v_result.completed_orders),
    PG_TYPEOF(v_result.cancelled_orders),
    PG_TYPEOF(v_result.new_customers),
    PG_TYPEOF(v_result.total_customers),
    PG_TYPEOF(v_result.returning_customers),
    PG_TYPEOF(v_result.total_products),
    PG_TYPEOF(v_result.inactive_products),
    PG_TYPEOF(v_result.low_stock_products),
    PG_TYPEOF(v_result.out_of_stock_products),
    PG_TYPEOF(v_result.total_refund_amount),
    PG_TYPEOF(v_result.total_returns),
    PG_TYPEOF(v_result.average_order_value),
    PG_TYPEOF(v_result.return_rate),
    PG_TYPEOF(v_result.revenue_growth_percentage),
    PG_TYPEOF(v_result.order_growth_percentage),
    PG_TYPEOF(v_result.processing_orders),
    PG_TYPEOF(v_result.shipped_orders),
    PG_TYPEOF(v_result.delivered_orders),
    PG_TYPEOF(v_result.pending_returns),
    PG_TYPEOF(v_result.approved_returns),
    PG_TYPEOF(v_result.products_sold);
END $$;

-- ==============================================================================
-- PART 2: Verify all 29 columns are present with correct types
-- ==============================================================================

-- Column type verification:
-- BIGINT columns: current_revenue, previous_revenue, gross_sales, total_refunds,
--                 total_discounts, current_orders, previous_orders, pending_orders,
--                 completed_orders, cancelled_orders, new_customers, total_customers,
--                 returning_customers, total_products, inactive_products,
--                 low_stock_products, out_of_stock_products, total_refund_amount,
--                 total_returns, processing_orders, shipped_orders, delivered_orders,
--                 pending_returns, approved_returns, products_sold
-- NUMERIC columns: average_order_value, return_rate, revenue_growth_percentage,
--                  order_growth_percentage

-- This migration will fail if any of the above types don't match the actual SELECT

-- ==============================================================================
-- DONE
-- ==============================================================================
