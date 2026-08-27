-- ============================================================================
-- NERVE — Migration 013: Payment Architecture (provider-agnostic)
--
-- Adds provider-agnostic payment tracking so NERVE can support COD + Paymob
-- (and future providers) without trusting browser payment state. COD remains the
-- only active method until Paymob credentials are configured.
-- ============================================================================

-- Ensure pgcrypto for idempotency keys
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- --------------------------------------------------------------------------
-- PAYMENT ATTEMPTS — idempotent, auditable, provider-agnostic
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('cod', 'paymob')),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'EGP',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'captured', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
  provider_transaction_id TEXT,
  provider_response JSONB,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_attempts_order_id_idx ON payment_attempts(order_id);
CREATE INDEX IF NOT EXISTS payment_attempts_provider_tx_idx ON payment_attempts(provider_transaction_id);
CREATE INDEX IF NOT EXISTS payment_attempts_idempotency_idx ON payment_attempts(idempotency_key);

ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;

-- Only service_role and admin can read payment attempts
DROP POLICY IF EXISTS "Admins can view payment attempts" ON payment_attempts;
CREATE POLICY "Admins can view payment attempts" ON payment_attempts FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

DROP POLICY IF EXISTS "Users can view own payment attempts" ON payment_attempts;
CREATE POLICY "Users can view own payment attempts" ON payment_attempts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = payment_attempts.order_id AND orders.customer_id = auth.uid())
  );

-- No anon insert — only service_role via edge functions
-- (no INSERT policy for anon/authenticated)

-- --------------------------------------------------------------------------
-- REFUNDS — separate from returns, provider-verified
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_attempt_id UUID REFERENCES payment_attempts(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'EGP',
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  provider_refund_id TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS refunds_order_id_idx ON refunds(order_id);
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage refunds" ON refunds;
CREATE POLICY "Admins can manage refunds" ON refunds FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

DROP POLICY IF EXISTS "Users can view own refunds" ON refunds;
CREATE POLICY "Users can view own refunds" ON refunds FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = refunds.order_id AND orders.customer_id = auth.uid()));

-- --------------------------------------------------------------------------
-- ORDERS — add columns for payment lifecycle if missing
-- --------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider TEXT CHECK (payment_provider IN ('cod', 'paymob'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partially_refunded'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- --------------------------------------------------------------------------
-- ORDER STATUS AUDIT — preserve history, prevent double-restock
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_status_history_order_id_idx ON order_status_history(order_id);
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view status history" ON order_status_history;
CREATE POLICY "Admins can view status history" ON order_status_history FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

DROP POLICY IF EXISTS "Users can view own order history" ON order_status_history;
CREATE POLICY "Users can view own order history" ON order_status_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_status_history.order_id AND orders.customer_id = auth.uid()));

-- Service role can insert history (via update_order_status edge)
-- No anon insert

-- --------------------------------------------------------------------------
-- CANCELLATION / RETURN REQUESTS
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('cancellation', 'return')),
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(order_id, type) -- prevent duplicate requests per order+type
);

CREATE INDEX IF NOT EXISTS order_return_requests_order_id_idx ON order_return_requests(order_id);
ALTER TABLE order_return_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own return requests" ON order_return_requests;
CREATE POLICY "Users can manage own return requests" ON order_return_requests FOR ALL
  USING (customer_id = auth.uid() OR EXISTS (SELECT 1 FROM orders WHERE orders.id = order_return_requests.order_id AND orders.customer_id = auth.uid()))
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all return requests" ON order_return_requests;
CREATE POLICY "Admins can manage all return requests" ON order_return_requests FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

DROP POLICY IF EXISTS "Guests can view own return requests via order" ON order_return_requests;
-- Guest access is via service_role edge function, not direct RLS

GRANT SELECT ON payment_attempts, refunds, order_status_history, order_return_requests TO authenticated;
GRANT SELECT ON payment_attempts, refunds, order_status_history, order_return_requests TO service_role;
GRANT INSERT, UPDATE ON payment_attempts, refunds, order_status_history, order_return_requests TO service_role;
