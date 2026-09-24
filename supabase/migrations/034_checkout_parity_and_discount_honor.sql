-- 034: Checkout client/server parity + discount integrity
-- Fixes relative to place_order defined in 003:
--   1. Free-shipping threshold: client uses >= 2000 EGP, server used > 2000 (off-by-one).
--   2. Per-item quantity cap: edge validation max is 10; place_order must enforce the same.
--   3. A supplied discount code that fails validation must abort the order, not be silently dropped.
-- Signature is intentionally identical to 003 so place_order_with_idempotency (018) keeps working.

CREATE OR REPLACE FUNCTION place_order(
  p_customer_id UUID,
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_phone TEXT,
  p_address TEXT,
  p_city TEXT,
  p_governorate TEXT,
  p_postal_code TEXT,
  p_delivery_method TEXT,
  p_payment_provider TEXT,
  p_discount_code TEXT,
  p_items JSONB
)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_product products%ROWTYPE;
  v_inventory product_inventory%ROWTYPE;
  v_line_price INTEGER;
  v_subtotal INTEGER := 0;
  v_shipping INTEGER;
  v_discount_amount INTEGER := 0;
  v_discount discount_codes%ROWTYPE;
  v_total INTEGER;
  v_order orders;
  v_order_number TEXT;
  v_open_cod_orders INTEGER;
  v_cod_open_order_cap CONSTANT INTEGER := 3;
  v_qty INTEGER;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty' USING ERRCODE = 'P0001';
  END IF;

  IF p_delivery_method NOT IN ('standard', 'express') THEN
    RAISE EXCEPTION 'Invalid delivery method' USING ERRCODE = 'P0001';
  END IF;

  IF p_payment_provider <> 'cod' THEN
    RAISE EXCEPTION 'Invalid payment method' USING ERRCODE = 'P0001';
  END IF;

  -- ---- Cash on Delivery abuse guard ----
  IF p_customer_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_open_cod_orders
      FROM orders
      WHERE customer_id = p_customer_id
        AND payment_provider = 'cod'
        AND payment_status = 'pending'
        AND status IN ('placed', 'processing');

    IF v_open_cod_orders >= v_cod_open_order_cap THEN
      RAISE EXCEPTION 'You have % unpaid Cash on Delivery orders already. Please wait for one to be delivered (or contact us) before placing another.', v_open_cod_orders
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ---- Validate & price every line against the DB, locking inventory rows
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::INTEGER;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 10 THEN
      RAISE EXCEPTION 'Maximum quantity per item is 10' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_product FROM products
      WHERE id = (v_item->>'product_id') AND is_active IS DISTINCT FROM FALSE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % is no longer available', (v_item->>'product_id') USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_inventory FROM product_inventory
      WHERE product_id = (v_item->>'product_id') AND size = (v_item->>'size')
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION '% is not available in size %', v_product.name, (v_item->>'size') USING ERRCODE = 'P0001';
    END IF;

    IF NOT v_inventory.in_stock OR v_inventory.stock_quantity < v_qty THEN
      RAISE EXCEPTION '% (size %) only has % in stock', v_product.name, (v_item->>'size'), v_inventory.stock_quantity
        USING ERRCODE = 'P0001';
    END IF;

    v_line_price := v_product.price * v_qty;
    v_subtotal := v_subtotal + v_line_price;

    UPDATE product_inventory
      SET stock_quantity = stock_quantity - v_qty,
          in_stock = (stock_quantity - v_qty) > 0
      WHERE id = v_inventory.id;
  END LOOP;

  -- ---- Shipping (parity with src/lib/checkout.ts: free at >= 2000)
  v_shipping := CASE
    WHEN p_delivery_method = 'express' THEN 200
    WHEN v_subtotal >= 2000 THEN 0
    ELSE 100
  END;

  -- ---- Discount code: fail loudly when a code was supplied but cannot apply
  IF p_discount_code IS NOT NULL AND length(trim(p_discount_code)) > 0 THEN
    SELECT * INTO v_discount FROM discount_codes
      WHERE code = upper(trim(p_discount_code))
        AND is_active = true
        AND valid_from <= NOW()
        AND (valid_until IS NULL OR valid_until > NOW())
        AND (usage_limit IS NULL OR usage_count < usage_limit)
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid or expired discount code' USING ERRCODE = 'P0001';
    END IF;

    IF v_discount.minimum_purchase IS NOT NULL AND v_subtotal < v_discount.minimum_purchase THEN
      RAISE EXCEPTION 'Discount code requires a minimum purchase of % EGP', v_discount.minimum_purchase
        USING ERRCODE = 'P0001';
    END IF;

    v_discount_amount := CASE
      WHEN v_discount.discount_type = 'percentage' THEN (v_subtotal * v_discount.discount_value) / 100
      ELSE LEAST(v_discount.discount_value, v_subtotal)
    END;
    UPDATE discount_codes SET usage_count = usage_count + 1 WHERE id = v_discount.id;
  END IF;

  v_total := GREATEST(v_subtotal + v_shipping - v_discount_amount, 0);

  -- ---- Create the order
  v_order_number := 'NRV-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

  INSERT INTO orders (
    order_number, customer_id, email, first_name, last_name, phone,
    address, city, governorate, postal_code,
    subtotal, shipping_cost, discount_amount, total,
    delivery_method, status, payment_status, payment_provider
  ) VALUES (
    v_order_number, p_customer_id, p_email, p_first_name, p_last_name, p_phone,
    p_address, p_city, p_governorate, p_postal_code,
    v_subtotal, v_shipping, v_discount_amount, v_total,
    p_delivery_method,
    'placed',
    'pending',
    'cod'
  )
  RETURNING * INTO v_order;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product FROM products WHERE id = (v_item->>'product_id');
    INSERT INTO order_items (
      order_id, product_id, product_name, product_slug, color, size, image,
      price, quantity, subtotal
    ) VALUES (
      v_order.id, v_product.id, v_product.name, v_product.slug,
      v_item->>'color', v_item->>'size', COALESCE(v_item->>'image', ''),
      v_product.price, (v_item->>'quantity')::INTEGER,
      v_product.price * (v_item->>'quantity')::INTEGER
    );
  END LOOP;

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION place_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION place_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;

COMMENT ON FUNCTION place_order IS
  'Atomic COD order placement. Free shipping at subtotal >= 2000 EGP; max 10 units per line item; a supplied discount code must validate or the order is rejected.';

-- ---- Lock down open RLS inserts: edge functions (service role) are the only writers ----
-- Schema allows anon INSERT (WITH CHECK true) — revoke now that contact/newsletter
-- go through the rate-limited `contact` edge function.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contact_messages'
      AND policyname = 'Anyone can send a message'
  ) THEN
    DROP POLICY "Anyone can send a message" ON contact_messages;
  END IF;

  CREATE POLICY "Service role inserts contact messages" ON contact_messages
    FOR INSERT TO service_role WITH CHECK (true);

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'newsletter_subscribers'
      AND policyname = 'Anyone can subscribe'
  ) THEN
    DROP POLICY "Anyone can subscribe" ON newsletter_subscribers;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'newsletter_subscribers'
      AND policyname = 'Public can insert newsletter subscription'
  ) THEN
    DROP POLICY "Public can insert newsletter subscription" ON newsletter_subscribers;
  END IF;

  CREATE POLICY "Service role inserts newsletter subscriptions" ON newsletter_subscribers
    FOR INSERT TO service_role WITH CHECK (true);
END $$;
