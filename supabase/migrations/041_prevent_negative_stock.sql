-- Migration 041: Prevent negative inventory stock
-- Description: Add database constraint to prevent negative stock quantities
-- Date: 2026-09-26

-- Drop existing constraint if exists (for re-runnable migrations)
ALTER TABLE product_inventory DROP CONSTRAINT IF EXISTS valid_stock;

-- Add constraint to prevent negative stock quantities
ALTER TABLE product_inventory 
ADD CONSTRAINT valid_stock CHECK (stock_quantity >= 0);

-- Also ensure in_stock boolean is consistent with stock_quantity
-- This is handled by the UPDATE statement in inventory functions