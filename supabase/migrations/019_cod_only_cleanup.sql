-- ============================================================================
-- NERVE — Migration 019: COD-only cleanup
--
-- Removes Paymob-specific constraints and validates COD-only state.
-- This migration is idempotent and safe to run multiple times.
-- ============================================================================

-- Drop any Paymob-specific constraints if they exist
ALTER TABLE payment_attempts DROP CONSTRAINT IF EXISTS payment_attempts_provider_check;

-- Re-add COD-only constraint (idempotent)
ALTER TABLE payment_attempts ADD CONSTRAINT payment_attempts_provider_check CHECK (provider IN ('cod'));

-- Ensure orders.payment_provider is COD-only
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_provider_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_provider_check CHECK (payment_provider IN ('cod'));

-- Drop any Paymob webhook provider checks
-- (existing records with non-cod providers will need manual cleanup before this runs)
-- Optional: Clean up old Paymob records (uncomment if needed)
-- DELETE FROM payment_attempts WHERE provider = 'paymob';
-- DELETE FROM payment_webhooks WHERE provider = 'paymob';

-- Update comments to reflect COD-only
COMMENT ON TABLE payment_attempts IS 'COD-only payment attempts. NERVE uses Cash on Delivery only.';
COMMENT ON TABLE refunds IS 'Order refunds. Supports COD refunds via admin interface.';

-- Update indexes for COD-specific queries
CREATE INDEX IF NOT EXISTS payment_attempts_status_idx ON payment_attempts(status);
CREATE INDEX IF NOT EXISTS payment_attempts_provider_status_idx ON payment_attempts(provider, status);
