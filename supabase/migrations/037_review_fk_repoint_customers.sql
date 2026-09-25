-- 037: repoint product_reviews.customer_id from auth.users to customers.
--
-- Why 035 was a no-op: migration 005 created
--   customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
-- which PostgreSQL default-named `product_reviews_customer_id_fkey`. Every
-- later "add if missing" guard (035 included) saw that name and skipped, so
-- PostgREST never gained a relationship to the exposed public.customers table
-- and the reviews embed kept failing with PGRST200.
--
-- Fix: drop the auth.users FK and recreate the same-named constraint against
-- customers(id) — the canonical profile reference used by orders, carts,
-- wishlists, and wishlist_shares. Deletion semantics are preserved: deleting
-- an auth user still removes their reviews (auth.users -> customers is ON
-- DELETE CASCADE via 001, which then cascades the review).
--
-- Safe because: zero orphaned reviews (verified before apply) and every
-- product_reviews.customer_id equals a customers.id (customers.id is itself a
-- FK to auth.users, so any review written through auth users has a profile).

-- 1) Orphan safety before the customers-targeted FK is (re)created.
DELETE FROM product_reviews pr
WHERE pr.customer_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = pr.customer_id);

-- 2) Repoint the constraint only when it currently targets the wrong table.
DO $$
DECLARE
  v_ref TEXT;
BEGIN
  SELECT confrelid::regclass::text INTO v_ref
  FROM pg_constraint
  WHERE conname = 'product_reviews_customer_id_fkey'
    AND conrelid = 'product_reviews'::regclass;

  IF v_ref IS NULL THEN
    ALTER TABLE product_reviews
      ADD CONSTRAINT product_reviews_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE;
  ELSIF v_ref <> 'customers' THEN
    ALTER TABLE product_reviews
      DROP CONSTRAINT product_reviews_customer_id_fkey;
    ALTER TABLE product_reviews
      ADD CONSTRAINT product_reviews_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE;
  END IF;
  -- v_ref = 'customers' -> already correct, nothing to do (idempotent).
END
$$;

-- 3) Reload PostgREST's schema cache so the embed becomes available at once.
NOTIFY pgrst, 'reload schema';
