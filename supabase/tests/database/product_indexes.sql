-- Catalog btree indexes (migration 040, audit PERF-06)
--
-- products only had GIN search + name indexes, so every catalog query
-- sequential-scanned. Guards the five filter/sort indexes the storefront
-- relies on (active listings, category, price, best sellers, collections).
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/database/product_indexes.sql
--  or: supabase test db

BEGIN;

DO $$
DECLARE
  v_missing TEXT;
BEGIN
  SELECT string_agg(i, ', ') INTO v_missing
  FROM unnest(ARRAY[
      'products_active_created_idx',
      'products_active_category_idx',
      'products_active_price_idx',
      'products_best_seller_idx',
      'products_collection_idx'
    ]) AS i
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'products' AND indexname = i
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: missing products index(es): %', v_missing;
  END IF;
END $$;

-- The default listing path must resolve to an index scan (the plan text
-- mentions the index name when it is used).
DO $$
DECLARE
  v_line TEXT;
  v_plan TEXT := '';
BEGIN
  SET LOCAL enable_seqscan = off;
  FOR v_line IN
    EXECUTE 'EXPLAIN SELECT id FROM products WHERE is_active ORDER BY created_at DESC LIMIT 20'
  LOOP
    v_plan := v_plan || ' ' || v_line;
  END LOOP;

  IF v_plan NOT LIKE '%products_active_created_idx%' THEN
    RAISE EXCEPTION 'FAIL: active+created listing did not use products_active_created_idx (plan: %)', v_plan;
  END IF;
END $$;

ROLLBACK;
