-- Item-level returns, size exchanges and auditable COD repayment obligations.
ALTER SEQUENCE public.order_number_seq MAXVALUE 9223372036854775807;
ALTER TABLE order_items ADD COLUMN exchanged_quantity integer NOT NULL DEFAULT 0 CHECK(exchanged_quantity>=0);
ALTER TABLE order_items ADD COLUMN returned_quantity integer NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0 AND returned_quantity <= quantity);
ALTER TABLE order_return_requests DROP CONSTRAINT order_return_requests_type_check;
ALTER TABLE order_return_requests ADD CONSTRAINT order_return_requests_type_check CHECK(type IN ('cancellation','return','exchange'));
ALTER TABLE order_return_requests DROP CONSTRAINT order_return_requests_order_id_type_key;
CREATE UNIQUE INDEX one_active_return_per_order ON order_return_requests(order_id) WHERE status IN ('pending','approved');
CREATE TABLE return_request_items (
  request_id uuid REFERENCES order_return_requests(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES order_items(id),
  quantity integer NOT NULL CHECK(quantity > 0),
  replacement_size text CHECK(replacement_size IN ('XS','S','M','L','XL','XXL')),
  PRIMARY KEY(request_id,order_item_id)
);
CREATE TABLE cod_refund_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid UNIQUE NOT NULL REFERENCES order_return_requests(id),
  order_id uuid NOT NULL REFERENCES orders(id),
  amount integer NOT NULL CHECK(amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cod_refund_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id uuid NOT NULL REFERENCES cod_refund_obligations(id),
  amount integer NOT NULL CHECK(amount > 0),
  reference text UNIQUE NOT NULL CHECK(length(trim(reference)) BETWEEN 3 AND 200),
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  paid_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE return_exchange_shipments (
  request_id uuid PRIMARY KEY REFERENCES order_return_requests(id),
  tracking_number text, tracking_url text CHECK(tracking_url IS NULL OR tracking_url ~ '^https://'),
  shipped_at timestamptz, recorded_by uuid REFERENCES auth.users(id)
);
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['return_request_items','cod_refund_obligations','cod_refund_payments','return_exchange_shipments'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
    EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated',tab);
    EXECUTE format('GRANT SELECT ON %I TO authenticated',tab);
    EXECUTE format('GRANT ALL ON %I TO service_role',tab);
    EXECUTE format('CREATE POLICY admin_read ON %I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()))',tab);
  END LOOP;
END $$;

-- Only the authenticated edge function can supply a verified customer/order.
CREATE FUNCTION create_item_return_request(p_order_id uuid,p_customer_id uuid,p_type text,p_reason text,p_items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o orders; req uuid; line jsonb; item order_items; requested integer; seen uuid[] := '{}';
BEGIN
 SELECT * INTO o FROM orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF p_type NOT IN ('return','exchange','cancellation') OR length(trim(p_reason)) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'Invalid return request'; END IF;
 IF p_type='cancellation' THEN
   IF o.status NOT IN ('placed','processing') OR o.placed_at < now()-interval '2 hours' THEN RAISE EXCEPTION 'Cancellation window expired'; END IF;
 ELSE
   IF o.status <> 'delivered' OR o.delivered_at IS NULL OR o.delivered_at < now()-(CASE WHEN p_type='exchange' THEN interval '30 days' ELSE interval '7 days' END) THEN RAISE EXCEPTION 'Return or exchange window expired'; END IF;
   IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'Select items and quantities'; END IF;
 END IF;
 INSERT INTO order_return_requests(order_id,customer_id,type,reason) VALUES(p_order_id,p_customer_id,p_type,p_reason) RETURNING id INTO req;
 IF p_type <> 'cancellation' THEN
   FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
     SELECT * INTO item FROM order_items WHERE id=(line->>'orderItemId')::uuid AND order_id=o.id FOR UPDATE;
     requested := (line->>'quantity')::integer;
     IF NOT FOUND OR item.id=ANY(seen) OR requested IS NULL OR requested<=0 OR requested>item.quantity-item.returned_quantity THEN RAISE EXCEPTION 'Invalid item quantity'; END IF;
     seen := array_append(seen,item.id);
     IF p_type='exchange' AND (line->>'replacementSize' IS NULL OR line->>'replacementSize'=item.size OR NOT EXISTS(SELECT 1 FROM product_inventory WHERE product_id=item.product_id AND size=line->>'replacementSize')) THEN RAISE EXCEPTION 'Choose a different available size'; END IF;
     INSERT INTO return_request_items VALUES(req,item.id,requested,CASE WHEN p_type='exchange' THEN line->>'replacementSize' ELSE NULL END);
   END LOOP;
 END IF;
 RETURN req;
END $$;
REVOKE ALL ON FUNCTION create_item_return_request(uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION create_item_return_request(uuid,uuid,text,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION resolve_return_request(p_id uuid,p_status text,p_expected_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE req order_return_requests; o orders; line record; refund integer:=0; target product_inventory; previous_context text := current_setting('nerve.resolving_return',true);
BEGIN
 IF NOT EXISTS(SELECT 1 FROM admin_users WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
 -- Lock the order first, matching request creation and inventory operations.
 SELECT ord.* INTO o FROM orders ord JOIN order_return_requests r ON r.order_id=ord.id WHERE r.id=p_id FOR UPDATE OF ord;
 SELECT * INTO req FROM order_return_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR req.status<>p_expected_status THEN RAISE EXCEPTION 'Return changed; refresh and try again'; END IF;
 IF NOT ((req.status='pending' AND p_status IN ('approved','rejected')) OR (req.status='approved' AND p_status='completed')) THEN RAISE EXCEPTION 'Invalid return transition'; END IF;
 IF p_status='completed' THEN
   PERFORM set_config('nerve.resolving_return',p_id::text,true);
   IF req.type='cancellation' THEN
     PERFORM update_order_status(o.id,'cancelled',NULL,NULL,'Cancellation completed',auth.uid());
   ELSIF NOT EXISTS(SELECT 1 FROM return_request_items WHERE request_id=p_id) THEN
     -- Compatibility with requests created before item selection was added.
     IF req.type <> 'return' THEN RAISE EXCEPTION 'Exchange items required'; END IF;
     PERFORM update_order_status(o.id,'refunded',NULL,NULL,'Legacy return completed',auth.uid());
     refund:=o.total;
     UPDATE order_items SET returned_quantity=quantity WHERE order_id=o.id;
   ELSE
     IF o.status <> 'delivered' THEN RAISE EXCEPTION 'Order is no longer eligible'; END IF;
     -- Lock all affected inventory in a stable order before mutating any stock.
     PERFORM 1 FROM product_inventory i WHERE EXISTS (
       SELECT 1 FROM return_request_items r JOIN order_items oi ON oi.id=r.order_item_id
       WHERE r.request_id=p_id AND oi.product_id=i.product_id AND i.size IN (oi.size,r.replacement_size)
     ) ORDER BY i.product_id,i.size FOR UPDATE;
     FOR line IN SELECT r.*,oi.product_id,oi.size,oi.quantity AS bought,oi.returned_quantity,oi.subtotal
       FROM return_request_items r JOIN order_items oi ON oi.id=r.order_item_id WHERE r.request_id=p_id LOOP
       IF line.quantity>line.bought-line.returned_quantity THEN RAISE EXCEPTION 'Items already returned'; END IF;
       UPDATE product_inventory SET stock_quantity=stock_quantity+line.quantity,in_stock=true WHERE product_id=line.product_id AND size=line.size;
       IF req.type='exchange' THEN
         SELECT * INTO target FROM product_inventory WHERE product_id=line.product_id AND size=line.replacement_size;
         IF NOT FOUND OR NOT target.in_stock OR target.stock_quantity<line.quantity THEN RAISE EXCEPTION 'Replacement size is out of stock'; END IF;
         UPDATE product_inventory SET stock_quantity=stock_quantity-line.quantity,in_stock=stock_quantity-line.quantity>0 WHERE id=target.id;
       ELSE
         -- Cumulative allocation avoids penny/EGP drift across multiple returns.
         refund:=refund+floor(line.subtotal::numeric*(line.returned_quantity+line.quantity)/line.bought*(o.subtotal-o.discount_amount)/greatest(o.subtotal,1))::integer
           -floor(line.subtotal::numeric*line.returned_quantity/line.bought*(o.subtotal-o.discount_amount)/greatest(o.subtotal,1))::integer;
       END IF;
       UPDATE order_items SET returned_quantity=returned_quantity+line.quantity, exchanged_quantity=exchanged_quantity+CASE WHEN req.type='exchange' THEN line.quantity ELSE 0 END WHERE id=line.order_item_id;
     END LOOP;
     IF req.type='exchange' THEN
       INSERT INTO return_exchange_shipments(request_id) VALUES(p_id);
     ELSIF NOT EXISTS(SELECT 1 FROM order_items WHERE order_id=o.id AND returned_quantity-exchanged_quantity<quantity) THEN
       PERFORM update_order_status(o.id,'refunded',NULL,NULL,'All items returned',auth.uid());
     END IF;
   END IF;
   IF req.type='return' THEN INSERT INTO cod_refund_obligations(request_id,order_id,amount) VALUES(p_id,o.id,refund); END IF;
 END IF;
 UPDATE order_return_requests SET status=p_status,resolved_by=auth.uid(),resolved_at=CASE WHEN p_status IN ('completed','rejected') THEN now() END WHERE id=p_id;
 PERFORM set_config('nerve.resolving_return',coalesce(previous_context,''),true);
END $$;

CREATE FUNCTION record_cod_refund(p_obligation_id uuid,p_amount integer,p_reference text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE obligation cod_refund_obligations; paid integer; result uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM admin_users WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO obligation FROM cod_refund_obligations WHERE id=p_obligation_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Refund obligation not found'; END IF;
 SELECT id INTO result FROM cod_refund_payments WHERE reference=trim(p_reference) AND obligation_id=p_obligation_id AND amount=p_amount;
 IF FOUND THEN RETURN result; END IF;
 SELECT coalesce(sum(amount),0) INTO paid FROM cod_refund_payments WHERE obligation_id=p_obligation_id;
 IF p_amount IS NULL OR p_amount<=0 OR paid+p_amount>obligation.amount THEN RAISE EXCEPTION 'Repayment exceeds outstanding balance'; END IF;
 INSERT INTO cod_refund_payments(obligation_id,amount,reference,recorded_by) VALUES(p_obligation_id,p_amount,trim(p_reference),auth.uid()) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION record_cod_refund(uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION record_cod_refund(uuid,integer,text) TO authenticated;
CREATE FUNCTION record_exchange_shipment(p_request_id uuid,p_number text,p_url text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM admin_users WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
 IF length(trim(p_number)) NOT BETWEEN 1 AND 200 OR p_url IS NULL OR p_url !~ '^https://' THEN RAISE EXCEPTION 'HTTPS tracking URL and number required'; END IF;
 UPDATE return_exchange_shipments SET tracking_number=trim(p_number),tracking_url=p_url,shipped_at=now(),recorded_by=auth.uid() WHERE request_id=p_request_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Completed exchange not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION record_exchange_shipment(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION record_exchange_shipment(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION update_order_status(
  p_order_id UUID,
  p_status TEXT,
  p_tracking_number TEXT DEFAULT NULL,
  p_tracking_url TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_changed_by UUID DEFAULT NULL
)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders;
  v_item order_items%ROWTYPE;
  v_from_status TEXT;
BEGIN
  IF p_status NOT IN ('placed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0001';
  END IF;

  v_from_status := v_order.status;
  IF p_status='refunded' AND EXISTS (
    SELECT 1 FROM order_return_requests r WHERE r.order_id=p_order_id AND r.status IN ('pending','approved')
      AND r.id::text IS DISTINCT FROM current_setting('nerve.resolving_return',true)
  ) THEN RAISE EXCEPTION 'Complete or reject the active return request first'; END IF;

  -- Authoritative transition map. Must stay in sync with
  -- src/lib/adminOrders.ts (unit-tested against this contract):
  --   placed     -> processing, cancelled
  --   processing -> shipped, cancelled
  --   shipped    -> delivered, cancelled
  --   delivered  -> refunded
  --   cancelled / refunded are terminal (no cancelled<->refunded shuffle,
  --   no un-cancelling, no skipping placed -> delivered).
  IF NOT (
    (v_from_status = 'placed'       AND p_status IN ('processing', 'cancelled')) OR
    (v_from_status = 'processing'   AND p_status IN ('shipped', 'cancelled')) OR
    (v_from_status = 'shipped'      AND p_status IN ('delivered', 'cancelled')) OR
    (v_from_status = 'delivered'    AND p_status IN ('refunded')) OR
    (v_from_status = p_status)
  ) THEN
    RAISE EXCEPTION 'Cannot move order from % to %', v_from_status, p_status
      USING ERRCODE = 'P0001';
  END IF;

  -- Restock once, only on the transition INTO cancelled/refunded.
  IF p_status IN ('cancelled', 'refunded') AND v_from_status NOT IN ('cancelled', 'refunded') THEN
    FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id
    LOOP
      UPDATE product_inventory
        SET stock_quantity = stock_quantity + (v_item.quantity-v_item.returned_quantity),
            in_stock = TRUE
      WHERE product_id = v_item.product_id AND size = v_item.size;
    END LOOP;
  END IF;

  UPDATE orders SET
    status = p_status,
    payment_status = CASE WHEN p_status = 'refunded' THEN 'refunded' ELSE payment_status END,
    tracking_number = COALESCE(p_tracking_number, tracking_number),
    tracking_url = COALESCE(p_tracking_url, tracking_url),
    shipped_at = CASE WHEN p_status = 'shipped' AND shipped_at IS NULL THEN NOW() ELSE shipped_at END,
    delivered_at = CASE WHEN p_status = 'delivered' AND delivered_at IS NULL THEN NOW() ELSE delivered_at END,
    cancelled_at = CASE WHEN p_status = 'cancelled' AND cancelled_at IS NULL THEN NOW() ELSE cancelled_at END
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  -- Single audit writer (migration 043's duplicate trigger is dropped below).
  IF v_from_status IS DISTINCT FROM p_status THEN
    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, reason)
    VALUES (p_order_id, v_from_status, p_status, p_changed_by, p_reason);
  END IF;

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION update_order_status(UUID, TEXT, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION update_order_status(UUID, TEXT, TEXT, TEXT, TEXT, UUID)
  TO service_role;
