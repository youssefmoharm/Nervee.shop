BEGIN;
DO $$
DECLARE admin uuid:=gen_random_uuid(); oid uuid; item uuid; req uuid; obligation uuid; payment uuid; retry uuid; amount integer; stock integer;
BEGIN
 INSERT INTO auth.users(id,email) VALUES(admin,admin::text||'@example.test');
 INSERT INTO admin_users(user_id) VALUES(admin);
 INSERT INTO products(id,slug,name,category,price,description,material,care) VALUES('partial-tee','partial-tee','Partial tee','T-Shirts',650,'Fixture','Cotton','[]');
 INSERT INTO product_inventory(product_id,size,in_stock,stock_quantity) VALUES('partial-tee','M',true,10),('partial-tee','L',true,5);
 SELECT id INTO oid FROM place_order(NULL,'partial@example.test','Test','Buyer','01012345678','15 Test Street','Cairo','Cairo',NULL,'standard','cod',NULL,'[{"product_id":"partial-tee","size":"M","quantity":3}]');
 PERFORM update_order_status(oid,'processing');PERFORM update_order_status(oid,'shipped');PERFORM update_order_status(oid,'delivered');
 SELECT id INTO item FROM order_items WHERE order_id=oid;
 req:=create_item_return_request(oid,NULL,'return','Wrong size test',jsonb_build_array(jsonb_build_object('orderItemId',item,'quantity',1)));
 BEGIN PERFORM update_order_status(oid,'refunded');RAISE EXCEPTION 'Active return bypassed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Complete or reject%' THEN RAISE;END IF;END;
 PERFORM set_config('request.jwt.claim.sub',admin::text,true);
 PERFORM resolve_return_request(req,'approved','pending');PERFORM resolve_return_request(req,'completed','approved');
 IF NOT EXISTS(SELECT 1 FROM orders WHERE id=oid AND status='delivered') THEN RAISE EXCEPTION 'Partial return refunded whole order';END IF;
 SELECT ob.id,ob.amount INTO obligation,amount FROM cod_refund_obligations ob WHERE ob.request_id=req;
 IF amount<>650 THEN RAISE EXCEPTION 'Incorrect partial refund %',amount;END IF;
 payment:=record_cod_refund(obligation,650,'receipt-partial-test');retry:=record_cod_refund(obligation,650,'receipt-partial-test');
 IF payment<>retry THEN RAISE EXCEPTION 'Receipt retry duplicated payment';END IF;
 BEGIN PERFORM record_cod_refund(obligation,1,'extra-receipt-test');RAISE EXCEPTION 'Overpayment accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Repayment exceeds%' THEN RAISE; END IF;END;
 req:=create_item_return_request(oid,NULL,'exchange','Size exchange test',jsonb_build_array(jsonb_build_object('orderItemId',item,'quantity',1,'replacementSize','L')));
 PERFORM resolve_return_request(req,'approved','pending');PERFORM resolve_return_request(req,'completed','approved');
 SELECT stock_quantity INTO stock FROM product_inventory WHERE product_id='partial-tee' AND size='M';
 IF stock<>9 THEN RAISE EXCEPTION 'Returned stock incorrect %',stock; END IF;
 SELECT stock_quantity INTO stock FROM product_inventory WHERE product_id='partial-tee' AND size='L';
 IF stock<>4 THEN RAISE EXCEPTION 'Replacement stock not reserved';END IF;
 PERFORM record_exchange_shipment(req,'EX-123','https://courier.example.test/EX-123');
 BEGIN PERFORM create_item_return_request(oid,NULL,'return','Too many items test',jsonb_build_array(jsonb_build_object('orderItemId',item,'quantity',2)));RAISE EXCEPTION 'Over-return accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Invalid item%' THEN RAISE;END IF;END;
 -- Non-admin cannot alter money or shipment records.
 PERFORM set_config('request.jwt.claim.sub','',true);
 BEGIN PERFORM record_cod_refund(obligation,1,'intruder-test');RAISE EXCEPTION 'Non-admin recorded money';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
ROLLBACK;
