-- ============================================================================
-- NERVE — Migration 009
-- One-click unsubscribe system for email marketing.
--
-- Adds:
--   - unsubscribe_tokens      : single-use, expiring tokens embedded in email links
--   - unsubscribe_audit_log   : record of every unsubscribe/resubscribe action
--   - create_unsubscribe_token() : mint a token for a recipient + email type
--   - process_unsubscribe()      : redeem a token (service-role edge function only)
--   - should_send_email()        : per-recipient opt-out check for senders
--
-- The client (emailAutomation.ts) may create tokens and check opt-out status;
-- only the handle-unsubscribe edge function may redeem a token.
-- ============================================================================

-- ============================================================================
-- UNSUBSCRIBE TOKENS
-- ============================================================================
CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  email_type TEXT,                -- NULL means "all emails"
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS unsubscribe_tokens_token_idx ON unsubscribe_tokens(token);
CREATE INDEX IF NOT EXISTS unsubscribe_tokens_email_idx ON unsubscribe_tokens(email);

ALTER TABLE unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: fully locked to service_role / SECURITY DEFINER functions.

-- ============================================================================
-- UNSUBSCRIBE AUDIT LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS unsubscribe_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  unsubscribe_type TEXT NOT NULL DEFAULT 'all',
  unsubscribe_method TEXT NOT NULL DEFAULT 'link', -- 'link', 'feedback', 'admin', 'resubscribe'
  reason TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS unsubscribe_audit_log_email_idx ON unsubscribe_audit_log(email);
CREATE INDEX IF NOT EXISTS unsubscribe_audit_log_created_at_idx ON unsubscribe_audit_log(created_at DESC);

ALTER TABLE unsubscribe_audit_log ENABLE ROW LEVEL SECURITY;

-- Anyone may append an audit row (e.g. the Unsubscribe page's feedback form).
DROP POLICY IF EXISTS "Anyone can log an unsubscribe event" ON unsubscribe_audit_log;
CREATE POLICY "Anyone can log an unsubscribe event" ON unsubscribe_audit_log FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view unsubscribe logs" ON unsubscribe_audit_log;
CREATE POLICY "Admins can view unsubscribe logs" ON unsubscribe_audit_log FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Mint a single-use, expiring token for a recipient (and optionally a
-- specific email type). Returns the raw token; the caller embeds it in a
-- /unsubscribe?token=... link.
CREATE OR REPLACE FUNCTION create_unsubscribe_token(
  p_email TEXT,
  p_email_type TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO unsubscribe_tokens (email, email_type, token, expires_at)
  VALUES (
    lower(trim(p_email)),
    NULLIF(p_email_type, ''),
    v_token,
    NOW() + INTERVAL '7 days'
  );

  RETURN v_token;
END;
$$;

-- Redeem a token: mark the recipient unsubscribed, record the audit row, and
-- invalidate the token. Returns { success, email, unsubscribed_from, error }.
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

  UPDATE newsletter_subscribers
     SET is_active = FALSE,
         unsubscribed_at = NOW(),
         updated_at = NOW()
   WHERE email = v_email;

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

-- True unless the recipient has opted out (or was never a subscriber).
CREATE OR REPLACE FUNCTION should_send_email(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active BOOLEAN;
BEGIN
  SELECT is_active INTO v_active
    FROM newsletter_subscribers
   WHERE email = lower(trim(p_email));

  RETURN COALESCE(v_active, TRUE);
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================
-- Minting tokens and checking opt-out status are called from the client
-- (emailAutomation.ts) as well as from edge functions, so they stay PUBLIC.
-- Redemption is strictly service-role: the handle-unsubscribe edge function
-- resolves the caller by token, never trusting a client-supplied email.
REVOKE ALL ON FUNCTION process_unsubscribe(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_unsubscribe(TEXT, TEXT, TEXT, TEXT) TO service_role;

