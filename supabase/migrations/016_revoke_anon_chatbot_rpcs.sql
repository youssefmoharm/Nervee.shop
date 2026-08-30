-- Fix P0-3: revoke anon execute on SECURITY DEFINER chatbot RPCs
-- 012 revoked PUBLIC but anon remained via explicit grant; explicitly revoke anon

REVOKE ALL ON FUNCTION get_ai_context(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_ai_context(TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION create_ticket_from_chat(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_ticket_from_chat(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION update_conversation_metadata(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION update_conversation_metadata(UUID, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION close_conversation(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION close_conversation(UUID) TO authenticated, service_role;
