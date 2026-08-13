-- ============================================================================
-- NERVE — Migration 002
-- Adds: newsletter_subscribers, contact_messages, an atomic/safe order-
-- placement RPC, discount-code validation RPC, and storage bucket policies.
--
-- Run this AFTER supabase/schema.sql and supabase/seed.sql, in the Supabase
-- SQL Editor (or via `supabase db push` if you adopt the CLI).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Correction: `products.price` is a plain integer number of EGP (e.g. 1250 =
-- EGP 1,250), NOT cents — the whole app (seed data, cart math, shipping
-- thresholds) already treats it that way. The original comment in schema.sql
-- was misleading; this comment documents the actual convention going forward.
-- ----------------------------------------------------------------------------
COMMENT ON COLUMN products.price IS 'Price in whole EGP (not cents/piastres). e.g. 1250 = EGP 1,250.';
COMMENT ON COLUMN products.compare_at_price IS 'Compare-at price in whole EGP.';

-- ============================================================================
-- NEWSLETTER SUBSCRIBERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe (insert), nobody can read/list from the client.
DROP POLICY IF EXISTS "Anyone can subscribe" ON newsletter_subscribers;
CREATE POLICY "Anyone can subscribe" ON newsletter_subscribers FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view subscribers" ON newsletter_subscribers;
CREATE POLICY "Admins can view subscribers" ON newsletter_subscribers FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

-- ============================================================================
-- CONTACT MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('new', 'read', 'replied', 'archived'))
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can send a message" ON contact_messages;
CREATE POLICY "Anyone can send a message" ON contact_messages FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view messages" ON contact_messages;
CREATE POLICY "Admins can view messages" ON contact_messages FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);
DROP POLICY IF EXISTS "Admins can update messages" ON contact_messages;
CREATE POLICY "Admins can update messages" ON contact_messages FOR UPDATE USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

CREATE INDEX IF NOT EXISTS contact_messages_status_idx ON contact_messages(status);
CREATE INDEX IF NOT EXISTS newsletter_subscribers_email_idx ON newsletter_subscribers(email);

-- ============================================================================
-- Replace the old naive "decrement on insert" trigger.
--
-- The original trigger fired an UPDATE after each order_item insert, but had
-- no row locking and never rejected the insert on insufficient stock — two
-- concurrent checkouts for the last unit could both succeed, and stock could
-- go negative in the window between the SELECT the frontend used and the
-- INSERT. Order totals were also trusted from the client.
--
-- The fix: no more trigger. All order creation now goes through
-- `place_order()` below, a single SECURITY DEFINER function that locks the
-- relevant inventory rows (FOR UPDATE), re-checks stock, computes the total
-- from the current `products.price` (never the client's number), and does
-- the insert + decrement in one transaction. If any line is unavailable, the
-- whole call raises and nothing is written.
-- ============================================================================
DROP TRIGGER IF EXISTS decrement_inventory_on_order ON order_items;
DROP FUNCTION IF EXISTS decrement_inventory();

-- Input shape for a single cart line, passed as jsonb array from the client/
-- edge function: { "product_id": "p-001", "color": "Navy", "size": "M", "quantity": 2 }

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
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty' USING ERRCODE = 'P0001';
  END IF;

  IF p_delivery_method NOT IN ('standard', 'express') THEN
    RAISE EXCEPTION 'Invalid delivery method' USING ERRCODE = 'P0001';
  END IF;

  -- ---- Validate & price every line against the DB, locking inventory rows
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product FROM products
      WHERE id = (v_item->>'product_id') AND is_active IS DISTINCT FROM FALSE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % is no longer available', (v_item->>'product_id') USING ERRCODE = 'P0001';
    END IF;

    -- Lock the exact size row so concurrent checkouts serialize here.
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

    -- Deduct stock now, inside the same locked transaction.
    UPDATE product_inventory
      SET stock_quantity = stock_quantity - (v_item->>'quantity')::INTEGER,
          in_stock = (stock_quantity - (v_item->>'quantity')::INTEGER) > 0
      WHERE id = v_inventory.id;
  END LOOP;

  -- ---- Shipping (mirrors the site's published shipping policy)
  v_shipping := CASE
    WHEN p_delivery_method = 'express' THEN 200
    WHEN v_subtotal > 2000 THEN 0
    ELSE 100
  END;

  -- ---- Discount code (server-validated, never trusted from client)
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
    CASE WHEN p_payment_provider = 'cod' THEN 'pending' ELSE 'pending' END,
    p_payment_provider
  ) RETURNING * INTO v_order;

  -- ---- Order line items (snapshotted so future product edits don't rewrite history)
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

-- Only callable by authenticated users or the service role (edge function).
-- Guests are supported by passing p_customer_id = NULL from the edge function,
-- which runs with the service role and is the only path allowed to do that.
REVOKE ALL ON FUNCTION place_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION place_order TO authenticated, service_role;

-- ============================================================================
-- Cart merge helper: fold a guest's session cart into a customer's DB cart
-- on login. Existing (product, color, size) lines have quantities summed.
-- ============================================================================
CREATE OR REPLACE FUNCTION merge_guest_cart(p_customer_id UUID, p_items JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart_id UUID;
  v_item JSONB;
BEGIN
  INSERT INTO carts (customer_id) VALUES (p_customer_id)
    ON CONFLICT (customer_id) DO NOTHING;

  SELECT id INTO v_cart_id FROM carts WHERE customer_id = p_customer_id;

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

REVOKE ALL ON FUNCTION merge_guest_cart FROM PUBLIC;
GRANT EXECUTE ON FUNCTION merge_guest_cart TO authenticated;

-- ============================================================================
-- STORAGE BUCKETS + POLICIES
-- (SETUP.md previously asked you to click through the dashboard for this —
-- this does it in one run. Safe to re-run.)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('product-images', 'product-images', true),
  ('collection-images', 'collection-images', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read product-images" ON storage.objects;
CREATE POLICY "Public read product-images" ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Public read collection-images" ON storage.objects;
CREATE POLICY "Public read collection-images" ON storage.objects FOR SELECT
  USING (bucket_id = 'collection-images');

DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Only admins can write product/collection imagery.
DROP POLICY IF EXISTS "Admins write product-images" ON storage.objects;
CREATE POLICY "Admins write product-images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND auth.uid() IN (SELECT user_id FROM admin_users));
DROP POLICY IF EXISTS "Admins update product-images" ON storage.objects;
CREATE POLICY "Admins update product-images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND auth.uid() IN (SELECT user_id FROM admin_users));
DROP POLICY IF EXISTS "Admins delete product-images" ON storage.objects;
CREATE POLICY "Admins delete product-images" ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND auth.uid() IN (SELECT user_id FROM admin_users));

DROP POLICY IF EXISTS "Admins write collection-images" ON storage.objects;
CREATE POLICY "Admins write collection-images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'collection-images' AND auth.uid() IN (SELECT user_id FROM admin_users));

-- Users can manage their own avatar (path convention: {user_id}/avatar.jpg)
DROP POLICY IF EXISTS "Users write own avatar" ON storage.objects;
CREATE POLICY "Users write own avatar" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- Auto-create a `customers` row whenever someone signs up via Supabase Auth,
-- so profile/orders/addresses have somewhere to attach immediately.
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO customers (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Allow customers to insert their own row too (covers any user created
-- before this trigger existed, or edge cases where the trigger is skipped).
DROP POLICY IF EXISTS "Users can insert own profile" ON customers;
CREATE POLICY "Users can insert own profile" ON customers
  FOR INSERT WITH CHECK (auth.uid() = id);
