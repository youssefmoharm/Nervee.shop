-- review_authors public view (migration 039, audit SEC-12)
--
-- Guards the fix for "product reviews render with no author name": the
-- customers table is owner-only under RLS, so the old PostgREST embed
-- returned null for every viewer but the review's own author.
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/database/review_authors_visibility.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The view exists and exposes exactly three non-PII columns
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_cols TEXT[];
BEGIN
  IF to_regclass('public.review_authors') IS NULL THEN
    RAISE EXCEPTION 'FAIL: review_authors view missing';
  END IF;

  SELECT array_agg(a.attname ORDER BY a.attname) INTO v_cols
  FROM pg_attribute a
  WHERE a.attrelid = 'public.review_authors'::regclass
    AND a.attnum > 0 AND NOT a.attisdropped;

  IF v_cols IS DISTINCT FROM ARRAY['first_name', 'id', 'last_name'] THEN
    RAISE EXCEPTION 'FAIL: review_authors must expose exactly (id, first_name, last_name), found %', v_cols;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. anon + authenticated may SELECT it (public reviewer names)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM information_schema.role_table_grants
  WHERE table_name = 'review_authors'
    AND privilege_type = 'SELECT'
    AND grantee IN ('anon', 'authenticated');

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL: expected SELECT grant on review_authors for anon+authenticated (found %)', v_count;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Only customers who wrote a review appear; a profile-less customer does not
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_customer_id UUID;
  v_visible BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM customers LIMIT 1) THEN
    SELECT id INTO v_customer_id
    FROM customers
    WHERE NOT EXISTS (SELECT 1 FROM product_reviews pr WHERE pr.customer_id = customers.id)
    LIMIT 1;

    IF v_customer_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM review_authors WHERE id = v_customer_id) INTO v_visible;
      IF v_visible THEN
        RAISE EXCEPTION 'FAIL: customer with no reviews must not appear in review_authors';
      END IF;
    END IF;
  END IF;
  -- reviewer-exists direction is covered by review_customer_embed.sql fixtures
END $$;

ROLLBACK;
