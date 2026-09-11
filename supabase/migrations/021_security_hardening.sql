-- Migration 021: Security Hardening
-- Fixes identified in production audit:
-- 1. Add missing indexes on frequently queried foreign keys
-- 2. Add search_path to functions missing it
-- 3. Restrict product_inventory stock_quantity visibility
-- 4. Add quantity upper bound enforcement

-- =============================================================================
-- 1. MISSING INDEXES
-- =============================================================================

-- cart_items.product_id — frequently joined for cart display
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items (product_id);

-- wishlist_items.product_id — frequently joined for wishlist display
CREATE INDEX IF NOT EXISTS idx_wishlist_items_product_id ON wishlist_items (product_id);

-- guest_orders.order_id — used for guest order lookup
CREATE INDEX IF NOT EXISTS idx_guest_orders_order_id ON guest_orders (order_id);

-- order_idempotency.order_id — used for idempotency checks
CREATE INDEX IF NOT EXISTS idx_order_idempotency_order_id ON order_idempotency (order_id);

-- refunds.payment_attempt_id — used for refund lookups
CREATE INDEX IF NOT EXISTS idx_refunds_payment_attempt_id ON refunds (payment_attempt_id);

-- support_tickets.conversation_id — used for ticket-conversation joins
CREATE INDEX IF NOT EXISTS idx_support_tickets_conversation_id ON support_tickets (conversation_id);

-- =============================================================================
-- 2. ADD search_path TO FUNCTIONS MISSING IT
-- =============================================================================

-- generate_order_number — prevents search_path hijacking
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  num TEXT;
BEGIN
  num := 'NV-' || LPAD(FLOOR(RANDOM() * 999999 + 1)::TEXT, 6, '0');
  RETURN num;
END;
$$;

-- generate_ticket_number — prevents search_path hijacking
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  num TEXT;
BEGIN
  num := 'TK-' || LPAD(FLOOR(RANDOM() * 999999 + 1)::TEXT, 6, '0');
  RETURN num;
END;
$$;

-- update_updated_at_column — trigger function, add search_path for defense-in-depth
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 3. RESTRICT product_inventory VISIBILITY
-- =============================================================================
-- The underlying table still allows SELECT (needed for service_role and admin
-- queries). We tighten it by revoking direct anon access and requiring
-- authenticated role for stock_quantity column. For public-facing queries,
-- the product_availability view should be used instead.

-- Revoke direct anon SELECT on product_inventory (service_role still works)
REVOKE SELECT ON product_inventory FROM anon;

-- Grant SELECT to authenticated (admin dashboard needs it)
GRANT SELECT ON product_inventory TO authenticated;

-- =============================================================================
-- 4. ADD cart_items QUANTITY UPPER BOUND VIA CHECK CONSTRAINT
-- =============================================================================

-- Enforce quantity bounds at the database level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_quantity_check'
  ) THEN
    ALTER TABLE cart_items
      ADD CONSTRAINT cart_items_quantity_check
      CHECK (quantity >= 1 AND quantity <= 99);
  END IF;
END $$;

-- =============================================================================
-- 5. ENSURE order_return_requests CANNOT BE DELETED BY USERS
-- =============================================================================
-- Drop the overly permissive FOR ALL policy and replace with separate policies

DROP POLICY IF EXISTS "Users can manage own return requests" ON order_return_requests;

-- Users can read their own return requests
CREATE POLICY "Users can view own return requests"
  ON order_return_requests FOR SELECT
  USING (
    auth.uid() = customer_id
  );

-- Users can insert (create) return requests
CREATE POLICY "Users can create return requests"
  ON order_return_requests FOR INSERT
  WITH CHECK (
    auth.uid() = customer_id
  );

-- Only service_role can update return requests (admin workflow)
-- No user-facing UPDATE or DELETE policy means users cannot modify/delete them
