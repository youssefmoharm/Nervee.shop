ALTER TABLE order_notification_outbox ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE FUNCTION operations_health() RETURNS TABLE(overdue_notifications bigint,failed_notifications bigint,outstanding_cod_refunds bigint)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT (SELECT count(*) FROM order_notification_outbox WHERE delivered_at IS NULL AND created_at<now()-interval '10 minutes'),
 (SELECT count(*) FROM order_notification_outbox WHERE delivered_at IS NULL AND attempts>=3),
 (SELECT coalesce(sum(o.amount-coalesce(p.paid,0)),0)::bigint FROM cod_refund_obligations o LEFT JOIN (SELECT obligation_id,sum(amount) AS paid FROM cod_refund_payments GROUP BY obligation_id) p ON p.obligation_id=o.id);
$$;
REVOKE ALL ON FUNCTION operations_health() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION operations_health() TO service_role;
