-- =============================================================================
-- 024: Product Virtual Try-On (Snap AR Camera Kit)
-- =============================================================================
-- Adds a per-product AR configuration column so each product can point at its
-- own Snapchat Lens without code changes. The storefront reads this column via
-- src/services/productService.ts (transformProduct → resolveProductTryOnConfig).
--
-- PREFERRED WAY TO SET IT: Admin → "AR Try-On" (/admin/try-on), which validates
-- lens IDs and writes this column for you. The SQL below is only for bulk edits.
--
-- Example row update:
--   UPDATE products SET virtual_try_on = jsonb_build_object(
--     'enabled', true,
--     'lensId', 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
--     'lensGroupId', 'f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6',
--     'label', 'Powered by Snap AR'
--   ) WHERE id = 'p-002';
--
-- RLS note: this column is read by anonymous clients through the existing
-- products policies; no additional grants are required for a jsonb column on
-- an already-readable table.
-- =============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS virtual_try_on jsonb;

-- Optionally restrict what can be stored so typos can't enable a broken state.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_virtual_try_on_shape;
ALTER TABLE public.products
  ADD CONSTRAINT products_virtual_try_on_shape CHECK (
    virtual_try_on IS NULL OR (
      (virtual_try_on ->> 'enabled') IN ('true', 'false') AND
      (virtual_try_on ->> 'lensId') IS NOT NULL AND
      length(virtual_try_on ->> 'lensId') BETWEEN 8 AND 64
    )
  );
