-- Fix place_order grants: anon should not be able to call directly
-- Guests go through create-order edge function (service_role)
-- Authenticated users should be able to call via edge as well

REVOKE ALL ON FUNCTION place_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION place_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION place_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM authenticated;

GRANT EXECUTE ON FUNCTION place_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;

-- Verify lookup_guest_order remains service_role only (from 014)
-- No change needed
