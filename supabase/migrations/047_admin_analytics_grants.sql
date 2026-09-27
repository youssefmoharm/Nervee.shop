-- Migration 047: Grant permissions for analytics functions
-- Date: 2026-09-26

-- Grant execute permissions on analytics functions
GRANT EXECUTE ON FUNCTION get_dashboard_overview(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_sales(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_sales(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_products(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_return_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_statistics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_revenue_breakdown(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_by_category(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_by_location(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_status_distribution(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Grant select on views
GRANT SELECT ON admin_dashboard_overview TO authenticated;
GRANT SELECT ON product_performance TO authenticated;
GRANT SELECT ON sales_by_category TO authenticated;
GRANT SELECT ON sales_by_location TO authenticated;
