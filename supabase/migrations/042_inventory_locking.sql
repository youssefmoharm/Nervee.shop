-- Migration 042: Inventory locking for concurrent updates
-- Description: Add stock locking function to prevent race conditions
-- Date: 2026-09-26

-- Drop existing function if exists (for re-runnable migrations)
DROP FUNCTION IF EXISTS update_inventory_with_lock(TEXT, TEXT, INTEGER);

-- Create function with proper locking
CREATE OR REPLACE FUNCTION update_inventory_with_lock(
  p_product_id TEXT,
  p_size TEXT,
  p_new_quantity INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Lock the row to prevent concurrent updates
  PERFORM FROM product_inventory 
  WHERE product_id = p_product_id AND size = p_size 
  FOR UPDATE;
  
  -- Update with GREATEST to prevent negative values
  UPDATE product_inventory
  SET stock_quantity = GREATEST(p_new_quantity, 0),
      in_stock = (p_new_quantity > 0)
  WHERE product_id = p_product_id AND size = p_size;
END;
$$;