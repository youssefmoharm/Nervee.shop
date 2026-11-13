BEGIN;
DO $$
DECLARE customer uuid := gen_random_uuid(); oid uuid; rid uuid; remaining integer;
BEGIN
 INSERT INTO auth.users(id,email) VALUES(customer,customer::text||'@example.test');
 INSERT INTO admin_users(user_id) VALUES(customer);
 INSERT INTO products(id,slug,name,category,price,description,material,care)
 VALUES('return-fixture','return-fixture','Return fixture','T-Shirts',650,'Fixture','Cotton','[]');
 INSERT INTO product_inventory(product_id,size,in_stock,stock_quantity) VALUES('return-fixture','M',true,10);
 SELECT id INTO oid FROM place_order(NULL,'return@example.test','Test','Buyer','01012345678','15 Test Street','Cairo','Cairo',NULL,'standard','cod',NULL,'[{"product_id":"return-fixture","size":"M","quantity":1}]');
 PERFORM update_order_status(oid,'processing');
 PERFORM update_order_status(oid,'shipped');
 PERFORM update_order_status(oid,'delivered');
 INSERT INTO order_return_requests(order_id,type,reason,status) VALUES(oid,'return','Test reason','pending') RETURNING id INTO rid;
 BEGIN
   PERFORM resolve_return_request(rid,'approved','pending');
   RAISE EXCEPTION 'Non-admin approved return';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',customer::text,true);
 PERFORM resolve_return_request(rid,'approved','pending');
 PERFORM resolve_return_request(rid,'completed','approved');
 IF NOT EXISTS(SELECT 1 FROM orders WHERE id=oid AND status='refunded') THEN RAISE EXCEPTION 'Order not refunded'; END IF;
 SELECT stock_quantity INTO remaining FROM product_inventory WHERE product_id='return-fixture' AND size='M';
 IF remaining<>10 THEN RAISE EXCEPTION 'Return did not restock exactly once'; END IF;
 BEGIN
   PERFORM resolve_return_request(rid,'completed','approved');
   RAISE EXCEPTION 'Stale request accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE 'Return changed%' THEN RAISE; END IF;
 END;
END $$;
ROLLBACK;
