-- Customers can follow their own replacement shipments without admin access.
CREATE POLICY customer_read_items ON return_request_items FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM order_return_requests r JOIN orders o ON o.id=r.order_id WHERE r.id=request_id AND o.customer_id=auth.uid())
);
CREATE POLICY customer_read_shipments ON return_exchange_shipments FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM order_return_requests r JOIN orders o ON o.id=r.order_id WHERE r.id=request_id AND o.customer_id=auth.uid())
);
