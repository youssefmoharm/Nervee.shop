-- Migration 055: RLS Policy Consolidation
-- Date: 2026-10-04
--
-- Removes duplicate RLS policies identified during audit:
-- - Duplicate newsletter_subscriber policies
-- - Duplicate back_in_stock_requests policies
--
-- Also adds missing indexes for frequently queried columns

-- ==============================================================================
-- STEP 1: Remove duplicate newsletter_subscribers policies
-- ==============================================================================
DROP POLICY IF EXISTS "Public can insert newsletter subscription" ON newsletter_subscribers;

-- Verify only one INSERT policy exists
-- Expected: "Anyone can subscribe"

-- ==============================================================================
-- STEP 2: Remove duplicate back_in_stock_requests policies
-- ==============================================================================
DROP POLICY IF EXISTS "Users can insert back in stock requests" ON back_in_stock_requests;

-- Verify only one INSERT policy exists
-- Expected: "Anyone can request a back-in-stock alert"

-- ==============================================================================
-- STEP 3: Add missing indexes for foreign keys
-- ==============================================================================

-- order_items.order_id is indexed but order_items.product_id was not
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- wishlist_items.product_id was not indexed
CREATE INDEX IF NOT EXISTS idx_wishlist_items_product_id ON wishlist_items(product_id);

-- cart_items.product_id was not indexed
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

-- support_tickets.conversation_id was not indexed
CREATE INDEX IF NOT EXISTS idx_support_tickets_conversation_id ON support_tickets(conversation_id);

-- refunds.payment_attempt_id was not indexed
CREATE INDEX IF NOT EXISTS idx_refunds_payment_attempt_id ON refunds(payment_attempt_id);

-- order_idempotency.order_id was not indexed
CREATE INDEX IF NOT EXISTS idx_order_idempotency_order_id ON order_idempotency(order_id);

-- guest_orders.order_id was not indexed
CREATE INDEX IF NOT EXISTS idx_guest_orders_order_id ON guest_orders(order_id);

-- ==============================================================================
-- STEP 4: Add indexes for frequently filtered columns
-- ==============================================================================

-- Customers frequently filtered by city
CREATE INDEX IF NOT EXISTS idx_customers_city ON customers(city);

-- Customers frequently filtered by gender
CREATE INDEX IF NOT EXISTS idx_customers_gender ON customers(gender);

-- Orders filtered by status
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Orders filtered by customer_id
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- Order items filtered by created_at
CREATE INDEX IF NOT EXISTS idx_order_items_created_at ON order_items(created_at);

-- ==============================================================================
-- STEP 5: Add composite indexes for common query patterns
-- ==============================================================================

-- Dashboard queries often filter orders by status and created_at
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at);

-- Product inventory queries often filter by product_id and in_stock
CREATE INDEX IF NOT EXISTS idx_product_inventory_product_instock ON product_inventory(product_id, in_stock);

-- Cart items queries often filter by cart_id and product_id
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_product ON cart_items(cart_id, product_id);

-- ==============================================================================
-- STEP 6: Remove unused indexes (if any)
-- ==============================================================================
-- Note: Only remove indexes if confirmed unused in production
-- The following were flagged by database advisor but may be needed:
-- - Some duplicate indexes may be intentionally kept for query optimization

-- For now, we only drop clearly duplicate indexes
DROP INDEX IF EXISTS idx_cart_items_product_id;
DROP INDEX IF EXISTS idx_wishlist_items_product_id;
DROP INDEX IF EXISTS idx_support_tickets_conversation_id;
DROP INDEX IF EXISTS idx_refunds_payment_attempt_id;
DROP INDEX IF EXISTS idx_order_idempotency_order_id;
DROP INDEX IF EXISTS idx_guest_orders_order_id;

-- Re-add with correct names (migration 055 should not delete existing indexes)
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_product_id ON wishlist_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_conversation_id ON support_tickets(conversation_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_attempt_id ON refunds(payment_attempt_id);
CREATE INDEX IF NOT EXISTS idx_order_idempotency_order_id ON order_idempotency(order_id);
CREATE INDEX IF NOT EXISTS idx_guest_orders_order_id ON guest_orders(order_id);

-- ==============================================================================
-- STEP 7: Verify index usage
-- ==============================================================================
-- Run these queries after migration to check index usage:
--
-- SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public' ORDER BY idx_scan DESC;
--
-- Look for tables with zero index scans - these may be candidates for removal
