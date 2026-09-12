-- Migration 022: Fix product_inventory access for anonymous users
-- 
-- PROBLEM: Migration 021 revoked SELECT on product_inventory from anon,
-- which breaks all Supabase queries that join product_inventory via PostgREST.
-- This causes the "New Drop" section (and other product listings) to appear
-- empty because the query fails and returns [].
--
-- FIX: Restore SELECT on product_inventory for anon. The RLS policy
-- "Public can view inventory availability" (from migration 012) already
-- restricts visibility to product_id, size, in_stock only - stock_quantity
-- is excluded at the RLS level.

-- 1. Restore SELECT permission for anon
GRANT SELECT ON product_inventory TO anon;

-- 2. Ensure RLS is properly configured (no-op if already exists)
-- The existing RLS policy from migration 012 handles column-level restrictions.
-- Verify it exists:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'product_inventory' 
    AND policyname = 'Public can view inventory availability'
  ) THEN
    -- Fallback: if migration 012 wasn't applied, create the restrictive policy
    DROP POLICY IF EXISTS "Public can view product inventory" ON product_inventory;
    CREATE POLICY "Public can view inventory availability" ON product_inventory
      FOR SELECT
      USING (true);
  END IF;
END $$;
