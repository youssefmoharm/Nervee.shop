-- product_reviews.customer_id -> customers.id FK (migration 035)
-- Guarantees the PostgREST embed used by reviewService.getByProduct /
-- getMine / getCustomerReviews resolves:
--   GET /rest/v1/product_reviews?select=*,customers(first_name,last_name)
-- Portable DO-block assertions; BEGIN/ROLLBACK for side-effect-free runs.
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/database/review_customer_embed.sql
--  or: supabase test db

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The FK must exist: product_reviews.customer_id -> customers.id
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_constraint
  WHERE conrelid = 'product_reviews'::regclass
    AND contype = 'f'
    AND conname = 'product_reviews_customer_id_fkey'
    AND confrelid = 'customers'::regclass;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: expected FK product_reviews.customer_id -> customers.id (found %)', v_count;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. End-to-end embed sanity: insert a customer + review, then join exactly
--    the way PostgREST resolves the embed (customer_id = customers.id).
--    Also proves ON DELETE CASCADE cleans reviews with their customer.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_product_id TEXT := 'tap-review-embed-product';
  v_customer_id UUID;
  v_review_id UUID;
  v_name TEXT;
  v_remaining INTEGER;
BEGIN
  -- Fixture product (matches review_columns.sql pattern)
  INSERT INTO products (id, slug, name, category, price, description, material, care, is_active)
  VALUES (
    v_product_id, 'tap-review-embed-' || floor(random() * 100000)::text,
    'pgTAP Embed Fixture', 'T-Shirts', 250,
    'Fixture product for review embed tests', 'Cotton', '[]'::jsonb, TRUE
  )
  ON CONFLICT (id) DO NOTHING;

  -- Fixture customer. customers.id references auth.users, so create the auth
  -- user first via the auth schema's own helper; if unavailable, seed through
  -- auth.users directly is not permitted, so fall back to an existing row.
  IF EXISTS (SELECT 1 FROM customers LIMIT 1) THEN
    -- Use a real customer row so the FK target is satisfiable in any env.
    SELECT id INTO v_customer_id FROM customers LIMIT 1;
  ELSE
    RAISE EXCEPTION 'SKIP-ENV: no customers rows exist to satisfy the FK in this environment';
  END IF;

  INSERT INTO product_reviews (product_id, customer_id, rating, title, comment)
  VALUES (v_product_id, v_customer_id, 5, 'Embed test', 'Join resolves')
  RETURNING id INTO v_review_id;

  -- The exact join PostgREST performs for customers(...) embed:
  SELECT c.first_name || ' ' || c.last_name INTO v_name
  FROM product_reviews pr
  JOIN customers c ON c.id = pr.customer_id
  WHERE pr.id = v_review_id;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'FAIL: product_reviews -> customers join returned no row';
  END IF;

  -- ON DELETE CASCADE: deleting the customer must delete their review.
  DELETE FROM customers WHERE id = v_customer_id;
  SELECT COUNT(*) INTO v_remaining FROM product_reviews WHERE id = v_review_id;
  IF v_remaining <> 0 THEN
    RAISE EXCEPTION 'FAIL: review should cascade-delete with its customer (found %)', v_remaining;
  END IF;
END $$;

ROLLBACK;
