-- Revert 015 privilege escalation on place_order and fix merge_guest_cart drift
-- 003 correctly revoked authenticated and granted service_role only for place_order
-- because p_customer_id is a plain param not derived from auth.uid() — granting
-- authenticated would let any user place orders as any other customer_id via anon key.
-- 015 incorrectly re-granted authenticated, reopening the hole. This reverts it.
-- Also fixes merge_guest_cart which drifted to include anon (003 had redefined it to
-- derive auth.uid() internally and grant authenticated only, but anon was re-added).

-- place_order: 13 args (UUID + 11 TEXT + JSONB) per pg_get_function_identity_arguments
REVOKE ALL ON FUNCTION place_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION place_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- merge_guest_cart: single JSONB arg, derives auth.uid() internally per 003
REVOKE ALL ON FUNCTION merge_guest_cart(JSONB) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION merge_guest_cart(JSONB) TO authenticated;

-- Ensure update_order_status remains service_role only (verify, no drift)
-- No change needed, but confirm: 003 granted service_role only and it still holds
