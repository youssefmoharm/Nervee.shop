-- ============================================================================
-- NERVE — Migration 020: Secure Chat and Ticket Views with RLS
--
-- RISK: active_conversations and tickets_needing_attention views have no RLS
-- policies, exposing metadata (IDs, emails, topics, status) to all users.
--
-- FIX: Replace permissive views with security_definer functions that enforce
-- admin-only or user-specific access control.
-- ============================================================================

-- ============================================================================
-- 1. REPLACE active_conversations VIEW with SECURITY DEFINER function
-- ============================================================================

-- Drop the view
DROP VIEW IF EXISTS active_conversations CASCADE;

-- Create a secure function that returns the same data but enforces access control
CREATE OR REPLACE FUNCTION active_conversations_for_admin()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  email TEXT,
  topic TEXT,
  sentiment TEXT,
  status TEXT,
  message_count INTEGER,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_is_admin BOOLEAN := false;
BEGIN
  v_caller_uid := auth.uid();
  
  -- Admin check
  IF v_caller_uid IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM admin_users WHERE user_id = v_caller_uid) INTO v_is_admin;
  END IF;
  
  -- Only admins can see all conversations
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden: admin access required' USING ERRCODE = '42501';
  END IF;
  
  -- Return all active conversations (admin view)
  RETURN QUERY
  SELECT
    c.id,
    c.user_id,
    c.email,
    c.topic,
    c.sentiment,
    c.status,
    (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id)::INTEGER,
    (SELECT MAX(created_at) FROM chat_messages WHERE conversation_id = c.id),
    c.created_at
  FROM chat_conversations c
  WHERE c.status != 'closed'
  ORDER BY c.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION active_conversations_for_admin() TO authenticated, service_role;

-- ============================================================================
-- 2. REPLACE tickets_needing_attention VIEW with SECURITY DEFINER function
-- ============================================================================

-- Drop the view
DROP VIEW IF EXISTS tickets_needing_attention CASCADE;

-- Create a secure function that returns the same data but enforces access control
CREATE OR REPLACE FUNCTION tickets_needing_attention_for_admin()
RETURNS TABLE (
  id UUID,
  ticket_number TEXT,
  user_id UUID,
  email TEXT,
  subject TEXT,
  status TEXT,
  priority TEXT,
  created_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_is_admin BOOLEAN := false;
BEGIN
  v_caller_uid := auth.uid();
  
  -- Admin check
  IF v_caller_uid IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM admin_users WHERE user_id = v_caller_uid) INTO v_is_admin;
  END IF;
  
  -- Only admins can see all tickets
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden: admin access required' USING ERRCODE = '42501';
  END IF;
  
  -- Return all tickets needing attention (admin view)
  RETURN QUERY
  SELECT
    t.id,
    t.ticket_number,
    t.user_id,
    t.email,
    t.subject,
    t.status,
    t.priority,
    t.created_at,
    t.updated_at
  FROM support_tickets t
  WHERE t.status IN ('open', 'in_progress')
  ORDER BY
    CASE t.priority
      WHEN 'urgent' THEN 1
      WHEN 'normal' THEN 2
      WHEN 'low' THEN 3
      ELSE 4
    END,
    t.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION tickets_needing_attention_for_admin() TO authenticated, service_role;

-- ============================================================================
-- 3. UPDATE admin dashboard / backend code to use new functions
--
-- NOTE: Any backend code or admin dashboard that previously queried these
-- views must be updated to call the functions instead:
--
-- OLD: SELECT * FROM active_conversations;
-- NEW: SELECT * FROM active_conversations_for_admin();
--
-- OLD: SELECT * FROM tickets_needing_attention;
-- NEW: SELECT * FROM tickets_needing_attention_for_admin();
-- ============================================================================
