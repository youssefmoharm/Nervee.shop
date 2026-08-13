-- ============================================================================
-- NERVE — Migration 005
-- Adds: guest_orders table, product_reviews table, product_review_stats view
--
-- Run this via `supabase db push` or the Supabase SQL Editor.
-- ============================================================================

-- ============================================================================
-- GUEST ORDERS (for guest checkout tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS guest_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  order_number TEXT UNIQUE NOT NULL,
  verification_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE guest_orders ENABLE ROW LEVEL SECURITY;

-- Public can view guest order by verifying email + order_number + token
DROP POLICY IF EXISTS "Public can view guest order by email/token" ON guest_orders;
CREATE POLICY "Public can view guest order by email/token" ON guest_orders FOR SELECT
  USING (
    (email = (SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'email', 'null')) 
      AND verification_token = (SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'verify_token', 'null')))
    OR
    (email = (SELECT auth.jwt() ->> 'email'::TEXT) AND verification_token IS NULL)
  );

CREATE INDEX IF NOT EXISTS guest_orders_email_idx ON guest_orders(email);
CREATE INDEX IF NOT EXISTS guest_orders_token_idx ON guest_orders(verification_token);
CREATE INDEX IF NOT EXISTS guest_orders_order_number_idx ON guest_orders(order_number);

-- ============================================================================
-- PRODUCT REVIEWS
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT NOT NULL,
  comment TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(product_id, customer_id)
);

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

-- Authenticated users can CRUD own reviews
DROP POLICY IF EXISTS "Authenticated users can CRUD own reviews" ON product_reviews;
CREATE POLICY "Authenticated users can CRUD own reviews" ON product_reviews FOR ALL
  USING (auth.uid() = customer_id);

-- Public can view all reviews
DROP POLICY IF EXISTS "Public can view all reviews" ON product_reviews;
CREATE POLICY "Public can view all reviews" ON product_reviews FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS product_reviews_product_id_idx ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS product_reviews_customer_id_idx ON product_reviews(customer_id);
CREATE INDEX IF NOT EXISTS product_reviews_product_rating_idx ON product_reviews(product_id, rating);

-- ============================================================================
-- Product Review Statistics View
-- ============================================================================
CREATE OR REPLACE VIEW product_review_stats AS
SELECT 
  p.id AS product_id,
  COUNT(r.id) AS review_count,
  COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0) AS average_rating
FROM products p
LEFT JOIN product_reviews r ON p.id = r.product_id
GROUP BY p.id;

-- ============================================================================
-- Function to verify purchase and mark review as verified
-- ============================================================================
CREATE OR REPLACE FUNCTION verify_review_purchase(p_review_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_product_id TEXT;
  v_customer_id UUID;
BEGIN
  -- Get review details
  SELECT product_id, customer_id INTO v_product_id, v_customer_id
    FROM product_reviews WHERE id = p_review_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review not found' USING ERRCODE = 'P0001';
  END IF;
  
  -- Check if customer has a delivered order with this product
  SELECT o.id INTO v_order_id
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.customer_id = v_customer_id
      AND oi.product_id = v_product_id
      AND o.status = 'delivered'
    LIMIT 1;
  
  IF FOUND THEN
    UPDATE product_reviews SET verified = TRUE WHERE id = p_review_id;
  ELSE
    RAISE EXCEPTION 'No verified purchase found for this review' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION verify_review_purchase FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_review_purchase TO authenticated;
