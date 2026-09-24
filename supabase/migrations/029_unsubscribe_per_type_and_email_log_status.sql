-- Migration 029: Per-type email unsubscribe + email_logs status columns
--
-- process_unsubscribe previously set newsletter_subscribers.is_active = FALSE
-- for EVERY type of unsubscribe (including a single-type link). Now:
--   - global (email_type IS NULL): legacy behavior (newsletter inactive)
--     AND a ('all') row in email_opt_outs
--   - typed: insert (email, email_type) into email_opt_outs only
-- should_send_email gains an optional p_email_type and honors both paths.
-- log_email_send gains p_status / p_error_message (sendEmail failure logging).

-- email_logs status/error columns may already exist from 006 CREATE TABLE —
-- ensure they for older databases.
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent';
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE TABLE IF NOT EXISTS email_opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  email_type TEXT NOT NULL, -- 'all' | 'cart_abandonment' | 'back_in_stock' | 'newsletter' | ...
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email, email_type)
);
ALTER TABLE email_opt_outs ENABLE ROW LEVEL SECURITY;
-- No policies: service_role / SECURITY DEFINER only.
CREATE INDEX IF NOT EXISTS email_opt_outs_email_idx ON email_opt_outs(email);

DROP FUNCTION IF EXISTS process_unsubscribe(TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION process_unsubscribe(
  p_token TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_email_type TEXT;
BEGIN
  SELECT email, email_type INTO v_email, v_email_type
    FROM unsubscribe_tokens
   WHERE token = p_token
     AND used_at IS NULL
     AND expires_at > NOW();

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired unsubscribe link');
  END IF;

  IF v_email_type IS NULL OR v_email_type = '' THEN
    -- Global unsubscribe: newsletter off + explicit ('all') opt-out row
    UPDATE newsletter_subscribers
       SET is_active = FALSE,
           unsubscribed_at = NOW(),
           updated_at = NOW()
     WHERE email = v_email;
    INSERT INTO email_opt_outs (email, email_type)
    VALUES (lower(trim(v_email)), 'all')
    ON CONFLICT (email, email_type) DO NOTHING;
  ELSE
    -- Type-specific unsubscribe: only that type
    INSERT INTO email_opt_outs (email, email_type)
    VALUES (lower(trim(v_email)), lower(trim(v_email_type)))
    ON CONFLICT (email, email_type) DO NOTHING;
  END IF;

  INSERT INTO unsubscribe_audit_log (email, unsubscribe_type, unsubscribe_method, reason, user_agent, ip_address)
  VALUES (v_email, COALESCE(v_email_type, 'all'), 'link', p_reason, p_user_agent, p_ip_address);

  UPDATE unsubscribe_tokens SET used_at = NOW() WHERE token = p_token;

  RETURN jsonb_build_object(
    'success', true,
    'email', v_email,
    'unsubscribed_from', COALESCE(v_email_type, 'all')
  );
END;
$$;
REVOKE ALL ON FUNCTION process_unsubscribe(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_unsubscribe(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- Back-compat single-arg overload used by some clients
DROP FUNCTION IF EXISTS should_send_email(TEXT);
CREATE OR REPLACE FUNCTION should_send_email(p_email TEXT, p_email_type TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active BOOLEAN;
  v_opt_out_count INTEGER;
BEGIN
  -- Legacy global rule: newsletter inactive means no marketing emails
  SELECT is_active INTO v_active
    FROM newsletter_subscribers
   WHERE lower(email) = lower(trim(p_email))
   LIMIT 1;

  IF COALESCE(v_active, TRUE) = FALSE THEN
    RETURN FALSE;
  END IF;

  IF p_email_type IS NULL OR p_email_type = '' THEN
    -- Global check: any opt-out row blocks global sends
    SELECT COUNT(*) INTO v_opt_out_count
      FROM email_opt_outs
     WHERE lower(email) = lower(trim(p_email));
    RETURN v_opt_out_count = 0;
  END IF;

  -- Type-specific: block if ('all') or that exact type is opted out
  SELECT COUNT(*) INTO v_opt_out_count
    FROM email_opt_outs
   WHERE lower(email) = lower(trim(p_email))
     AND email_type IN ('all', lower(trim(p_email_type)));
  RETURN v_opt_out_count = 0;
END;
$$;
REVOKE ALL ON FUNCTION should_send_email(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION should_send_email(TEXT, TEXT) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS log_email_send(TEXT, TEXT, TEXT, JSONB);
CREATE OR REPLACE FUNCTION log_email_send(
  p_recipient_email TEXT,
  p_email_type TEXT,
  p_subject TEXT,
  p_metadata JSONB DEFAULT NULL,
  p_status TEXT DEFAULT 'sent',
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO email_logs (recipient_email, email_type, subject, metadata, status, error_message)
  VALUES (p_recipient_email, p_email_type, p_subject, p_metadata, p_status, p_error_message)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$;
REVOKE ALL ON FUNCTION log_email_send(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_email_send(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) TO service_role;
