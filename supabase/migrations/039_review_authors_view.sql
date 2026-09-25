-- Migration 039: public reviewer-name visibility (audit SEC-12).
--
-- Problem: reviewService.getByProduct embeds customers(first_name,last_name),
-- but the customers table is owner-only under RLS, so PostgREST returns
-- `customers: null` for everyone except the review's own author. Verified
-- live with the anon key: product reviews render with no author name at all.
--
-- Fix: a deliberately narrow, public read model. `review_authors` exposes
-- exactly three columns — id, first_name, last_name — and only for customers
-- who actually wrote a review. Emails, phones and every other profile column
-- stay behind customers RLS. security_invoker = false so anon can read it
-- (same pattern as product_stock_status, migration 033).

DROP VIEW IF EXISTS review_authors CASCADE;
CREATE VIEW review_authors WITH (security_invoker = false) AS
SELECT c.id, c.first_name, c.last_name
FROM customers c
WHERE EXISTS (
  SELECT 1 FROM product_reviews pr WHERE pr.customer_id = c.id
);

GRANT SELECT ON review_authors TO anon, authenticated, service_role;

-- Reload PostgREST's schema cache so the new view is immediately queryable.
NOTIFY pgrst, 'reload schema';

-- Verification (anon key):
--   GET /rest/v1/review_authors?select=id,first_name,last_name&limit=1
--   GET /rest/v1/product_reviews?select=id,customer_id&limit=5  -> join in app
