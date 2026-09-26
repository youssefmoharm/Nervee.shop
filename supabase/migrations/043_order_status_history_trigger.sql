-- Migration 043: Order status history trigger
-- Description: Add trigger to automatically capture previous status for order_status_history
-- Date: 2026-09-26

-- Drop existing trigger if exists (for re-runnable migrations)
DROP TRIGGER IF EXISTS trigger_order_status_history ON orders;
DROP FUNCTION IF EXISTS update_order_status_history() CASCADE;

-- Create trigger function to capture status history
CREATE OR REPLACE FUNCTION update_order_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If status changed, insert history record
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (
      order_id,
      from_status,
      to_status,
      changed_by,
      reason,
      created_at
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NULL,  -- Will be set by admin when called from edge function
      NULL,  -- Will be set by admin when called from edge function
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on orders table
CREATE TRIGGER trigger_order_status_history
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_history();