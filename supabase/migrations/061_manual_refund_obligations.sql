-- Direct full-order refunds must also appear in the repayment ledger.
ALTER TABLE cod_refund_obligations ALTER COLUMN request_id DROP NOT NULL;
CREATE FUNCTION enqueue_manual_cod_refund() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owed integer;
BEGIN
 IF NEW.status='refunded' AND OLD.status IS DISTINCT FROM 'refunded'
   AND NEW.payment_provider='cod'
   AND NOT EXISTS(SELECT 1 FROM order_return_requests WHERE order_id=NEW.id AND status IN ('pending','approved')) THEN
   SELECT greatest(NEW.total-coalesce(sum(amount),0),0)::integer INTO owed FROM cod_refund_obligations WHERE order_id=NEW.id;
   IF owed>0 THEN INSERT INTO cod_refund_obligations(order_id,amount) VALUES(NEW.id,owed); END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION enqueue_manual_cod_refund() FROM PUBLIC;
CREATE TRIGGER manual_cod_refund AFTER UPDATE OF status ON orders FOR EACH ROW EXECUTE FUNCTION enqueue_manual_cod_refund();
