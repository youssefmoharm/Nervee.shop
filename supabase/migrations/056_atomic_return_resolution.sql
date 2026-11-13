-- Completing a return and restocking must succeed or fail together.
CREATE OR REPLACE FUNCTION public.resolve_return_request(p_id uuid, p_status text, p_expected_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE request public.order_return_requests;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO request FROM order_return_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR request.status <> p_expected_status THEN RAISE EXCEPTION 'Return changed; refresh and try again'; END IF;
  IF NOT ((request.status = 'pending' AND p_status IN ('approved', 'rejected'))
    OR (request.status = 'approved' AND p_status = 'completed')) THEN RAISE EXCEPTION 'Invalid return transition'; END IF;
  IF p_status = 'completed' THEN
    PERFORM update_order_status(request.order_id,
      CASE WHEN request.type = 'cancellation' THEN 'cancelled' ELSE 'refunded' END,
      NULL, NULL, 'Request completed by admin', auth.uid());
  END IF;
  UPDATE order_return_requests SET status = p_status,
    resolved_by = auth.uid(),
    resolved_at = CASE WHEN p_status IN ('completed', 'rejected') THEN now() ELSE NULL END
    WHERE id = p_id;
END $$;
REVOKE ALL ON FUNCTION public.resolve_return_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_return_request(uuid, text, text) TO authenticated;

-- Customers must not approve their own requests through direct table writes.
REVOKE INSERT, UPDATE, DELETE ON public.order_return_requests FROM authenticated, anon;
