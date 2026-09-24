-- product_reviews.photos / helpful_count columns + vote_review_helpful sync
-- Portable DO-block assertions; BEGIN/ROLLBACK for side-effect-free runs.
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/database/review_columns.sql
--  or: supabase test db

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Columns exist with expected types/defaults (migration 033)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'product_reviews'
    AND column_name IN ('photos', 'helpful_count');

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL: product_reviews is missing photos and/or helpful_count (found % of 2)', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_reviews'
      AND column_name = 'helpful_count'
      AND data_type = 'integer'
  ) THEN
    RAISE EXCEPTION 'FAIL: helpful_count must be integer';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_reviews'
      AND column_name = 'photos'
      AND udt_name = 'jsonb'
  ) THEN
    RAISE EXCEPTION 'FAIL: photos must be jsonb';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. vote_review_helpful increments helpful_count and is idempotent per voter
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_product_id TEXT := 'tap-review-product';
  v_review_id UUID;
  v_ret1 INTEGER;
  v_ret2 INTEGER;
  v_stored INTEGER;
  v_photos jsonb;
BEGIN
  INSERT INTO products (id, slug, name, category, price, description, material, care, is_active)
  VALUES (
    v_product_id, 'tap-review-product-' || floor(random() * 100000)::text,
    'pgTAP Review Fixture', 'T-Shirts', 250,
    'Fixture product for review column tests', 'Cotton', '[]'::jsonb, TRUE
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO product_reviews (product_id, rating, title, comment, photos, helpful_count)
  VALUES (v_product_id, 5, 'Great fit', 'Solid tee', '[]'::jsonb, 0)
  RETURNING id INTO v_review_id;

  -- Default photos is jsonb array
  SELECT photos INTO v_photos FROM product_reviews WHERE id = v_review_id;
  IF v_photos IS NULL OR jsonb_typeof(v_photos) <> 'array' THEN
    RAISE EXCEPTION 'FAIL: photos default should be a jsonb array, got %', v_photos;
  END IF;

  v_ret1 := vote_review_helpful(v_review_id, 'voter-1');
  IF v_ret1 IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FAIL: first vote should return 1, got %', v_ret1;
  END IF;

  SELECT helpful_count INTO v_stored FROM product_reviews WHERE id = v_review_id;
  IF v_stored IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FAIL: helpful_count should be 1 after first vote, got %', v_stored;
  END IF;

  -- Same voter again: ON CONFLICT DO NOTHING → count stays 1
  v_ret2 := vote_review_helpful(v_review_id, 'voter-1');
  IF v_ret2 IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FAIL: duplicate voter should keep count at 1, got %', v_ret2;
  END IF;

  -- Second distinct voter → 2
  v_ret2 := vote_review_helpful(v_review_id, 'voter-2');
  IF v_ret2 IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'FAIL: second voter should yield 2, got %', v_ret2;
  END IF;

  SELECT helpful_count INTO v_stored FROM product_reviews WHERE id = v_review_id;
  IF v_stored IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'FAIL: stored helpful_count should be 2, got %', v_stored;
  END IF;

  -- Blank voter rejected
  BEGIN
    PERFORM vote_review_helpful(v_review_id, '   ');
    RAISE EXCEPTION 'FAIL: blank voter_id should raise';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'FAIL: blank voter_id should raise' THEN RAISE; END IF;
  WHEN OTHERS THEN
    NULL; -- expected domain error from the RPC
  END;
END $$;

ROLLBACK;
