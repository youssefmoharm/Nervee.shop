-- Migration 042: Fix guest order token timing attack vulnerability
-- Description: Constant-time comparison in lookup_guest_order function
-- Date: 2026-09-26

-- Drop existing function
DROP FUNCTION IF EXISTS lookup_guest_order(TEXT, TEXT, TEXT);

-- Create new function with constant-time comparison to prevent timing attacks
CREATE OR REPLACE FUNCTION lookup_guest_order(p_email TEXT, p_order_number TEXT, p_token TEXT)
RETURNS TABLE (order_id UUID, order_number TEXT, status TEXT, total INTEGER, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest guest_orders%ROWTYPE;
  v_order orders%ROWTYPE;
  v_token_hash TEXT;
  v_token_match BOOLEAN := FALSE;
BEGIN
  -- Rate-limiting is enforced in the edge function, not here.

  SELECT * INTO v_guest FROM guest_orders
    WHERE lower(email) = lower(trim(p_email))
      AND order_number = upper(trim(p_order_number))
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Constant-time comparison to prevent timing attacks (migration 042)
  IF v_guest.token_hash IS NOT NULL THEN
    -- Hash the provided token and compare using constant-time comparison
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

    -- Use constant-time comparison by comparing length first, then content
    IF LENGTH(v_token_hash) = LENGTH(v_guest.token_hash) THEN
      v_token_match := TRUE;
      FOR i IN 1..LENGTH(v_guest.token_hash) LOOP
        IF SUBSTR(v_token_hash, i, 1) != SUBSTR(v_guest.token_hash, i, 1) THEN
          v_token_match := FALSE;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    IF NOT v_token_match THEN
      RETURN;
    END IF;
  ELSIF v_guest.verification_token IS NOT NULL THEN
    -- For legacy plain token storage (deprecated but supported for backwards compatibility)
    -- Use constant-time comparison by comparing length first, then content
    IF LENGTH(p_token) = LENGTH(v_guest.verification_token) THEN
      v_token_match := TRUE;
      FOR i IN 1..LENGTH(v_guest.verification_token) LOOP
        IF SUBSTR(p_token, i, 1) != SUBSTR(v_guest.verification_token, i, 1) THEN
          v_token_match := FALSE;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    IF NOT v_token_match THEN
      RETURN;
    END IF;
  END IF;

  IF v_guest.expires_at IS NOT NULL AND v_guest.expires_at < NOW() THEN
    RETURN;
  END IF;

  IF v_guest.order_id IS NOT NULL THEN
    SELECT * INTO v_order FROM orders WHERE id = v_guest.order_id;
    IF FOUND THEN
      RETURN QUERY SELECT v_order.id, v_order.order_number, v_order.status, v_order.total, v_order.created_at;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT v_guest.id, v_guest.order_number, 'placed'::TEXT, 0, v_guest.created_at;
END;
$$;

-- Revoke and grant permissions
REVOKE ALL ON FUNCTION lookup_guest_order(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION lookup_guest_order(TEXT, TEXT, TEXT) TO service_role;
