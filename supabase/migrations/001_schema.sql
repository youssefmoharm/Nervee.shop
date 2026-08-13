-- NERVE E-Commerce Database Schema (Migration 001)
-- Base schema extracted from supabase/schema.sql so that `supabase db push`
-- works on a fresh database (Preview / CI) as well as on the existing linked
-- project (all statements are idempotent: IF NOT EXISTS / OR REPLACE /
-- DROP ... IF EXISTS), which makes re-runs safe.

-- Enable UUID extension (optional - for compatibility)
-- Note: We use gen_random_uuid() instead which is always available in Supabase
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- ============================================================================
-- COLLECTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL,
  image TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PRODUCTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  price INTEGER NOT NULL,
  compare_at_price INTEGER,
  currency TEXT DEFAULT 'EGP',
  badge TEXT,
  is_best_seller BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT NOT NULL,
  material TEXT NOT NULL,
  care JSONB NOT NULL,
  fit_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_category CHECK (category IN (
    'T-Shirts', 'Hoodies', 'Pants', 'Denim', 'Tops', 'Jackets', 'Caps', 'Accessories'
  )),
  CONSTRAINT valid_badge CHECK (badge IN (
    'NEW', 'BEST SELLER', 'LIMITED', 'SALE', 'RESTOCKED', NULL
  ))
);

-- Full-text search index
CREATE INDEX IF NOT EXISTS products_search_idx ON products USING gin(
  to_tsvector('english', name || ' ' || description || ' ' || category)
);

-- ============================================================================
-- PRODUCT COLORS
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hex TEXT NOT NULL,
  image TEXT NOT NULL,
  hover_image TEXT,
  sort_order INTEGER DEFAULT 0,

  UNIQUE(product_id, name)
);

-- ============================================================================
-- PRODUCT SIZES & INVENTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  in_stock BOOLEAN DEFAULT TRUE,
  stock_quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(product_id, size),
  CONSTRAINT valid_size CHECK (size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL'))
);

-- ============================================================================
-- CUSTOMERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CUSTOMER ADDRESSES
-- ============================================================================
CREATE TABLE IF NOT EXISTS customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  governorate TEXT NOT NULL,
  postal_code TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ORDERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,

  address TEXT NOT NULL,
  city TEXT NOT NULL,
  governorate TEXT NOT NULL,
  postal_code TEXT,

  subtotal INTEGER NOT NULL,
  shipping_cost INTEGER NOT NULL,
  discount_amount INTEGER DEFAULT 0,
  total INTEGER NOT NULL,

  delivery_method TEXT NOT NULL,

  payment_status TEXT DEFAULT 'pending',
  payment_provider TEXT,

  status TEXT DEFAULT 'placed',
  fulfillment_status TEXT DEFAULT 'unfulfilled',

  placed_at TIMESTAMPTZ DEFAULT NOW(),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN (
    'placed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
  )),
  CONSTRAINT valid_fulfillment_status CHECK (fulfillment_status IN (
    'unfulfilled', 'partial', 'fulfilled'
  ))
);

-- Order number index
CREATE INDEX IF NOT EXISTS orders_order_number_idx ON orders(order_number);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);

-- ============================================================================
-- ORDER ITEMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,

  product_name TEXT NOT NULL,
  product_slug TEXT NOT NULL,
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  image TEXT NOT NULL,

  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DISCOUNT CODES
-- ============================================================================
CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,

  discount_type TEXT NOT NULL,
  discount_value INTEGER NOT NULL,

  minimum_purchase INTEGER,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,

  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_discount_type CHECK (discount_type IN ('percentage', 'fixed'))
);

-- ============================================================================
-- CARTS (for logged-in users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(cart_id, product_id, color, size)
);

-- ============================================================================
-- WISHLISTS (for logged-in users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id UUID REFERENCES wishlists(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(wishlist_id, product_id)
);

-- ============================================================================
-- GUEST ORDERS (for guest checkout tracking)
-- NOTE: re-created by migration 005 (IF NOT EXISTS keeps this harmless)
-- ============================================================================
CREATE TABLE IF NOT EXISTS guest_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  order_number TEXT UNIQUE NOT NULL,
  verification_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guest_orders_email_idx ON guest_orders(email);
CREATE INDEX IF NOT EXISTS guest_orders_token_idx ON guest_orders(verification_token);

-- ============================================================================
-- PRODUCT REVIEWS
-- NOTE: re-created by migration 005 (IF NOT EXISTS keeps this harmless)
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT NOT NULL,
  comment TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(product_id, customer_id)
);

CREATE OR REPLACE VIEW product_review_stats AS
SELECT
  p.id AS product_id,
  COUNT(r.id) AS review_count,
  COALESCE(AVG(r.rating), 0) AS average_rating
FROM products p
LEFT JOIN product_reviews r ON p.id = r.product_id
GROUP BY p.id;

CREATE INDEX IF NOT EXISTS product_reviews_product_id_idx ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS product_reviews_customer_id_idx ON product_reviews(customer_id);

-- ============================================================================
-- ADMIN USERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_role CHECK (role IN ('admin', 'super_admin'))
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view collections" ON collections;
CREATE POLICY "Public can view collections" ON collections FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can view products" ON products;
CREATE POLICY "Public can view products" ON products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can view product colors" ON product_colors;
CREATE POLICY "Public can view product colors" ON product_colors FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can view product inventory" ON product_inventory;
CREATE POLICY "Public can view product inventory" ON product_inventory FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view own profile" ON customers;
CREATE POLICY "Users can view own profile" ON customers FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON customers;
CREATE POLICY "Users can update own profile" ON customers FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view own addresses" ON customer_addresses;
CREATE POLICY "Users can view own addresses" ON customer_addresses FOR SELECT USING (
  customer_id = auth.uid()
);
DROP POLICY IF EXISTS "Users can insert own addresses" ON customer_addresses;
CREATE POLICY "Users can insert own addresses" ON customer_addresses FOR INSERT WITH CHECK (
  customer_id = auth.uid()
);
DROP POLICY IF EXISTS "Users can update own addresses" ON customer_addresses;
CREATE POLICY "Users can update own addresses" ON customer_addresses FOR UPDATE USING (
  customer_id = auth.uid()
);
DROP POLICY IF EXISTS "Users can delete own addresses" ON customer_addresses;
CREATE POLICY "Users can delete own addresses" ON customer_addresses FOR DELETE USING (
  customer_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can view own orders" ON orders;
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (
  customer_id = auth.uid()
);
DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
CREATE POLICY "Users can view own order items" ON order_items FOR SELECT USING (
  order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can view own cart" ON carts;
CREATE POLICY "Users can view own cart" ON carts FOR SELECT USING (customer_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert own cart" ON carts;
CREATE POLICY "Users can insert own cart" ON carts FOR INSERT WITH CHECK (customer_id = auth.uid());
DROP POLICY IF EXISTS "Users can update own cart" ON carts;
CREATE POLICY "Users can update own cart" ON carts FOR UPDATE USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own cart items" ON cart_items;
CREATE POLICY "Users can view own cart items" ON cart_items FOR SELECT USING (
  cart_id IN (SELECT id FROM carts WHERE customer_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can insert own cart items" ON cart_items;
CREATE POLICY "Users can insert own cart items" ON cart_items FOR INSERT WITH CHECK (
  cart_id IN (SELECT id FROM carts WHERE customer_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can update own cart items" ON cart_items;
CREATE POLICY "Users can update own cart items" ON cart_items FOR UPDATE USING (
  cart_id IN (SELECT id FROM carts WHERE customer_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can delete own cart items" ON cart_items;
CREATE POLICY "Users can delete own cart items" ON cart_items FOR DELETE USING (
  cart_id IN (SELECT id FROM carts WHERE customer_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can view own wishlist" ON wishlists;
CREATE POLICY "Users can view own wishlist" ON wishlists FOR SELECT USING (customer_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert own wishlist" ON wishlists;
CREATE POLICY "Users can insert own wishlist" ON wishlists FOR INSERT WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own wishlist items" ON wishlist_items;
CREATE POLICY "Users can view own wishlist items" ON wishlist_items FOR SELECT USING (
  wishlist_id IN (SELECT id FROM wishlists WHERE customer_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can insert own wishlist items" ON wishlist_items;
CREATE POLICY "Users can insert own wishlist items" ON wishlist_items FOR INSERT WITH CHECK (
  wishlist_id IN (SELECT id FROM wishlists WHERE customer_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can delete own wishlist items" ON wishlist_items;
CREATE POLICY "Users can delete own wishlist items" ON wishlist_items FOR DELETE USING (
  wishlist_id IN (SELECT id FROM wishlists WHERE customer_id = auth.uid())
);

DROP POLICY IF EXISTS "Public can view guest order by email/token" ON guest_orders;
CREATE POLICY "Public can view guest order by email/token" ON guest_orders FOR SELECT USING (
  verification_token = (SELECT auth.jwt() ->> 'verify_token'::TEXT) OR
  (email = (SELECT auth.jwt() ->> 'email'::TEXT) AND verification_token IS NULL)
);

DROP POLICY IF EXISTS "Authenticated users can CRUD own reviews" ON product_reviews;
CREATE POLICY "Authenticated users can CRUD own reviews" ON product_reviews FOR ALL USING (
  auth.uid() = customer_id
);
DROP POLICY IF EXISTS "Public can view all reviews" ON product_reviews;
CREATE POLICY "Public can view all reviews" ON product_reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view active discount codes" ON discount_codes;
CREATE POLICY "Public can view active discount codes" ON discount_codes FOR SELECT USING (
  is_active = true AND
  (valid_until IS NULL OR valid_until > NOW())
);

DROP POLICY IF EXISTS "Admins can do everything" ON collections;
CREATE POLICY "Admins can do everything" ON collections FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);
DROP POLICY IF EXISTS "Admins can do everything on products" ON products;
CREATE POLICY "Admins can do everything on products" ON products FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);
DROP POLICY IF EXISTS "Admins can do everything on product_colors" ON product_colors;
CREATE POLICY "Admins can do everything on product_colors" ON product_colors FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);
DROP POLICY IF EXISTS "Admins can do everything on product_inventory" ON product_inventory;
CREATE POLICY "Admins can do everything on product_inventory" ON product_inventory FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
CREATE POLICY "Admins can view all orders" ON orders FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);
DROP POLICY IF EXISTS "Admins can manage discount codes" ON discount_codes;
CREATE POLICY "Admins can manage discount codes" ON discount_codes FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_collections_updated_at ON collections;
CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_product_inventory_updated_at ON product_inventory;
CREATE TRIGGER update_product_inventory_updated_at BEFORE UPDATE ON product_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_customer_addresses_updated_at ON customer_addresses;
CREATE TRIGGER update_customer_addresses_updated_at BEFORE UPDATE ON customer_addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_discount_codes_updated_at ON discount_codes;
CREATE TRIGGER update_discount_codes_updated_at BEFORE UPDATE ON discount_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_carts_updated_at ON carts;
CREATE TRIGGER update_carts_updated_at BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_cart_items_updated_at ON cart_items;
CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS product_colors_product_id_idx ON product_colors(product_id);
CREATE INDEX IF NOT EXISTS product_inventory_product_id_idx ON product_inventory(product_id);
CREATE INDEX IF NOT EXISTS customer_addresses_customer_id_idx ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON order_items(product_id);
CREATE INDEX IF NOT EXISTS cart_items_cart_id_idx ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS wishlist_items_wishlist_id_idx ON wishlist_items(wishlist_id);
CREATE INDEX IF NOT EXISTS discount_codes_code_idx ON discount_codes(code);
CREATE INDEX IF NOT EXISTS discount_codes_active_idx ON discount_codes(is_active);
