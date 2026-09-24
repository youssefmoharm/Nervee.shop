-- Migration 035:
-- product_reviews <-> customers embed fix.
--
-- The storefront reviews UI selects
--   product_reviews..., customers ( first_name, last_name )
-- (see src/services/reviewService.ts getByProduct / getMine / getCustomerReviews),
-- but product_reviews.customer_id references auth.users(id) directly, so
-- PostgREST finds no FK between product_reviews and customers and rejects the
-- whole request with PGRST200 ("Could not find a relationship between
-- 'product_reviews' and 'customers'"). Reviews therefore never render on any
-- product page.
--
-- Fix: add the missing FK product_reviews.customer_id -> customers.id.
-- Both tables key off auth.users(id), so every existing customer_id is
-- guaranteed to have a matching customers row (customers.id is itself a FK to
-- auth.users). Any orphaned rows are removed first so the FK applies cleanly.
--
-- Idempotent: safe to re-run.

-- 1) Drop orphaned reviews whose customer no longer exists in customers.
--    (Normally zero rows — defensive only.)
DELETE FROM product_reviews pr
WHERE pr.customer_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = pr.customer_id);

-- 2) Add the missing relationship (no-op if it already exists).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_reviews_customer_id_fkey'
      AND conrelid = 'product_reviews'::regclass
  ) THEN
    ALTER TABLE product_reviews
      ADD CONSTRAINT product_reviews_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE;
  END IF;
END
$$;

-- 3) Let PostgREST see the new relationship immediately.
NOTIFY pgrst, 'reload schema';
