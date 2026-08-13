-- ============================================================================
-- NERVE — Migration 003
-- Fixes a critical pre-existing RLS gap (admin checks were unreachable) and
-- a customer-id-spoofing gap in merge_guest_cart, adds COD abuse limits,
-- back-in-stock signups, and an atomic admin order-status function (restock
-- on cancel/refund + status timestamps).
--
-- Run this AFTER 002_orders_rpc_and_extras.sql, in the Supabase SQL Editor.
-- ============================================================================

-- ============================================================================
-- CRITICAL FIX: admin_users had RLS enabled with ZERO policies.
--
-- Every "admin can do X" policy in schema.sql (and the ones added in
-- migration 002) checks `auth.uid() IN (SELECT user_id FROM admin_users)`.
-- That inner SELECT is itself subject to admin_users' own RLS. With no
-- policy at all, RLS defaults to deny-all — so that subquery silently
-- returned zero rows for every request from a normal authenticated user,
-- meaning EVERY admin-gated policy in the app was unreachable even for a
-- real admin. This was true in the original schema, before any of the
-- changes in this project — it isn't something introduced later.
--
-- The fix: let a user check their own membership row (and nothing else —
-- this does NOT expose the full admin list to anyone).
-- ============================================================================
DROP POLICY IF EXISTS "Users can check own admin status" ON admin_users;
CREATE POLICY "Users can check own admin status" ON admin_users FOR SELECT USING (
  user_id = auth.uid()
);

-- ----------------------------------------------------------------------------
-- Same cents/EGP mislabeling as products.price — discount_value is compared
-- directly against plain-EGP subtotals throughout the app.
-- ----------------------------------------------------------------------------
COMMENT ON COLUMN discount_codes.discount_value IS 'Percentage (e.g. 15) or fixed amount in whole EGP — not cents.';
COMMENT ON COLUMN discount_codes.minimum_purchase IS 'Minimum order subtotal in whole EGP.';

-- ============================================================================
-- Tracking URL for shipments
-- ============================================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;

-- ============================================================================
-- Back-in-stock signups
-- ============================================================================
CREATE TABLE IF NOT EXISTS back_in_stock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  notified BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(email, product_id, size)
);
ALTER TABLE back_in_stock_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can request a back-in-stock alert" ON back_in_stock_requests;
CREATE POLICY "Anyone can request a back-in-stock alert" ON back_in_stock_requests FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view back-in-stock requests" ON back_in_stock_requests;
CREATE POLICY "Admins can view back-in-stock requests" ON back_in_stock_requests FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

CREATE INDEX IF NOT EXISTS back_in_stock_lookup_idx
  ON back_in_stock_requests(product_id, size) WHERE notified = FALSE;

-- ============================================================================
-- Discount codes: admin write access already exists via the "Admins can
-- manage discount codes" policy in schema.sql — nothing to add there.
-- ============================================================================

-- ============================================================================
-- place_order(): replaces the version from migration 002. Adds:
--   - a cap on how many open COD orders one customer can have at once
-- Everything else is unchanged from migration 002.
-- ============================================================================
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

    IF NOT v_inventory.in_stock OR v_inventory.stock_quantity < (v_item->>'quantity')::INTEGER THEN
      RAISE EXCEPTION '% (size %) only has % in stock', v_product.name, (v_item->>'size'), v_inventory.stock_quantity
        USING ERRCODE = 'P0001';
    END IF;

    v_line_price := v_product.price * (v_item->>'quantity')::INTEGER;
    v_subtotal := v_subtotal + v_line_price;

    UPDATE product_inventory
      SET stock_quantity = stock_quantity - (v_item->>'quantity')::INTEGER,
          in_stock = (stock_quantity - (v_item->>'quantity')::INTEGER) > 0
      WHERE id = v_inventory.id;
  END LOOP;

  -- ---- Shipping
  v_shipping := CASE
    WHEN p_delivery_method = 'express' THEN 200
    WHEN v_subtotal > 2000 THEN 0
    ELSE 100
  END;

  -- ---- Discount code
  IF p_discount_code IS NOT NULL AND length(trim(p_discount_code)) > 0 THEN
    SELECT * INTO v_discount FROM discount_codes
      WHERE code = upper(trim(p_discount_code))
        AND is_active = true
        AND valid_from <= NOW()
        AND (valid_until IS NULL OR valid_until > NOW())
        AND (usage_limit IS NULL OR usage_count < usage_limit)
      FOR UPDATE;

    IF FOUND AND (v_discount.minimum_purchase IS NULL OR v_subtotal >= v_discount.minimum_purchase) THEN
      v_discount_amount := CASE
        WHEN v_discount.discount_type = 'percentage' THEN (v_subtotal * v_discount.discount_value) / 100
        ELSE LEAST(v_discount.discount_value, v_subtotal)
      END;
      UPDATE discount_codes SET usage_count = usage_count + 1 WHERE id = v_discount.id;
    END IF;
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
    p_payment_provider
  ) RETURNING * INTO v_order;

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

-- Only the service role (i.e. only via the create-order edge function) may
-- call place_order. p_customer_id is just a parameter here, not derived from
-- the caller's own auth.uid() — granting `authenticated` execute rights
-- would let any signed-in user call this directly with someone else's
-- customer_id and place orders in their name. Routing everything through
-- the edge function (which resolves customer_id from the caller's verified
-- JWT itself) closes that.
REVOKE ALL ON FUNCTION place_order FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION place_order TO service_role;

-- ============================================================================
-- Same class of bug existed in merge_guest_cart (from migration 002): it
-- trusted whatever p_customer_id was passed in, so any signed-in user could
-- have merged items into another customer's cart by calling it with someone
-- else's id. Redefined here to always use the caller's own auth.uid().
-- ============================================================================
DROP FUNCTION IF EXISTS merge_guest_cart(UUID, JSONB);

CREATE OR REPLACE FUNCTION merge_guest_cart(p_items JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID := auth.uid();
  v_cart_id UUID;
  v_item JSONB;
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO carts (customer_id) VALUES (v_customer_id)
    ON CONFLICT (customer_id) DO NOTHING;

  SELECT id INTO v_cart_id FROM carts WHERE customer_id = v_customer_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    INSERT INTO cart_items (cart_id, product_id, color, size, quantity)
    VALUES (
      v_cart_id, v_item->>'productId', v_item->>'color', v_item->>'size',
      (v_item->>'quantity')::INTEGER
    )
    ON CONFLICT (cart_id, product_id, color, size)
    DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION merge_guest_cart(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION merge_guest_cart(JSONB) TO authenticated;

-- ============================================================================
-- update_order_status(): the ONLY way order status changes after creation.
-- Callable only by the service role — the admin-update-order-status edge
-- function verifies the caller is a real admin (via their JWT) BEFORE
-- calling this, so authorization lives in exactly one place. Restocks
-- inventory automatically when an order is cancelled/refunded, since
-- place_order already reserved that stock.
-- ============================================================================
CREATE OR REPLACE FUNCTION update_order_status(
  p_order_id UUID,
  p_status TEXT,
  p_tracking_number TEXT DEFAULT NULL,
  p_tracking_url TEXT DEFAULT NULL
)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders;
  v_item order_items%ROWTYPE;
BEGIN
  IF p_status NOT IN ('placed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0001';
  END IF;

  -- Restock once, only on the transition INTO cancelled/refunded (never twice).
  IF p_status IN ('cancelled', 'refunded') AND v_order.status NOT IN ('cancelled', 'refunded') THEN
    FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id
    LOOP
      UPDATE product_inventory
        SET stock_quantity = stock_quantity + v_item.quantity,
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

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION update_order_status FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION update_order_status TO service_role;

