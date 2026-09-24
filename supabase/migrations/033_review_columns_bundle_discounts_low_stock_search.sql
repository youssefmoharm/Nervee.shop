-- Migration 033:
-- 1) product_reviews.photos + helpful_count (UI/service already depend on them)
-- 2) vote_review_helpful keeps helpful_count in sync (single source of truth)
-- 3) Seed BUNDLE10 (Complete-the-Look 10%) and COMEBACK10 (abandoned-cart email)
-- 4) product_stock_status: public low-stock view (security definer so anon can
--    see threshold flags without direct product_inventory.stock_quantity access)
-- 5) Arabic-capable simple text-search index alongside the english one

-- ---------------------------------------------------------------------------
-- 1. REVIEW COLUMNS
-- ---------------------------------------------------------------------------
ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS helpful_count INTEGER NOT NULL DEFAULT 0;

-- Backfill helpful_count from existing votes (no-op when table is empty)
UPDATE product_reviews pr
SET helpful_count = sub.cnt
FROM (
  SELECT review_id, COUNT(*)::INTEGER AS cnt
  FROM review_helpful_votes
  GROUP BY review_id
) sub
WHERE pr.id = sub.review_id
  AND pr.helpful_count IS DISTINCT FROM sub.cnt;

-- ---------------------------------------------------------------------------
-- 2. VOTE RPC: persist helpful_count on the review row
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS vote_review_helpful(UUID, TEXT);
CREATE OR REPLACE FUNCTION vote_review_helpful(p_review_id UUID, p_voter_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_review_id IS NULL OR p_voter_id IS NULL OR length(trim(p_voter_id)) = 0 THEN
    RAISE EXCEPTION 'review_id and voter_id are required' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO review_helpful_votes (review_id, voter_id)
  VALUES (p_review_id, trim(p_voter_id))
  ON CONFLICT (review_id, voter_id) DO NOTHING;

  SELECT COUNT(*) INTO v_count
    FROM review_helpful_votes
   WHERE review_id = p_review_id;

  UPDATE product_reviews
     SET helpful_count = v_count
   WHERE id = p_review_id;

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION vote_review_helpful(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vote_review_helpful(UUID, TEXT) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. DISCOUNT CODES (EGP-safe values; 10% advertised by bundle + comeback email)
-- ---------------------------------------------------------------------------
INSERT INTO discount_codes (code, description, discount_type, discount_value, minimum_purchase, usage_limit, is_active, valid_until) VALUES
('BUNDLE10', 'Complete-the-Look bundle: 10% off', 'percentage', 10, 0, NULL, TRUE, NULL),
('COMEBACK10', 'Abandoned cart recovery: 10% off', 'percentage', 10, 0, 5000, TRUE, NULL)
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  minimum_purchase = EXCLUDED.minimum_purchase,
  usage_limit = EXCLUDED.usage_limit,
  is_active = EXCLUDED.is_active,
  valid_until = EXCLUDED.valid_until;

-- ---------------------------------------------------------------------------
-- 4. PUBLIC LOW-STOCK STATUS VIEW
--    Aggregates per product: lowest stock across sizes + the product's
--    effective threshold (max of per-size low_stock_threshold). security
--    definer so storefront clients never need SELECT on stock_quantity.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW product_stock_status
WITH (security_invoker = false) AS
SELECT
  pi.product_id,
  MIN(pi.stock_quantity) AS min_stock_quantity,
  MAX(pi.low_stock_threshold) AS low_stock_threshold,
  (MIN(pi.stock_quantity) <= MAX(pi.low_stock_threshold)) AS is_low_stock
FROM product_inventory pi
GROUP BY pi.product_id;

GRANT SELECT ON product_stock_status TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. SEARCH: keep the english websearch index, add a simple (multilingual)
--    index so Arabic queries work with config: 'simple'.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS products_name_simple_idx
  ON products USING GIN (to_tsvector('simple', name));

CREATE INDEX IF NOT EXISTS products_search_simple_idx
  ON products USING GIN (to_tsvector('simple', name || ' ' || description || ' ' || category));
