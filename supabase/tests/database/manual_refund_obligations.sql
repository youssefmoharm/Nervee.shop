BEGIN;
DO $$ DECLARE oid uuid; owed integer; BEGIN
 INSERT INTO orders(order_number,email,first_name,last_name,phone,address,city,governorate,subtotal,shipping_cost,total,delivery_method,status,payment_provider)
 VALUES('NRV-MANUAL-REFUND','manual@example.test','Test','Buyer','01012345678','15 Test Street','Cairo','Cairo',650,100,750,'standard','delivered','cod') RETURNING id INTO oid;
 PERFORM update_order_status(oid,'refunded');
 PERFORM update_order_status(oid,'refunded');
 SELECT sum(amount) INTO owed FROM cod_refund_obligations WHERE order_id=oid;
 IF owed<>750 OR (SELECT count(*) FROM cod_refund_obligations WHERE order_id=oid)<>1 THEN RAISE EXCEPTION 'Manual refund obligation missing or duplicated';END IF;
END $$;
ROLLBACK;
