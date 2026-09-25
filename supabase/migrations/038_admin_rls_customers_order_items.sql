-- Migration 038: admin read policies for `customers` and `order_items`.
--
-- Problem (audit SEC-01, Critical):
--   Both tables had owner-only SELECT policies and no admin policy in any
--   earlier migration, so every admin-scoped read returned 0 rows:
--     * Admin → Customers page            (src/pages/Admin/Customers.tsx)
--     * Dashboard `totalCustomers`        (src/pages/Admin/Dashboard.tsx)
--     * review-author name embeds         (src/services/reviewService.ts)
--     * admin order line items            (src/services/adminService.ts)
--   RLS is permissive-OR: the owner policies below keep working unchanged.

-- ---------------------------------------------------------------------------
-- customers: admin SELECT only (admins never write customer rows directly)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all customers" ON customers;
CREATE POLICY "Admins can view all customers" ON customers FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

-- ---------------------------------------------------------------------------
-- order_items: admin SELECT (line items for fulfillment / order detail)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
CREATE POLICY "Admins can view all order items" ON order_items FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

-- ---------------------------------------------------------------------------
-- Verification (run in the SQL editor as an authenticated admin):
--   SELECT count(*) FROM customers;      -- previously always 0
--   SELECT count(*) FROM order_items;    -- previously always 0
-- Non-admin authenticated users still see only their own rows:
--   SELECT count(*) FROM customers WHERE id <> auth.uid();  -- 0
-- ---------------------------------------------------------------------------
