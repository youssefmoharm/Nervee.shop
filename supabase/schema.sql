-- NERVE E-Commerce Database Schema
-- Run this in your Supabase SQL Editor to set up the complete database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- COLLECTIONS
-- ============================================================================
CREATE TABLE collections (
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
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  price INTEGER NOT NULL, -- in EGP cents (e.g., 1250 = EGP 12.50)
  compare_at_price INTEGER, -- for sale pricing
  currency TEXT DEFAULT 'EGP',
  badge TEXT, -- 'NEW', 'BEST SELLER', 'LIMITED', 'SALE', 'RESTOCKED'
  is_best_seller BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT NOT NULL,
  material TEXT NOT NULL,
  care JSONB NOT NULL, -- array of care instructions
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
CREATE INDEX products_search_idx ON products USING gin(
  to_tsvector('english', name || ' ' || description || ' ' || category)
);

-- ============================================================================
-- PRODUCT COLORS
-- ============================================================================
CREATE TABLE product_colors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hex TEXT NOT NULL,
  image TEXT NOT NULL, -- primary image URL
  hover_image TEXT, -- hover state image URL
  sort_order INTEGER DEFAULT 0,
  
  UNIQUE(product_id, name)
);

-- ============================================================================
-- PRODUCT SIZES & INVENTORY
-- ============================================================================
CREATE TABLE product_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE TABLE customers (
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
CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT, -- e.g., 'Home', 'Work'
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
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  
  -- Customer info (denormalized for guest orders)
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  
  -- Shipping address (denormalized)
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  governorate TEXT NOT NULL,
  postal_code TEXT,
  
  -- Order totals (in EGP cents)
  subtotal INTEGER NOT NULL,
  shipping_cost INTEGER NOT NULL,
  discount_amount INTEGER DEFAULT 0,
  total INTEGER NOT NULL,
  
  -- Delivery
  delivery_method TEXT NOT NULL, -- 'standard', 'express'
  
  -- Order status
  status TEXT DEFAULT 'placed',
  fulfillment_status TEXT DEFAULT 'unfulfilled',
  
  -- Timestamps
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
CREATE INDEX orders_order_number_idx ON orders(order_number);
CREATE INDEX orders_customer_id_idx ON orders(customer_id);
CREATE INDEX orders_status_idx ON orders(status);

-- ============================================================================
-- ORDER ITEMS
-- ============================================================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  
  -- Product info (denormalized in case product is deleted)
  product_name TEXT NOT NULL,
  product_slug TEXT NOT NULL,
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  image TEXT NOT NULL,
  
  -- Pricing
  price INTEGER NOT NULL, -- price at time of order
  quantity INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DISCOUNT CODES
-- ============================================================================
CREATE TABLE discount_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  
  -- Discount type
  discount_type TEXT NOT NULL, -- 'percentage', 'fixed'
  discount_value INTEGER NOT NULL, -- percentage (e.g., 15) or fixed amount in cents
  
  -- Conditions
  minimum_purchase INTEGER, -- minimum order subtotal in cents
  usage_limit INTEGER, -- total number of uses allowed
  usage_count INTEGER DEFAULT 0,
  
  -- Validity
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
CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE TABLE wishlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE wishlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wishlist_id UUID REFERENCES wishlists(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(wishlist_id, product_id)
);

-- ============================================================================
-- GUEST ORDERS (for guest checkout tracking)
-- ============================================================================
CREATE TABLE guest_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  order_number TEXT UNIQUE NOT NULL,
  verification_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX guest_orders_email_idx ON guest_orders(email);
CREATE INDEX guest_orders_token_idx ON guest_orders(verification_token);

-- ============================================================================
-- PRODUCT REVIEWS
-- ============================================================================
CREATE TABLE product_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT NOT NULL,
  comment TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(product_id, customer_id)
);

-- Review summary view
CREATE VIEW product_review_stats AS
SELECT 
  p.id AS product_id,
  COUNT(r.id) AS review_count,
  COALESCE(AVG(r.rating), 0) AS average_rating
FROM products p
LEFT JOIN product_reviews r ON p.id = r.product_id
GROUP BY p.id;

CREATE INDEX product_reviews_product_id_idx ON product_reviews(product_id);
CREATE INDEX product_reviews_customer_id_idx ON product_reviews(customer_id);

-- ============================================================================
-- ADMIN USERS
-- ============================================================================
CREATE TABLE admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_role CHECK (role IN ('admin', 'super_admin'))
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
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

-- PUBLIC READ POLICIES (unauthenticated + authenticated)
CREATE POLICY "Public can view collections" ON collections FOR SELECT USING (true);
CREATE POLICY "Public can view products" ON products FOR SELECT USING (true);
CREATE POLICY "Public can view product colors" ON product_colors FOR SELECT USING (true);
CREATE POLICY "Public can view product inventory" ON product_inventory FOR SELECT USING (true);

-- CUSTOMER POLICIES
CREATE POLICY "Users can view own profile" ON customers FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON customers FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own addresses" ON customer_addresses FOR SELECT USING (
  customer_id = auth.uid()
);
CREATE POLICY "Users can insert own addresses" ON customer_addresses FOR INSERT WITH CHECK (
  customer_id = auth.uid()
);
CREATE POLICY "Users can update own addresses" ON customer_addresses FOR UPDATE USING (
  customer_id = auth.uid()
);
CREATE POLICY "Users can delete own addresses" ON customer_addresses FOR DELETE USING (
  customer_id = auth.uid()
);

-- ORDER POLICIES
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (
  customer_id = auth.uid()
);
CREATE POLICY "Users can view own order items" ON order_items FOR SELECT USING (
  order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
);

-- CART POLICIES
CREATE POLICY "Users can view own cart" ON carts FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Users can insert own cart" ON carts FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Users can update own cart" ON carts FOR UPDATE USING (customer_id = auth.uid());

CREATE POLICY "Users can view own cart items" ON cart_items FOR SELECT USING (
  cart_id IN (SELECT id FROM carts WHERE customer_id = auth.uid())
);
CREATE POLICY "Users can insert own cart items" ON cart_items FOR INSERT WITH CHECK (
  cart_id IN (SELECT id FROM carts WHERE customer_id = auth.uid())
);
CREATE POLICY "Users can update own cart items" ON cart_items FOR UPDATE USING (
  cart_id IN (SELECT id FROM carts WHERE customer_id = auth.uid())
);
CREATE POLICY "Users can delete own cart items" ON cart_items FOR DELETE USING (
  cart_id IN (SELECT id FROM carts WHERE customer_id = auth.uid())
);

-- WISHLIST POLICIES
CREATE POLICY "Users can view own wishlist" ON wishlists FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Users can insert own wishlist" ON wishlists FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Users can view own wishlist items" ON wishlist_items FOR SELECT USING (
  wishlist_id IN (SELECT id FROM wishlists WHERE customer_id = auth.uid())
);
CREATE POLICY "Users can insert own wishlist items" ON wishlist_items FOR INSERT WITH CHECK (
  wishlist_id IN (SELECT id FROM wishlists WHERE customer_id = auth.uid())
);
CREATE POLICY "Users can delete own wishlist items" ON wishlist_items FOR DELETE USING (
  wishlist_id IN (SELECT id FROM wishlists WHERE customer_id = auth.uid())
);

-- GUEST ORDER POLICIES
CREATE POLICY "Public can view guest order by email/token" ON guest_orders FOR SELECT USING (
  verification_token = (SELECT auth.jwt() ->> 'verify_token'::TEXT) OR
  (email = (SELECT auth.jwt() ->> 'email'::TEXT) AND verification_token IS NULL)
);

-- PRODUCT REVIEWS POLICIES
CREATE POLICY "Authenticated users can CRUD own reviews" ON product_reviews FOR ALL USING (
  auth.uid() = customer_id
);
CREATE POLICY "Public can view all reviews" ON product_reviews FOR SELECT USING (true);

-- DISCOUNT CODES (public read for validation)
CREATE POLICY "Public can view active discount codes" ON discount_codes FOR SELECT USING (
  is_active = true AND 
  (valid_until IS NULL OR valid_until > NOW())
);

-- ADMIN POLICIES
CREATE POLICY "Admins can do everything" ON collections FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);
CREATE POLICY "Admins can do everything on products" ON products FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);
CREATE POLICY "Admins can do everything on product_colors" ON product_colors FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);
CREATE POLICY "Admins can do everything on product_inventory" ON product_inventory FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);
CREATE POLICY "Admins can view all orders" ON orders FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);
-- Removed: "Admins can update orders" policy
-- Admin order updates MUST go through update-order-status Edge Function
-- which calls update_order_status() to ensure proper business logic
CREATE POLICY "Admins can manage discount codes" ON discount_codes FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
CREATE TRIGGER update_product_inventory_updated_at BEFORE UPDATE ON product_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
CREATE TRIGGER update_customer_addresses_updated_at BEFORE UPDATE ON customer_addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
CREATE TRIGGER update_discount_codes_updated_at BEFORE UPDATE ON discount_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
CREATE TRIGGER update_carts_updated_at BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'NRV-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to decrement inventory on order placement
CREATE OR REPLACE FUNCTION decrement_inventory()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE product_inventory
  SET stock_quantity = stock_quantity - NEW.quantity
  WHERE product_id = NEW.product_id
    AND size = NEW.size
    AND stock_quantity >= NEW.quantity;
    
  -- If stock is 0, mark as out of stock
  UPDATE product_inventory
  SET in_stock = FALSE
  WHERE product_id = NEW.product_id
    AND size = NEW.size
    AND stock_quantity = 0;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decrement_inventory_on_order AFTER INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION decrement_inventory();

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX product_colors_product_id_idx ON product_colors(product_id);
CREATE INDEX product_inventory_product_id_idx ON product_inventory(product_id);
CREATE INDEX customer_addresses_customer_id_idx ON customer_addresses(customer_id);
CREATE INDEX order_items_order_id_idx ON order_items(order_id);
CREATE INDEX order_items_product_id_idx ON order_items(product_id);
CREATE INDEX cart_items_cart_id_idx ON cart_items(cart_id);
CREATE INDEX wishlist_items_wishlist_id_idx ON wishlist_items(wishlist_id);
CREATE INDEX guest_orders_email_idx ON guest_orders(email);
CREATE INDEX guest_orders_token_idx ON guest_orders(verification_token);
CREATE INDEX product_reviews_product_id_idx ON product_reviews(product_id);
CREATE INDEX product_reviews_customer_id_idx ON product_reviews(customer_id);
CREATE INDEX discount_codes_code_idx ON discount_codes(code);
CREATE INDEX discount_codes_active_idx ON discount_codes(is_active);
