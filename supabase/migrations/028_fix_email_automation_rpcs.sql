-- Migration 028: Fix email automation RPCs
--
-- 012 recreated mark_back_in_stock_notified / find_back_in_stock_notifications /
-- find_abandoned_carts_for_email with regressions vs their 006 originals:
--   - mark_back_in_stock_notified no longer sets is_active=FALSE / notified=TRUE
--   - find_back_in_stock_notifications lost the in-stock JOIN and selects
--     customer_email without COALESCE(customer_email, email)
--   - find_abandoned_carts_for_email lost recovered_at IS NULL
-- All three get SECURITY DEFINER + SET search_path = public.

CREATE OR REPLACE FUNCTION mark_back_in_stock_notified(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE back_in_stock_requests
  SET notified = TRUE,
      notified_at = NOW(),
      is_active = FALSE
  WHERE id = p_request_id;
END;
$$;
REVOKE ALL ON FUNCTION mark_back_in_stock_notified(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_back_in_stock_notified(UUID) TO service_role;

CREATE OR REPLACE FUNCTION find_back_in_stock_notifications()
RETURNS TABLE (request_id UUID, product_id TEXT, customer_email TEXT, size TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bisr.id,
    bisr.product_id,
    COALESCE(bisr.customer_email, bisr.email),
    bisr.size
  FROM back_in_stock_requests bisr
  JOIN product_inventory pi
    ON bisr.product_id = pi.product_id
   AND (bisr.size IS NULL OR pi.size = bisr.size)
  WHERE bisr.is_active = TRUE
    AND bisr.notified = FALSE
    AND bisr.notified_at IS NULL
    AND pi.in_stock = TRUE
    AND pi.stock_quantity > 0
  ORDER BY bisr.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION find_back_in_stock_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_back_in_stock_notifications() TO service_role;

CREATE OR REPLACE FUNCTION find_abandoned_carts_for_email()
RETURNS TABLE (customer_email TEXT, cart_items JSONB, cart_value INTEGER, last_activity_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT cat.customer_email, cat.cart_items, cat.cart_value, cat.last_activity_at
  FROM cart_abandonment_tracking cat
  WHERE cat.email_sent_at IS NULL
    AND cat.recovered_at IS NULL
    AND cat.last_activity_at < NOW() - INTERVAL '24 hours'
  ORDER BY cat.last_activity_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION find_abandoned_carts_for_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_abandoned_carts_for_email() TO service_role;
