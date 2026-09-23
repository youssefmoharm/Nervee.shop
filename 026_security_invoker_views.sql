-- Migration 026: Actually fix SECURITY DEFINER views (security_invoker)
--
-- WHY 023 WAS INSUFFICIENT:
-- Migration 023 attempted to fix product_review_stats and product_availability
-- by dropping and recreating them with `CREATE OR REPLACE VIEW ... AS SELECT ...`,
-- reasoning that views are "SECURITY INVOKER by default". That premise is wrong:
-- PostgreSQL views run with the view OWNER's privileges (effectively
-- SECURITY DEFINER behavior, bypassing the querying user's RLS) unless they
-- are explicitly created WITH (security_invoker = true). Because 023 never set
-- that reloption, both views remained SECURITY DEFINER and the Supabase
-- Security Advisor continued to flag them.
--
-- FIX: Drop each view and recreate it with WITH (security_invoker = true).
-- Note CREATE OR REPLACE VIEW cannot reliably change reloptions on an
-- existing view, which is why this migration uses DROP VIEW IF EXISTS
-- followed by CREATE VIEW rather than CREATE OR REPLACE VIEW.
--
-- Safe to run more than once (idempotent): each view is dropped if it
-- exists and recreated identically.

-- 1. product_review_stats
DROP VIEW IF EXISTS product_review_stats CASCADE;
CREATE VIEW product_review_stats WITH (security_invoker = true) AS
SELECT
  p.id AS product_id,
  COUNT(r.id) AS review_count,
  COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0) AS average_rating
FROM products p
LEFT JOIN product_reviews r ON p.id = r.product_id
GROUP BY p.id;

-- 2. product_availability
DROP VIEW IF EXISTS product_availability CASCADE;
CREATE VIEW product_availability WITH (security_invoker = true) AS
SELECT product_id, size, in_stock FROM product_inventory;

-- Restore public read access on both views (grants do not survive DROP VIEW)
GRANT SELECT ON product_review_stats TO anon, authenticated;
GRANT SELECT ON product_availability TO anon, authenticated;

-- Verification: confirm security_invoker=true is now set on both views.
-- (Run manually / read the NOTICE output; SELECT statements are not
-- guaranteed to surface in every SQL Editor result pane.)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT relname, reloptions
    FROM pg_class
    WHERE relname IN ('product_review_stats', 'product_availability')
      AND relkind = 'v'
  LOOP
    RAISE NOTICE 'view=% reloptions=%', r.relname, r.reloptions;
  END LOOP;
END $$;

-- Equivalent verification query for interactive use in the SQL Editor:
-- SELECT relname, reloptions FROM pg_class
-- WHERE relname IN ('product_review_stats', 'product_availability') AND relkind = 'v';
