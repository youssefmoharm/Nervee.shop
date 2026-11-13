-- Persist guest tracking and notification work in the order transaction.
CREATE TABLE public.order_notification_outbox (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_id uuid,
  delivered_at timestamptz,
  last_error text
);
ALTER TABLE public.order_notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_notification_outbox FROM anon, authenticated;
GRANT ALL ON public.order_notification_outbox TO service_role;
CREATE POLICY admin_read_notifications ON public.order_notification_outbox
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
GRANT SELECT ON public.order_notification_outbox TO authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_order_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE token text;
BEGIN
  IF NEW.customer_id IS NULL THEN
    token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO guest_orders(email, order_number, verification_token, token_hash, expires_at, order_id)
    VALUES (NEW.email, NEW.order_number, token, encode(digest(token, 'sha256'), 'hex'), now() + interval '30 days', NEW.id);
  END IF;
  INSERT INTO order_notification_outbox(order_id) VALUES (NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER enqueue_order_notification AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enqueue_order_notification();
REVOKE ALL ON FUNCTION public.enqueue_order_notification() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.claim_order_notifications(p_order_id uuid DEFAULT NULL)
RETURNS SETOF public.order_notification_outbox LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE order_notification_outbox AS jobs SET
    lease_id = gen_random_uuid(), attempts = jobs.attempts + 1,
    available_at = now() + interval '5 minutes'
  WHERE jobs.order_id IN (
    SELECT q.order_id FROM order_notification_outbox q
    WHERE q.delivered_at IS NULL AND q.available_at <= now()
      AND (p_order_id IS NULL OR q.order_id = p_order_id)
    ORDER BY q.available_at FOR UPDATE SKIP LOCKED LIMIT 10
  ) RETURNING jobs.*;
$$;
REVOKE ALL ON FUNCTION public.claim_order_notifications(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_order_notifications(uuid) TO service_role;

-- Retry every minute. Vault values are configured by the operator, never committed.
DO $$ BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.schedule('order_notifications_minutely', '* * * * *', $job$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/process-order-notifications',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret',
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)),
        body := '{}'::jsonb, timeout_milliseconds := 30000);
    $job$);
  END IF;
END $$;
