-- ============================================================================
-- NERVE — Migration 011
-- Distributed rate limiting for Edge Functions.
--
-- Adds: rate_limit_requests table and check_rate_limit() function so rate
-- limiting works across all Edge Function instances (not just in-memory,
-- which resets on every cold start). The edge functions' _shared/ratelimit.ts
-- uses this via RPC and falls back to in-memory only if the DB is unreachable.
-- ============================================================================

-- ============================================================================
-- RATE LIMIT REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS rate_limit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,  -- IP address or user ID
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(identifier, window_start)
);

CREATE INDEX IF NOT EXISTS rate_limit_requests_identifier_idx ON rate_limit_requests(identifier);
CREATE INDEX IF NOT EXISTS rate_limit_requests_window_idx ON rate_limit_requests(window_start);

ALTER TABLE rate_limit_requests ENABLE ROW LEVEL SECURITY;

-- Only service role can access (not exposed to clients)
DROP POLICY IF EXISTS "Service role can view" ON rate_limit_requests;
CREATE POLICY "Service role can view" ON rate_limit_requests FOR SELECT
  USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role can insert" ON rate_limit_requests;
CREATE POLICY "Service role can insert" ON rate_limit_requests FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role can update" ON rate_limit_requests;
CREATE POLICY "Service role can update" ON rate_limit_requests FOR UPDATE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- RATE LIMIT CHECK FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_window_start TIMESTAMPTZ,
  p_max_requests INTEGER,
  p_window_ms INTEGER
)
RETURNS TABLE (allowed BOOLEAN, current_count INTEGER, window_end TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_end TIMESTAMPTZ;
  v_current_count INTEGER;
  v_result RECORD;
BEGIN
  v_window_end := p_window_start + (p_window_ms || ' ms')::INTERVAL;

  -- Try to insert a new record or increment existing one
  INSERT INTO rate_limit_requests (identifier, window_start, request_count)
  VALUES (p_identifier, p_window_start, 1)
  ON CONFLICT (identifier, window_start)
  DO UPDATE SET
    request_count = rate_limit_requests.request_count + 1,
    created_at = NOW()
  RETURNING * INTO v_result;

  v_current_count := v_result.request_count;

  -- Check if rate limited
  RETURN QUERY SELECT
    v_current_count <= p_max_requests,
    v_current_count,
    v_window_end;
END;
$$;

-- Allow service role to call this function
REVOKE ALL ON FUNCTION check_rate_limit FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated, service_role;

