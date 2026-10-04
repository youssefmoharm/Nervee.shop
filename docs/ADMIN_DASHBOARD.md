# NERVE Admin Dashboard

## Overview

The admin dashboard provides comprehensive analytics and operational tools for managing the NERVE e-commerce store. Access is restricted to authorized administrators only.

## Admin Access

### How to Gain Admin Access

To grant admin access to a user:

1. Get the user's Supabase auth user ID (from the `auth.users` table)
2. Insert a row into the `admin_users` table:

```sql
INSERT INTO admin_users (user_id) VALUES ('user-uuid-here');
```

### Admin Verification

When a user logs in, the system checks if their `auth.uid()` exists in `admin_users`. If found, they're granted admin access to `/admin/*` routes.

## KPIs and Metrics

### Revenue Metrics

| Metric | Description | Calculation |
|--------|-------------|-------------|
| **Revenue** | Total revenue in the selected period | Sum of `orders.total` where `status != 'cancelled'` and `created_at` in period |
| **Previous Revenue** | Revenue from the previous period | Sum of `orders.total` from previous period |
| **Gross Sales** | Total sales (excluding cancelled/refunded) | Sum of `orders.total` where `status IN ('delivered', 'shipped')` |
| **Total Refunds** | Refund amounts | Sum of `-orders.total` where `status = 'refunded'` |
| **Total Discounts** | Discount amounts applied | Sum of `orders.discount_amount` |

### Order Metrics

| Metric | Description | Calculation |
|--------|-------------|-------------|
| **Orders** | Orders in the selected period | Count of orders with `created_at` in period |
| **Previous Orders** | Orders from previous period | Count of orders in previous period |
| **Pending Orders** | Orders awaiting fulfillment | Count where `status IN ('placed', 'processing')` |
| **Processing Orders** | Currently processing | Count where `status = 'processing'` |
| **Shipped Orders** | Shipped to carrier | Count where `status = 'shipped'` |
| **Delivered Orders** | Delivered to customers | Count where `status = 'delivered'` |
| **Cancelled Orders** | Cancelled by admin/customer | Count where `status = 'cancelled'` |
| **Completed Orders** | Delivered orders | Count where `status = 'delivered'` |

### Customer Metrics

| Metric | Description | Calculation |
|--------|-------------|-------------|
| **New Customers** | First-time customers | Count of `customers` with `created_at` in period |
| **Total Customers** | All customers | Count of all customers |
| **Returning Customers** | Multi-order customers | Count of customers with >1 non-cancelled order |

### Product Metrics

| Metric | Description | Calculation |
|--------|-------------|-------------|
| **Total Products** | All products | Count of products |
| **Inactive Products** | Hidden products | Count where `is_active = FALSE` |
| **Low Stock Products** | At or below threshold | Count of inventory rows at or below `low_stock_threshold` (default: 5) |
| **Out of Stock** | Zero stock | Count of inventory rows with `stock_quantity = 0` |

### Return Metrics

| Metric | Description | Calculation |
|--------|-------------|-------------|
| **Total Returns** | Return requests | Count of `order_return_requests` where `type = 'return'` |
| **Total Refund Amount** | Completed refunds | Sum of `refunds.amount` for completed refunds |
| **Pending Returns** | Awaiting approval | Count where `status = 'pending'` |
| **Approved Returns** | Approved for processing | Count where `status = 'approved'` |

### Calculated Metrics

| Metric | Description | Calculation |
|--------|-------------|-------------|
| **Average Order Value** | Average order size | `current_revenue / current_orders` |
| **Return Rate** | Percentage of orders returned | `(total_returns * 100) / current_orders` |
| **Revenue Growth** | YoY percentage change | `((current - previous) * 100) / previous` |
| **Order Growth** | YoY order count change | `((current - previous) * 100) / previous` |
| **Products Sold** | Units sold | Sum of `order_items.quantity` for non-cancelled orders |

## Troubleshooting

### Access Denied

**Symptoms**: Redirected to `/admin` with "Access Denied" screen.

**Causes**:
- User not in `admin_users` table
- Authentication session expired

**Fix**:
```sql
-- Verify user is in admin_users
SELECT * FROM admin_users WHERE user_id = 'your-uuid';

-- Add user if missing
INSERT INTO admin_users (user_id) VALUES ('your-uuid');
```

### Empty Dashboard

**Symptoms**: Dashboard loads but shows "No data available".

**Causes**:
- No orders exist yet
- Date range has no data
- RPC function returning empty due to 42501 error

**Fix**:
1. Check date range selection
2. Verify orders exist: `SELECT COUNT(*) FROM orders;`
3. Check browser console for 42501 errors

### RPC 42501 Error

**Symptoms**: Dashboard shows error "Forbidden: admin access required".

**Causes**:
- User not authorized in `admin_users` table
- Auth session invalid

**Fix**: See "Access Denied" section above.

### Stale Numbers

**Symptoms**: Dashboard shows outdated data after order updates.

**Causes**:
- Browser cache
- PostgreSQL MVCC visibility

**Fix**:
1. Hard refresh browser (Ctrl+Shift+R)
2. Check `orders.updated_at` timestamps
3. Run manual refresh

### Slow Dashboard

**Symptoms**: Dashboard takes >5 seconds to load.

**Causes**:
- Large datasets without indexes
- Complex date ranges
- Network latency

**Fix**:
1. Reduce date range
2. Check index usage: `SELECT * FROM pg_stat_user_indexes;`
3. Review database performance in Supabase dashboard

## API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `rpc/get_dashboard_overview` | Main dashboard metrics |
| `rpc/get_daily_sales` | Revenue over time |
| `rpc/get_top_products` | Best sellers |
| `rest/v1/orders` | Recent orders table |
| `rest/v1/order_items` | Best sellers computation |
| `rest/v1/product_inventory` | Low stock alerts |

## Security Notes

- All RPC functions check `auth.uid()` against `admin_users` table
- Non-admin attempts return PostgreSQL error code 42501
- Admin access is verified on every request
- No secrets are exposed in dashboard output