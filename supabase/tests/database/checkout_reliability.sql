BEGIN;
DO $$
DECLARE first_order record; retry_order record; token text; lookup record; qty integer; stock integer;
BEGIN
  INSERT INTO products(id,slug,name,category,price,description,material,care)
  VALUES ('regression-tee','regression-tee','Regression Tee','T-Shirts',650,'Test','Cotton','[]');
  INSERT INTO product_inventory(product_id,size,in_stock,stock_quantity) VALUES ('regression-tee','M',true,20);
  INSERT INTO discount_codes(code,discount_type,discount_value,valid_from,is_active) VALUES ('REGRESSION15','percentage',15,now()-interval '1 day',true);
  SELECT * INTO first_order FROM place_order_with_idempotency(NULL,'checkout@example.test','Test','Buyer','01012345678','15 Test Street','Cairo','Cairo',NULL,'standard','cod','REGRESSION15',
    '[{"product_id":"regression-tee","size":"M","color":"Navy","quantity":1}]','regression-checkout-key');
  IF first_order.total <> 652 THEN RAISE EXCEPTION 'Discount parity failed: %',first_order.total; END IF;
  SELECT verification_token INTO token FROM guest_orders WHERE order_id=first_order.order_id;
  SELECT * INTO lookup FROM lookup_guest_order('checkout@example.test',first_order.order_number,token);
  IF lookup.order_id IS DISTINCT FROM first_order.order_id THEN RAISE EXCEPTION 'Guest lookup failed'; END IF;
  IF EXISTS(SELECT 1 FROM lookup_guest_order('checkout@example.test',first_order.order_number,'wrong-token-that-is-at-least-32-characters')) THEN RAISE EXCEPTION 'Wrong token accepted'; END IF;
  SELECT * INTO retry_order FROM place_order_with_idempotency(NULL,'checkout@example.test','Test','Buyer','01012345678','15 Test Street','Cairo','Cairo',NULL,'standard','cod','REGRESSION15',
    '[{"product_id":"regression-tee","size":"M","quantity":1}]','regression-checkout-key');
  IF retry_order.order_id <> first_order.order_id OR NOT retry_order.is_duplicate THEN RAISE EXCEPTION 'Retry created another order'; END IF;
  SELECT stock_quantity INTO stock FROM product_inventory WHERE product_id='regression-tee' AND size='M';
  IF stock<>19 THEN RAISE EXCEPTION 'Retry changed stock: %',stock; END IF;
  SELECT count(*) INTO qty FROM order_notification_outbox WHERE order_id=first_order.order_id;
  IF qty<>1 THEN RAISE EXCEPTION 'Notification not queued exactly once'; END IF;
  PERFORM claim_order_notifications(first_order.order_id);
  IF EXISTS(SELECT 1 FROM claim_order_notifications(first_order.order_id)) THEN RAISE EXCEPTION 'Active lease reclaimed'; END IF;
  PERFORM update_order_status(first_order.order_id,'cancelled',NULL,NULL,'Regression test');
  PERFORM update_order_status(first_order.order_id,'cancelled',NULL,NULL,'Repeat cancellation');
  SELECT stock_quantity INTO stock FROM product_inventory WHERE product_id='regression-tee' AND size='M';
  IF stock<>20 THEN RAISE EXCEPTION 'Restock not exactly once: %',stock; END IF;
  BEGIN
    PERFORM place_order(NULL,'cap@example.test','Test','Buyer','01012345678','15 Test Street','Cairo','Cairo',NULL,'standard','cod',NULL,
      '[{"product_id":"regression-tee","size":"M","quantity":6},{"product_id":"regression-tee","size":"M","quantity":6}]');
    RAISE EXCEPTION 'Duplicate line quantity cap not enforced';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Maximum quantity%' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;
