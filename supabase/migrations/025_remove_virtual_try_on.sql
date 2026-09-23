-- Remove Snapchat AR Virtual Try-On support (feature removed from the app).
-- Safe to run whether or not 024 was previously applied.

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_virtual_try_on_shape;
ALTER TABLE products DROP COLUMN IF EXISTS virtual_try_on;
