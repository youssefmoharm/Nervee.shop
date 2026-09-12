-- Migration 023: Fix SECURITY DEFINER views
--
-- PROBLEM: product_review_stats and product_availability were created as
-- SECURITY DEFINER views, which run with the view owner's privileges
-- (superuser) instead of the querying user's. This bypasses RLS and
-- is a critical security risk flagged by Supabase Security Advisor.
--
-- FIX: Recreate both views explicitly as SECURITY INVOKER (the safe default).

-- 1. Fix product_review_stats
DROP VIEW IF EXISTS product_review_stats;
CREATE VIEW product_review_stats
  SECURITY INVOKER
  AS
SELECT
  p.id AS product_id,
  COUNT(r.id) AS review_count,
  COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0) AS average_rating
FROM products p
LEFT JOIN product_reviews r ON p.id = r.product_id
GROUP BY p.id;

-- 2. Fix product_availability
DROP VIEW IF EXISTS product_availability;
CREATE VIEW product_availability
  SECURITY INVOKER
  AS
SELECT product_id, size, in_stock FROM product_inventory;

-- Ensure public access is still granted
GRANT SELECT ON product_availability TO anon, authenticated;
GRANT SELECT ON product_review_stats TO anon, authenticated;
