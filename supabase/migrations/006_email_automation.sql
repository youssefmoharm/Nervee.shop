-- NERVE Email Automation System
-- Adds support for newsletter subscriptions, email logs, and back-in-stock tracking

-- ============================================================================
-- NEWSLETTER SUBSCRIBERS
-- ============================================================================
CREATE TABLE newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX newsletter_subscribers_email_idx ON newsletter_subscribers(email);
CREATE INDEX newsletter_subscribers_is_active_idx ON newsletter_subscribers(is_active);

-- ============================================================================
-- EMAIL LOGS (for tracking and analytics)
-- ============================================================================
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_email TEXT NOT NULL,
  email_type TEXT NOT NULL, -- 'welcome', 'cart_abandonment', 'back_in_stock', 'order_confirmation', 'order_shipped', 'order_delivered'
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  status TEXT DEFAULT 'sent', -- 'pending', 'sent', 'failed', 'bounced', 'unsubscribed'
  error_message TEXT,
  metadata JSONB, -- custom data for this email (order_id, product_id, etc.)
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX email_logs_recipient_idx ON email_logs(recipient_email);
CREATE INDEX email_logs_email_type_idx ON email_logs(email_type);
CREATE INDEX email_logs_status_idx ON email_logs(status);
CREATE INDEX email_logs_sent_at_idx ON email_logs(sent_at);

-- ============================================================================
-- BACK IN STOCK REQUESTS (for tracking who wants to be notified)
-- ============================================================================
CREATE TABLE back_in_stock_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  size TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  
  UNIQUE(product_id, customer_email, size)
);

CREATE INDEX back_in_stock_requests_product_id_idx ON back_in_stock_requests(product_id);
CREATE INDEX back_in_stock_requests_email_idx ON back_in_stock_requests(customer_email);
CREATE INDEX back_in_stock_requests_is_active_idx ON back_in_stock_requests(is_active);

-- ============================================================================
-- CART ABANDONMENT TRACKING
-- ============================================================================
CREATE TABLE cart_abandonment_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_email TEXT NOT NULL,
  cart_items JSONB NOT NULL, -- stores the abandoned cart contents
  cart_value INTEGER NOT NULL, -- in EGP cents
  last_activity_at TIMESTAMPTZ NOT NULL,
  email_sent_at TIMESTAMPTZ,
  recovered_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX cart_abandonment_customer_email_idx ON cart_abandonment_tracking(customer_email);
CREATE INDEX cart_abandonment_email_sent_at_idx ON cart_abandonment_tracking(email_sent_at);
CREATE INDEX cart_abandonment_recovered_at_idx ON cart_abandonment_tracking(recovered_at);

-- ============================================================================
-- ENABLE RLS
-- ============================================================================
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE back_in_stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_abandonment_tracking ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Newsletter subscribers: users can view/update their own, admins can do everything
CREATE POLICY "Users can view own newsletter subscription" ON newsletter_subscribers FOR SELECT USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

CREATE POLICY "Public can insert newsletter subscription" ON newsletter_subscribers FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all newsletter subscribers" ON newsletter_subscribers FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

CREATE POLICY "Admins can update newsletter subscribers" ON newsletter_subscribers FOR UPDATE USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

-- Email logs: admins only (service role writes via Edge Functions)
CREATE POLICY "Admins can view email logs" ON email_logs FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

-- Back in stock requests: users can CRUD their own, service role can read
CREATE POLICY "Users can view own back in stock requests" ON back_in_stock_requests FOR SELECT USING (
  customer_email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
  auth.uid() IN (SELECT user_id FROM admin_users)
);

CREATE POLICY "Users can insert back in stock requests" ON back_in_stock_requests FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can delete own back in stock requests" ON back_in_stock_requests FOR DELETE USING (
  customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Cart abandonment tracking: service role only (via Edge Functions)
-- No RLS select policies - accessed only via service role

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to automatically update updated_at on newsletter_subscribers
CREATE TRIGGER update_newsletter_subscribers_updated_at BEFORE UPDATE ON newsletter_subscribers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically update updated_at on cart_abandonment_tracking
CREATE TRIGGER update_cart_abandonment_tracking_updated_at BEFORE UPDATE ON cart_abandonment_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STORED PROCEDURES FOR EMAIL OPERATIONS
-- ============================================================================

-- Procedure to log an email send
CREATE OR REPLACE FUNCTION log_email_send(
  p_recipient_email TEXT,
  p_email_type TEXT,
  p_subject TEXT,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO email_logs (recipient_email, email_type, subject, metadata)
  VALUES (p_recipient_email, p_email_type, p_subject, p_metadata)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Procedure to mark back-in-stock as notified
CREATE OR REPLACE FUNCTION mark_back_in_stock_notified(p_request_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE back_in_stock_requests
  SET notified_at = NOW(), is_active = FALSE
  WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql;

-- Procedure to find abandoned carts for email sending (carts inactive for 24+ hours)
CREATE OR REPLACE FUNCTION find_abandoned_carts_for_email()
RETURNS TABLE(
  customer_email TEXT,
  cart_items JSONB,
  cart_value INTEGER,
  last_activity_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cat.customer_email,
    cat.cart_items,
    cat.cart_value,
    cat.last_activity_at
  FROM cart_abandonment_tracking cat
  WHERE cat.email_sent_at IS NULL
    AND cat.recovered_at IS NULL
    AND NOW() - cat.last_activity_at > INTERVAL '24 hours'
  ORDER BY cat.last_activity_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Procedure to mark cart as email sent
CREATE OR REPLACE FUNCTION mark_cart_abandonment_email_sent(p_customer_email TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE cart_abandonment_tracking
  SET email_sent_at = NOW()
  WHERE customer_email = p_customer_email
    AND email_sent_at IS NULL
    AND recovered_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Procedure to mark cart as recovered (order placed)
CREATE OR REPLACE FUNCTION mark_cart_abandonment_recovered(p_customer_email TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE cart_abandonment_tracking
  SET recovered_at = NOW()
  WHERE customer_email = p_customer_email
    AND recovered_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Procedure to find products back in stock that have pending notifications
CREATE OR REPLACE FUNCTION find_back_in_stock_notifications()
RETURNS TABLE(
  request_id UUID,
  product_id TEXT,
  customer_email TEXT,
  size TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bisr.id,
    bisr.product_id,
    bisr.customer_email,
    bisr.size
  FROM back_in_stock_requests bisr
  JOIN product_inventory pi ON bisr.product_id = pi.product_id 
    AND (bisr.size IS NULL OR pi.size = bisr.size)
  WHERE bisr.is_active = TRUE
    AND bisr.notified_at IS NULL
    AND pi.in_stock = TRUE
    AND pi.stock_quantity > 0
  ORDER BY bisr.requested_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INDEXES FOR COMMON QUERIES
-- ============================================================================
CREATE INDEX back_in_stock_requests_active_idx ON back_in_stock_requests(is_active, notified_at);
CREATE INDEX cart_abandonment_pending_emails_idx ON cart_abandonment_tracking(email_sent_at, recovered_at, last_activity_at);
CREATE INDEX email_logs_recent_idx ON email_logs(created_at DESC);
