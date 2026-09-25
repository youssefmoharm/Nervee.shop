-- 036: place_order hardening after security audit
--   1. Re-revoke EXECUTE from authenticated (migration 034 line 179 re-granted it,
--      undoing migration 017 — p_customer_id is an untrusted parameter, so only
--      the service_role edge path may call place_order).
--   2. Aggregate duplicate (product_id, size) lines before the qty cap so a
--      caller cannot bypass "max 10 per item" by sending the same line 3×.
--   3. Guest COD abuse guard: cap open unpaid COD orders by email (guests have
--      customer_id NULL, so the existing per-customer cap never applied).
--   4. Sort inventory locks by (product_id, size) to avoid deadlocks between
--      carts that list the same products in different orders.

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
  v_merged_items JSONB;
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

  -- Merge duplicate (product_id, size) lines so the per-item qty cap cannot be
  -- bypassed by splitting one product across multiple JSON elements.
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_id', product_id,
        'color', MAX(color),
        'size', size,
        'quantity', SUM(qty),
        'image', MAX(image)
      )
      ORDER BY product_id, size
    ),
    '[]'::jsonb
  )
  INTO v_merged_items
  FROM (
    SELECT
      (elem->>'product_id') AS product_id,
      (elem->>'size') AS size,
      COALESCE(elem->>'color', '') AS color,
      COALESCE(elem->>'image', '') AS image,
      (elem->>'quantity')::INTEGER AS qty
    FROM jsonb_array_elements(p_items) AS elem
  ) AS lines
  GROUP BY product_id, size;

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
  ELSIF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    -- Guests: same cap keyed by email so one inbox cannot stack COD orders.
    SELECT COUNT(*) INTO v_open_cod_orders
      FROM orders
      WHERE lower(email) = lower(trim(p_email))
        AND customer_id IS NULL
        AND payment_provider = 'cod'
        AND payment_status = 'pending'
        AND status IN ('placed', 'processing');

    IF v_open_cod_orders >= v_cod_open_order_cap THEN
      RAISE EXCEPTION 'There are already % unpaid Cash on Delivery orders for this email. Please wait for one to be delivered (or contact us) before placing another.', v_open_cod_orders
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ---- Validate & price every merged line against the DB, locking inventory rows
  -- (rows already ordered by product_id, size — consistent lock order)
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_merged_items)
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

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_merged_items)
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

-- Only the service_role edge path may execute place_order. authenticated must
-- never receive this: p_customer_id is a plain parameter (not auth.uid()), so
-- a signed-in user could otherwise place orders attributed to other customers
-- while bypassing edge rate limits, sanitization, and idempotency.
REVOKE ALL ON FUNCTION place_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION place_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

COMMENT ON FUNCTION place_order IS
  'Atomic COD order placement (service_role only). Server re-prices from products.price, locks inventory, merges duplicate lines before the max-10-per-item cap, free shipping at subtotal >= 2000 EGP, guest+customer COD open-order cap of 3, and a supplied discount code must validate or the order is rejected.';
