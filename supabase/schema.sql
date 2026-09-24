-- ============================================================================
-- NERVE E-Commerce Database Schema — CONSOLIDATED SNAPSHOT
-- ============================================================================
-- This file is a complete, idempotent snapshot of the database in its FINAL
-- state after ALL migrations 001-033 in supabase/migrations/.
--
-- REGENERATE THIS FILE whenever a migration is added or changed so it keeps
-- representing the real migrated database. It is safe to re-run: every
-- statement uses IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.
--
-- Seed data is intentionally NOT part of this file:
--   * product / collection rows -> supabase/seed.sql
--   * discount code seeds       -> applied by migrations 030 (FREESHIP,
--     WELCOME15, NERVE20) and 033 (BUNDLE10, COMEBACK10), with development
--     copies documented in supabase/seed.sql
--
-- Section order:
--   1. Extensions        5. Views           9.  Row Level Security
--   2. Enum types        6. Functions      10.  Storage buckets & policies
--   3. Tables            7. Triggers       11.  Grants / revokes
--   4. Indexes           8. Comments       12.  Cron jobs
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- 2. ENUM TYPES
-- ============================================================================
-- None. Every status/type-style column uses TEXT + CHECK constraints
-- (status fields, discount_type, roles, sizes, categories, etc.).

-- ============================================================================
-- 3. TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- COLLECTIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL,
  image TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- PRODUCTS
-- (virtual_try_on was introduced then removed — migrations 024/025; the
--  ALTERs below guarantee the column/constraint are gone on older databases.)
-- ----------------------------------------------------------------------------
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

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_virtual_try_on_shape;
ALTER TABLE products DROP COLUMN IF EXISTS virtual_try_on;

-- ----------------------------------------------------------------------------
-- PRODUCT COLORS
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- PRODUCT SIZES & INVENTORY
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- CUSTOMERS (base + enhanced profile fields from migration 004)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer-not-to-say')),
  city TEXT,
  bio TEXT CHECK (LENGTH(bio) <= 500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- CUSTOMER ADDRESSES
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- ORDERS
-- 001 base + 003 tracking_url + 013 payment lifecycle columns
-- + 018 idempotency_key + 027 tracking_number
-- ----------------------------------------------------------------------------
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

  payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  -- 'paymob' reserved for future; active method is 'cod' only
  payment_provider TEXT CHECK (payment_provider IN ('cod', 'paymob')),
  payment_id TEXT,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,

  tracking_number TEXT,
  tracking_url TEXT,

  status TEXT DEFAULT 'placed',
  fulfillment_status TEXT DEFAULT 'unfulfilled',

  idempotency_key TEXT UNIQUE,

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

-- ----------------------------------------------------------------------------
-- ORDER ITEMS
-- (the old decrement_inventory trigger was removed by migration 002 —
--  stock is decremented only inside place_order())
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- DISCOUNT CODES
-- Seed rows (FREESHIP / WELCOME15 / NERVE20 / BUNDLE10 / COMEBACK10) live in
-- migrations 030 + 033 and supabase/seed.sql — not in this schema file.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- CARTS (for logged-in users)
-- ----------------------------------------------------------------------------
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

  UNIQUE(cart_id, product_id, color, size),
  CONSTRAINT cart_items_quantity_check CHECK (quantity >= 1 AND quantity <= 99)
);

-- ----------------------------------------------------------------------------
-- WISHLISTS (for logged-in users)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- WISHLIST SHARES (migration 031)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wishlist_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code TEXT UNIQUE NOT NULL,
  wishlist_id UUID REFERENCES wishlists(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  message TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- GUEST ORDERS (guest checkout tracking)
-- token_hash / expires_at / order_id added by migration 012.
-- Client access is deny-all: lookup only via lookup_guest_order() RPC.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guest_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  order_number TEXT UNIQUE NOT NULL,
  verification_token TEXT UNIQUE NOT NULL,
  token_hash TEXT,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- PRODUCT REVIEWS
-- photos + helpful_count added by migration 033.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT NOT NULL,
  comment TEXT,
  verified BOOLEAN DEFAULT FALSE,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(product_id, customer_id)
);

-- ----------------------------------------------------------------------------
-- REVIEW HELPFUL VOTES (migration 031)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_helpful_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(review_id, voter_id)
);

-- ----------------------------------------------------------------------------
-- ADMIN USERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_role CHECK (role IN ('admin', 'super_admin'))
);

-- ----------------------------------------------------------------------------
-- NEWSLETTER SUBSCRIBERS (002 base + 006 email-automation columns)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  first_name TEXT,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- CONTACT MESSAGES (migration 002)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('new', 'read', 'replied', 'archived'))
);

-- ----------------------------------------------------------------------------
-- BACK-IN-STOCK REQUESTS (003 base + 006 email-automation columns)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS back_in_stock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  notified BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMPTZ,
  customer_email TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(email, product_id, size)
);

-- ----------------------------------------------------------------------------
-- EMAIL LOGS (migration 006; status/error_message ensured again by 029)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  email_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  status TEXT DEFAULT 'sent',
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- CART ABANDONMENT TRACKING (migration 006)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cart_abandonment_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email TEXT NOT NULL,
  cart_items JSONB NOT NULL,
  cart_value INTEGER NOT NULL,
  last_activity_at TIMESTAMPTZ NOT NULL,
  email_sent_at TIMESTAMPTZ,
  recovered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- UNSUBSCRIBE TOKENS + AUDIT LOG (migration 009)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  email_type TEXT,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS unsubscribe_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  unsubscribe_type TEXT NOT NULL DEFAULT 'all',
  unsubscribe_method TEXT NOT NULL DEFAULT 'link',
  reason TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- EMAIL OPT-OUTS (migration 029 — per-type unsubscribe)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  email_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email, email_type)
);

-- ----------------------------------------------------------------------------
-- CHAT CONVERSATIONS / MESSAGES (migration 010)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  customer_name TEXT,

  status TEXT DEFAULT 'active',
  topic TEXT,
  sentiment TEXT,

  escalated_to_ticket_id UUID,
  human_handoff_at TIMESTAMPTZ,

  message_count INTEGER DEFAULT 0,
  first_message_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('active', 'closed', 'waiting_for_response')),
  CONSTRAINT valid_topic CHECK (topic IN ('orders', 'shipping', 'returns', 'products', 'billing', 'other'))
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE NOT NULL,

  sender TEXT NOT NULL,
  content TEXT NOT NULL,

  ai_model TEXT,
  ai_confidence DECIMAL(3,2),
  tokens_used INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  CONSTRAINT valid_sender CHECK (sender IN ('user', 'ai', 'human')),
  CONSTRAINT valid_confidence CHECK (ai_confidence >= 0 AND ai_confidence <= 1)
);

-- ----------------------------------------------------------------------------
-- SUPPORT TICKETS / RESPONSES (migration 010)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE SET NULL,

  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  customer_name TEXT,

  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  topic TEXT,

  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  assigned_to TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  CONSTRAINT valid_priority CHECK (priority IN ('urgent', 'normal', 'low'))
);

CREATE TABLE IF NOT EXISTS ticket_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,

  sender_type TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_name TEXT,

  message TEXT NOT NULL,
  attachments TEXT[] DEFAULT ARRAY[]::TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_sender_type CHECK (sender_type IN ('customer', 'admin'))
);

-- ----------------------------------------------------------------------------
-- AI CONTEXT CACHE (migration 010)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_context_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,

  customer_email TEXT,
  customer_id UUID,

  recent_orders JSONB,
  open_tickets JSONB,
  customer_preferences JSONB,

  last_updated TIMESTAMPTZ DEFAULT NOW(),
  ttl INTEGER DEFAULT 3600,

  CONSTRAINT valid_ttl CHECK (ttl > 0)
);

-- ----------------------------------------------------------------------------
-- RATE LIMIT REQUESTS (migration 011)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(identifier, window_start)
);

-- ----------------------------------------------------------------------------
-- PAYMENTS: ATTEMPTS / REFUNDS (migration 013)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  -- 'paymob' reserved for future; active method is 'cod' only
  provider TEXT NOT NULL CHECK (provider IN ('cod', 'paymob')),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'EGP',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'captured', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
  provider_transaction_id TEXT,
  provider_response JSONB,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_attempt_id UUID REFERENCES payment_attempts(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'EGP',
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  provider_refund_id TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- ORDER STATUS HISTORY (migration 013; written by update_order_status)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- ORDER RETURN / CANCELLATION REQUESTS (migration 013)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('cancellation', 'return')),
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(order_id, type)
);

-- ----------------------------------------------------------------------------
-- ORDER IDEMPOTENCY (migration 018)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

-- Catalog / search
CREATE INDEX IF NOT EXISTS products_search_idx ON products USING gin(
  to_tsvector('english', name || ' ' || description || ' ' || category)
);
CREATE INDEX IF NOT EXISTS products_name_simple_idx
  ON products USING GIN (to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS products_search_simple_idx
  ON products USING GIN (to_tsvector('simple', name || ' ' || description || ' ' || category));

-- Core references
CREATE INDEX IF NOT EXISTS product_colors_product_id_idx ON product_colors(product_id);
CREATE INDEX IF NOT EXISTS product_inventory_product_id_idx ON product_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_customers_city ON customers(city);
CREATE INDEX IF NOT EXISTS idx_customers_gender ON customers(gender);
CREATE INDEX IF NOT EXISTS customer_addresses_customer_id_idx ON customer_addresses(customer_id);

-- Orders / items
CREATE INDEX IF NOT EXISTS orders_order_number_idx ON orders(order_number);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_idempotency_key_idx ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON order_items(product_id);
CREATE INDEX IF NOT EXISTS order_status_history_order_id_idx ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS order_return_requests_order_id_idx ON order_return_requests(order_id);

-- Carts / wishlists
CREATE INDEX IF NOT EXISTS cart_items_cart_id_idx ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS wishlist_items_wishlist_id_idx ON wishlist_items(wishlist_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_product_id ON wishlist_items(product_id);
CREATE INDEX IF NOT EXISTS wishlist_shares_code_idx ON wishlist_shares(share_code);

-- Guest orders / reviews
CREATE INDEX IF NOT EXISTS guest_orders_email_idx ON guest_orders(email);
CREATE INDEX IF NOT EXISTS guest_orders_token_idx ON guest_orders(verification_token);
CREATE INDEX IF NOT EXISTS guest_orders_order_number_idx ON guest_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_guest_orders_order_id ON guest_orders(order_id);
CREATE INDEX IF NOT EXISTS product_reviews_product_id_idx ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS product_reviews_customer_id_idx ON product_reviews(customer_id);
CREATE INDEX IF NOT EXISTS product_reviews_product_rating_idx ON product_reviews(product_id, rating);

-- Discounts
CREATE INDEX IF NOT EXISTS discount_codes_code_idx ON discount_codes(code);
CREATE INDEX IF NOT EXISTS discount_codes_active_idx ON discount_codes(is_active);

-- Newsletter / contact / back-in-stock
CREATE INDEX IF NOT EXISTS newsletter_subscribers_email_idx ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS newsletter_subscribers_is_active_idx ON newsletter_subscribers(is_active);
CREATE INDEX IF NOT EXISTS contact_messages_status_idx ON contact_messages(status);
CREATE INDEX IF NOT EXISTS back_in_stock_lookup_idx
  ON back_in_stock_requests(product_id, size) WHERE notified = FALSE;
CREATE INDEX IF NOT EXISTS back_in_stock_requests_product_id_idx ON back_in_stock_requests(product_id);
CREATE INDEX IF NOT EXISTS back_in_stock_requests_email_idx ON back_in_stock_requests(email);
CREATE INDEX IF NOT EXISTS back_in_stock_requests_is_active_idx ON back_in_stock_requests(is_active);
CREATE INDEX IF NOT EXISTS back_in_stock_requests_active_idx ON back_in_stock_requests(is_active, notified_at);

-- Email automation
CREATE INDEX IF NOT EXISTS email_logs_recipient_idx ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS email_logs_email_type_idx ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS email_logs_status_idx ON email_logs(status);
CREATE INDEX IF NOT EXISTS email_logs_sent_at_idx ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS email_logs_recent_idx ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS cart_abandonment_customer_email_idx ON cart_abandonment_tracking(customer_email);
CREATE INDEX IF NOT EXISTS cart_abandonment_email_sent_at_idx ON cart_abandonment_tracking(email_sent_at);
CREATE INDEX IF NOT EXISTS cart_abandonment_recovered_at_idx ON cart_abandonment_tracking(recovered_at);
CREATE INDEX IF NOT EXISTS cart_abandonment_pending_emails_idx ON cart_abandonment_tracking(email_sent_at, recovered_at, last_activity_at);
CREATE INDEX IF NOT EXISTS unsubscribe_tokens_token_idx ON unsubscribe_tokens(token);
CREATE INDEX IF NOT EXISTS unsubscribe_tokens_email_idx ON unsubscribe_tokens(email);
CREATE INDEX IF NOT EXISTS unsubscribe_audit_log_email_idx ON unsubscribe_audit_log(email);
CREATE INDEX IF NOT EXISTS unsubscribe_audit_log_created_at_idx ON unsubscribe_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS email_opt_outs_email_idx ON email_opt_outs(email);

-- Chat / support
CREATE INDEX IF NOT EXISTS chat_conversations_user_id_idx ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS chat_conversations_email_idx ON chat_conversations(email);
CREATE INDEX IF NOT EXISTS chat_conversations_status_idx ON chat_conversations(status);
CREATE INDEX IF NOT EXISTS chat_conversations_created_at_idx ON chat_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_conversation_id_idx ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS chat_messages_sender_idx ON chat_messages(sender);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS support_tickets_email_idx ON support_tickets(email);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets(status);
CREATE INDEX IF NOT EXISTS support_tickets_priority_idx ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS support_tickets_created_at_idx ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_ticket_number_idx ON support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_support_tickets_conversation_id ON support_tickets(conversation_id);
CREATE INDEX IF NOT EXISTS ticket_responses_ticket_id_idx ON ticket_responses(ticket_id);
CREATE INDEX IF NOT EXISTS ticket_responses_sender_type_idx ON ticket_responses(sender_type);
CREATE INDEX IF NOT EXISTS ticket_responses_created_at_idx ON ticket_responses(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_context_cache_conversation_id_idx ON ai_context_cache(conversation_id);
CREATE INDEX IF NOT EXISTS ai_context_cache_customer_id_idx ON ai_context_cache(customer_id);
CREATE INDEX IF NOT EXISTS ai_context_cache_last_updated_idx ON ai_context_cache(last_updated DESC);

-- Rate limiting / payments / idempotency
CREATE INDEX IF NOT EXISTS rate_limit_requests_identifier_idx ON rate_limit_requests(identifier);
CREATE INDEX IF NOT EXISTS rate_limit_requests_window_idx ON rate_limit_requests(window_start);
CREATE INDEX IF NOT EXISTS payment_attempts_order_id_idx ON payment_attempts(order_id);
CREATE INDEX IF NOT EXISTS payment_attempts_provider_tx_idx ON payment_attempts(provider_transaction_id);
CREATE INDEX IF NOT EXISTS payment_attempts_idempotency_idx ON payment_attempts(idempotency_key);
CREATE INDEX IF NOT EXISTS refunds_order_id_idx ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_attempt_id ON refunds(payment_attempt_id);
CREATE INDEX IF NOT EXISTS order_idempotency_key_idx ON order_idempotency(idempotency_key);
CREATE INDEX IF NOT EXISTS order_idempotency_expires_idx ON order_idempotency(expires_at);
CREATE INDEX IF NOT EXISTS idx_order_idempotency_order_id ON order_idempotency(order_id);

-- ============================================================================
-- 5. VIEWS
-- ============================================================================
-- Migration 020 removed the analytics views (replaced by *_for_admin()
-- functions in section 6) — drop them so the final state has no leaked views.

DROP VIEW IF EXISTS active_conversations CASCADE;
DROP VIEW IF EXISTS tickets_needing_attention CASCADE;

-- product_review_stats: security_invoker = true (migration 026)
DROP VIEW IF EXISTS product_review_stats CASCADE;
CREATE VIEW product_review_stats WITH (security_invoker = true) AS
SELECT
  p.id AS product_id,
  COUNT(r.id) AS review_count,
  COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0) AS average_rating
FROM products p
LEFT JOIN product_reviews r ON p.id = r.product_id
GROUP BY p.id;

-- product_availability: public availability only, security_invoker = true (026)
DROP VIEW IF EXISTS product_availability CASCADE;
CREATE VIEW product_availability WITH (security_invoker = true) AS
SELECT product_id, size, in_stock FROM product_inventory;

-- product_stock_status: low-stock rollup, security_invoker = false so anon can
-- read threshold flags without SELECT on product_inventory.stock_quantity (033)
DROP VIEW IF EXISTS product_stock_status CASCADE;
CREATE VIEW product_stock_status WITH (security_invoker = false) AS
SELECT
  pi.product_id,
  MIN(pi.stock_quantity) AS min_stock_quantity,
  MAX(pi.low_stock_threshold) AS low_stock_threshold,
  (MIN(pi.stock_quantity) <= MAX(pi.low_stock_threshold)) AS is_low_stock
FROM product_inventory pi
GROUP BY pi.product_id;

-- ============================================================================
-- 6. FUNCTIONS (RPCs)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helpers & trigger functions
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

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

CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE chat_conversations
  SET
    last_message_at = NEW.created_at,
    message_count = message_count + 1,
    first_message_at = COALESCE(first_message_at, NEW.created_at),
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

-- Final versions (migration 021 overrides 012/010 originals)
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  num TEXT;
BEGIN
  num := 'NV-' || LPAD(FLOOR(RANDOM() * 999999 + 1)::TEXT, 6, '0');
  RETURN num;
END;
$$;

CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  num TEXT;
BEGIN
  num := 'TK-' || LPAD(FLOOR(RANDOM() * 999999 + 1)::TEXT, 6, '0');
  RETURN num;
END;
$$;

-- Removed by migration 002 (place_order replaced trigger-based decrementing)
DROP FUNCTION IF EXISTS decrement_inventory();

-- ----------------------------------------------------------------------------
-- place_order (migration 003 final body; grants per migration 017)
-- 13 args: (UUID, 11 TEXT, JSONB)
-- ----------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION place_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION place_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- ----------------------------------------------------------------------------
-- place_order_with_idempotency (migration 018)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION place_order_with_idempotency(
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
  p_items JSONB,
  p_idempotency_key TEXT
)
RETURNS TABLE (order_id UUID, order_number TEXT, total INTEGER, is_duplicate BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_order_id UUID;
  v_order orders;
  v_result_order_id UUID;
  v_result_order_number TEXT;
  v_result_total INTEGER;
BEGIN
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'Idempotency key is required' USING ERRCODE = 'P0001';
  END IF;

  SELECT order_id INTO v_existing_order_id FROM order_idempotency
    WHERE idempotency_key = p_idempotency_key
      AND expires_at > NOW()
    LIMIT 1;

  IF v_existing_order_id IS NOT NULL THEN
    SELECT id, order_number, total INTO v_result_order_id, v_result_order_number, v_result_total
      FROM orders WHERE id = v_existing_order_id;

    RETURN QUERY SELECT v_result_order_id, v_result_order_number, v_result_total, true;
    RETURN;
  END IF;

  SELECT * INTO v_order FROM place_order(
    p_customer_id, p_email, p_first_name, p_last_name, p_phone,
    p_address, p_city, p_governorate, p_postal_code,
    p_delivery_method, p_payment_provider, p_discount_code, p_items
  );

  INSERT INTO order_idempotency (idempotency_key, order_id)
    VALUES (p_idempotency_key, v_order.id)
    ON CONFLICT (idempotency_key) DO NOTHING;

  UPDATE orders SET idempotency_key = p_idempotency_key WHERE id = v_order.id;

  RETURN QUERY SELECT v_order.id, v_order.order_number, v_order.total, false;
END;
$$;

REVOKE ALL ON FUNCTION place_order_with_idempotency FROM PUBLIC;
GRANT EXECUTE ON FUNCTION place_order_with_idempotency TO service_role;

CREATE OR REPLACE FUNCTION cleanup_expired_idempotency()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM order_idempotency WHERE expires_at < NOW();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_expired_idempotency() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_idempotency() TO service_role;

-- ----------------------------------------------------------------------------
-- merge_guest_cart (migration 003 final: derives auth.uid(); grants per 017)
-- The original 2-arg (UUID, JSONB) variant was dropped by migration 003.
-- ----------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION merge_guest_cart(JSONB) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION merge_guest_cart(JSONB) TO authenticated;

-- ----------------------------------------------------------------------------
-- update_order_status (migration 027: 5-arg + transition validation + history)
-- The old 4-arg signature from migration 003 is dropped.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS update_order_status(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION update_order_status(
  p_order_id UUID,
  p_status TEXT,
  p_tracking_number TEXT DEFAULT NULL,
  p_tracking_url TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders;
  v_item order_items%ROWTYPE;
  v_from_status TEXT;
BEGIN
  IF p_status NOT IN ('placed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0001';
  END IF;

  v_from_status := v_order.status;

  -- Status transition validation (terminal states cannot be left).
  IF v_from_status IN ('cancelled', 'refunded') AND p_status NOT IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Cannot move order from % to %', v_from_status, p_status USING ERRCODE = 'P0001';
  END IF;
  IF v_from_status = 'delivered' AND p_status NOT IN ('delivered', 'refunded') THEN
    RAISE EXCEPTION 'Cannot move order from delivered to %', p_status USING ERRCODE = 'P0001';
  END IF;

  -- Restock once, only on the transition INTO cancelled/refunded (never twice).
  IF p_status IN ('cancelled', 'refunded') AND v_from_status NOT IN ('cancelled', 'refunded') THEN
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

  INSERT INTO order_status_history (order_id, from_status, to_status, reason)
  VALUES (p_order_id, v_from_status, p_status, p_reason);

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION update_order_status(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION update_order_status(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- validate_discount_code (migration 012)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_discount_code(p_code TEXT, p_subtotal INTEGER)
RETURNS TABLE (valid BOOLEAN, discount_type TEXT, discount_value INTEGER, discount_amount INTEGER, minimum_purchase INTEGER, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code discount_codes%ROWTYPE;
  v_amount INTEGER := 0;
BEGIN
  IF p_code IS NULL OR trim(p_code) = '' THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::INTEGER, 0, NULL::INTEGER, 'No discount code provided'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_code FROM discount_codes
    WHERE upper(trim(code)) = upper(trim(p_code))
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::INTEGER, 0, NULL::INTEGER, 'Invalid discount code'::TEXT;
    RETURN;
  END IF;

  IF NOT v_code.is_active THEN
    RETURN QUERY SELECT false, v_code.discount_type, v_code.discount_value, 0, v_code.minimum_purchase, 'Discount code is no longer active'::TEXT;
    RETURN;
  END IF;

  IF v_code.valid_until IS NOT NULL AND v_code.valid_until < NOW() THEN
    RETURN QUERY SELECT false, v_code.discount_type, v_code.discount_value, 0, v_code.minimum_purchase, 'Discount code has expired'::TEXT;
    RETURN;
  END IF;

  IF v_code.valid_from IS NOT NULL AND v_code.valid_from > NOW() THEN
    RETURN QUERY SELECT false, v_code.discount_type, v_code.discount_value, 0, v_code.minimum_purchase, 'Discount code is not yet active'::TEXT;
    RETURN;
  END IF;

  IF v_code.usage_limit IS NOT NULL AND v_code.usage_count >= v_code.usage_limit THEN
    RETURN QUERY SELECT false, v_code.discount_type, v_code.discount_value, 0, v_code.minimum_purchase, 'Discount code usage limit reached'::TEXT;
    RETURN;
  END IF;

  IF v_code.minimum_purchase IS NOT NULL AND p_subtotal < v_code.minimum_purchase THEN
    RETURN QUERY SELECT false, v_code.discount_type, v_code.discount_value, 0, v_code.minimum_purchase,
      ('Minimum purchase of EGP ' || v_code.minimum_purchase || ' required')::TEXT;
    RETURN;
  END IF;

  IF v_code.discount_type = 'percentage' THEN
    v_amount := (p_subtotal * v_code.discount_value / 100)::INTEGER;
  ELSIF v_code.discount_type = 'fixed' THEN
    v_amount := LEAST(v_code.discount_value, p_subtotal);
  END IF;

  RETURN QUERY SELECT true, v_code.discount_type, v_code.discount_value, v_amount, v_code.minimum_purchase, 'Discount applied'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION validate_discount_code(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_discount_code(TEXT, INTEGER) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- lookup_guest_order (migration 012 body; grants hardened by 014 + 019)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lookup_guest_order(p_email TEXT, p_order_number TEXT, p_token TEXT)
RETURNS TABLE (order_id UUID, order_number TEXT, status TEXT, total INTEGER, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest guest_orders%ROWTYPE;
  v_order orders%ROWTYPE;
BEGIN
  -- Rate-limiting is enforced in the edge function, not here.

  SELECT * INTO v_guest FROM guest_orders
    WHERE lower(email) = lower(trim(p_email))
      AND order_number = upper(trim(p_order_number))
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_guest.token_hash IS NOT NULL THEN
    IF encode(digest(p_token, 'sha256'), 'hex') != v_guest.token_hash THEN
      RETURN;
    END IF;
  ELSIF v_guest.verification_token != p_token THEN
    RETURN;
  END IF;

  IF v_guest.expires_at IS NOT NULL AND v_guest.expires_at < NOW() THEN
    RETURN;
  END IF;

  IF v_guest.order_id IS NOT NULL THEN
    SELECT * INTO v_order FROM orders WHERE id = v_guest.order_id;
    IF FOUND THEN
      RETURN QUERY SELECT v_order.id, v_order.order_number, v_order.status, v_order.total, v_order.created_at;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT v_guest.id, v_guest.order_number, 'placed'::TEXT, 0, v_guest.created_at;
END;
$$;

REVOKE ALL ON FUNCTION lookup_guest_order(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION lookup_guest_order(TEXT, TEXT, TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- verify_review_purchase (migration 012: IDOR-fixed version)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION verify_review_purchase(p_review_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_product_id TEXT;
  v_customer_id UUID;
  v_caller_uid UUID;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT product_id, customer_id INTO v_product_id, v_customer_id
    FROM product_reviews WHERE id = p_review_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_customer_id != v_caller_uid THEN
    RAISE EXCEPTION 'Forbidden: not your review' USING ERRCODE = '42501';
  END IF;

  SELECT o.id INTO v_order_id
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.customer_id = v_customer_id
      AND oi.product_id = v_product_id
      AND o.status = 'delivered'
    LIMIT 1;

  IF FOUND THEN
    UPDATE product_reviews SET verified = TRUE WHERE id = p_review_id;
  ELSE
    RAISE EXCEPTION 'No verified purchase found for this review' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION verify_review_purchase(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_review_purchase(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- vote_review_helpful (migration 033: persists helpful_count on the review)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vote_review_helpful(p_review_id UUID, p_voter_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_review_id IS NULL OR p_voter_id IS NULL OR length(trim(p_voter_id)) = 0 THEN
    RAISE EXCEPTION 'review_id and voter_id are required' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO review_helpful_votes (review_id, voter_id)
  VALUES (p_review_id, trim(p_voter_id))
  ON CONFLICT (review_id, voter_id) DO NOTHING;

  SELECT COUNT(*) INTO v_count
    FROM review_helpful_votes
   WHERE review_id = p_review_id;

  UPDATE product_reviews
     SET helpful_count = v_count
   WHERE id = p_review_id;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION vote_review_helpful(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vote_review_helpful(UUID, TEXT) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Unsubscribe system (migrations 009 + 029)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_unsubscribe_token(
  p_email TEXT,
  p_email_type TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO unsubscribe_tokens (email, email_type, token, expires_at)
  VALUES (
    lower(trim(p_email)),
    NULLIF(p_email_type, ''),
    v_token,
    NOW() + INTERVAL '7 days'
  );

  RETURN v_token;
END;
$$;
-- create_unsubscribe_token stays PUBLIC by design (client + edge flows).

CREATE OR REPLACE FUNCTION process_unsubscribe(
  p_token TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_email_type TEXT;
BEGIN
  SELECT email, email_type INTO v_email, v_email_type
    FROM unsubscribe_tokens
   WHERE token = p_token
     AND used_at IS NULL
     AND expires_at > NOW();

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired unsubscribe link');
  END IF;

  IF v_email_type IS NULL OR v_email_type = '' THEN
    -- Global unsubscribe: newsletter off + explicit ('all') opt-out row
    UPDATE newsletter_subscribers
       SET is_active = FALSE,
           unsubscribed_at = NOW(),
           updated_at = NOW()
     WHERE email = v_email;
    INSERT INTO email_opt_outs (email, email_type)
    VALUES (lower(trim(v_email)), 'all')
    ON CONFLICT (email, email_type) DO NOTHING;
  ELSE
    -- Type-specific unsubscribe: only that type
    INSERT INTO email_opt_outs (email, email_type)
    VALUES (lower(trim(v_email)), lower(trim(v_email_type)))
    ON CONFLICT (email, email_type) DO NOTHING;
  END IF;

  INSERT INTO unsubscribe_audit_log (email, unsubscribe_type, unsubscribe_method, reason, user_agent, ip_address)
  VALUES (v_email, COALESCE(v_email_type, 'all'), 'link', p_reason, p_user_agent, p_ip_address);

  UPDATE unsubscribe_tokens SET used_at = NOW() WHERE token = p_token;

  RETURN jsonb_build_object(
    'success', true,
    'email', v_email,
    'unsubscribed_from', COALESCE(v_email_type, 'all')
  );
END;
$$;

REVOKE ALL ON FUNCTION process_unsubscribe(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_unsubscribe(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- should_send_email: migration 029 replaces the old 1-arg overload with the
-- 2-arg (p_email, p_email_type DEFAULT NULL) version.
DROP FUNCTION IF EXISTS should_send_email(TEXT);
DROP FUNCTION IF EXISTS should_send_email(TEXT, TEXT);

CREATE OR REPLACE FUNCTION should_send_email(p_email TEXT, p_email_type TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active BOOLEAN;
  v_opt_out_count INTEGER;
BEGIN
  SELECT is_active INTO v_active
    FROM newsletter_subscribers
   WHERE lower(email) = lower(trim(p_email))
   LIMIT 1;

  IF COALESCE(v_active, TRUE) = FALSE THEN
    RETURN FALSE;
  END IF;

  IF p_email_type IS NULL OR p_email_type = '' THEN
    SELECT COUNT(*) INTO v_opt_out_count
      FROM email_opt_outs
     WHERE lower(email) = lower(trim(p_email));
    RETURN v_opt_out_count = 0;
  END IF;

  SELECT COUNT(*) INTO v_opt_out_count
    FROM email_opt_outs
   WHERE lower(email) = lower(trim(p_email))
     AND email_type IN ('all', lower(trim(p_email_type)));
  RETURN v_opt_out_count = 0;
END;
$$;

REVOKE ALL ON FUNCTION should_send_email(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION should_send_email(TEXT, TEXT) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Email automation RPCs (006/012/028/029 final versions)
-- ----------------------------------------------------------------------------
-- log_email_send: migration 029 replaces the old 4-arg overload with the
-- 6-arg version (status + error_message).
DROP FUNCTION IF EXISTS log_email_send(TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS log_email_send(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT);

CREATE OR REPLACE FUNCTION log_email_send(
  p_recipient_email TEXT,
  p_email_type TEXT,
  p_subject TEXT,
  p_metadata JSONB DEFAULT NULL,
  p_status TEXT DEFAULT 'sent',
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO email_logs (recipient_email, email_type, subject, metadata, status, error_message)
  VALUES (p_recipient_email, p_email_type, p_subject, p_metadata, p_status, p_error_message)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION log_email_send(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_email_send(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION mark_back_in_stock_notified(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE back_in_stock_requests
  SET notified = TRUE,
      notified_at = NOW(),
      is_active = FALSE
  WHERE id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION mark_back_in_stock_notified(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_back_in_stock_notified(UUID) TO service_role;

CREATE OR REPLACE FUNCTION find_back_in_stock_notifications()
RETURNS TABLE (request_id UUID, product_id TEXT, customer_email TEXT, size TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bisr.id,
    bisr.product_id,
    COALESCE(bisr.customer_email, bisr.email),
    bisr.size
  FROM back_in_stock_requests bisr
  JOIN product_inventory pi
    ON bisr.product_id = pi.product_id
   AND (bisr.size IS NULL OR pi.size = bisr.size)
  WHERE bisr.is_active = TRUE
    AND bisr.notified = FALSE
    AND bisr.notified_at IS NULL
    AND pi.in_stock = TRUE
    AND pi.stock_quantity > 0
  ORDER BY bisr.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION find_back_in_stock_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_back_in_stock_notifications() TO service_role;

CREATE OR REPLACE FUNCTION find_abandoned_carts_for_email()
RETURNS TABLE (customer_email TEXT, cart_items JSONB, cart_value INTEGER, last_activity_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT cat.customer_email, cat.cart_items, cat.cart_value, cat.last_activity_at
  FROM cart_abandonment_tracking cat
  WHERE cat.email_sent_at IS NULL
    AND cat.recovered_at IS NULL
    AND cat.last_activity_at < NOW() - INTERVAL '24 hours'
  ORDER BY cat.last_activity_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION find_abandoned_carts_for_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_abandoned_carts_for_email() TO service_role;

CREATE OR REPLACE FUNCTION mark_cart_abandonment_email_sent(p_customer_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE cart_abandonment_tracking
  SET email_sent_at = NOW()
  WHERE customer_email = p_customer_email
    AND email_sent_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION mark_cart_abandonment_email_sent(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_cart_abandonment_email_sent(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION mark_cart_abandonment_recovered(p_customer_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE cart_abandonment_tracking
  SET recovered_at = NOW()
  WHERE customer_email = p_customer_email;
END;
$$;

REVOKE ALL ON FUNCTION mark_cart_abandonment_recovered(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_cart_abandonment_recovered(TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- Chatbot / support RPCs (migration 012 bodies; grants per 016)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_ai_context(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_result JSONB;
  v_caller_uid UUID;
  v_caller_email TEXT;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL THEN
    SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_uid;
    IF lower(trim(p_email)) != lower(trim(v_caller_email)) THEN
      IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = v_caller_uid) THEN
        RAISE EXCEPTION 'Forbidden: can only query own context' USING ERRCODE = '42501';
      END IF;
    END IF;
  ELSE
    IF auth.role() != 'service_role' THEN
      IF auth.jwt() IS NULL OR (auth.jwt()->>'role') != 'service_role' THEN
        RETURN jsonb_build_object('recent_orders', '[]'::jsonb, 'open_tickets', '[]'::jsonb);
      END IF;
    END IF;
  END IF;

  SELECT id INTO v_customer_id FROM customers WHERE lower(email) = lower(trim(p_email)) LIMIT 1;

  SELECT jsonb_build_object(
    'recent_orders', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'order_number', o.order_number, 'status', o.status, 'total', o.total, 'placed_at', o.placed_at
      ))
      FROM (SELECT * FROM orders WHERE lower(email) = lower(trim(p_email)) OR customer_id = v_customer_id ORDER BY placed_at DESC LIMIT 5) o
    ), '[]'::jsonb),
    'open_tickets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'ticket_number', t.ticket_number, 'status', t.status
      ))
      FROM (SELECT * FROM support_tickets WHERE lower(email) = lower(trim(p_email)) OR user_id = v_customer_id AND status != 'closed' LIMIT 5) t
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION get_ai_context(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_ai_context(TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION create_ticket_from_chat(
  p_conversation_id UUID, p_subject TEXT, p_description TEXT, p_priority TEXT DEFAULT 'normal'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation chat_conversations%ROWTYPE;
  v_ticket_id UUID;
  v_caller_uid UUID;
  v_is_admin BOOLEAN := false;
BEGIN
  IF p_priority NOT IN ('urgent', 'normal', 'low') THEN
    RAISE EXCEPTION 'Invalid priority' USING ERRCODE = 'P0001';
  END IF;
  IF length(trim(p_subject)) < 5 OR length(trim(p_subject)) > 200 THEN
    RAISE EXCEPTION 'Subject must be 5-200 characters' USING ERRCODE = 'P0001';
  END IF;
  IF length(trim(p_description)) < 20 OR length(trim(p_description)) > 5000 THEN
    RAISE EXCEPTION 'Description must be 20-5000 characters' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_conversation FROM chat_conversations WHERE id = p_conversation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found' USING ERRCODE = 'P0001';
  END IF;

  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM admin_users WHERE user_id = v_caller_uid) INTO v_is_admin;
  END IF;

  IF v_conversation.user_id IS NOT NULL THEN
    IF v_caller_uid IS NULL OR (v_conversation.user_id != v_caller_uid AND NOT v_is_admin AND auth.role() != 'service_role') THEN
      RAISE EXCEPTION 'Forbidden: conversation belongs to another user' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF auth.role() NOT IN ('service_role', 'authenticated', 'anon') THEN
      RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM support_tickets WHERE conversation_id = p_conversation_id) THEN
    RAISE EXCEPTION 'A ticket already exists for this conversation' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO support_tickets (conversation_id, user_id, email, subject, description, priority, status)
  VALUES (
    p_conversation_id,
    v_conversation.user_id,
    v_conversation.email,
    trim(p_subject),
    trim(p_description),
    p_priority,
    'open'
  )
  RETURNING id INTO v_ticket_id;

  UPDATE chat_conversations SET escalated_to_ticket_id = v_ticket_id, status = 'escalated'
    WHERE id = p_conversation_id;

  RETURN v_ticket_id;
END;
$$;

REVOKE ALL ON FUNCTION create_ticket_from_chat(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_ticket_from_chat(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION update_conversation_metadata(
  p_conversation_id UUID, p_topic TEXT DEFAULT NULL, p_sentiment TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation chat_conversations%ROWTYPE;
  v_caller_uid UUID;
  v_is_admin BOOLEAN := false;
BEGIN
  SELECT * INTO v_conversation FROM chat_conversations WHERE id = p_conversation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found' USING ERRCODE = 'P0001';
  END IF;

  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM admin_users WHERE user_id = v_caller_uid) INTO v_is_admin;
  END IF;

  IF v_conversation.user_id IS NOT NULL AND v_caller_uid IS DISTINCT FROM v_conversation.user_id
     AND NOT v_is_admin AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE chat_conversations SET topic = COALESCE(p_topic, topic), sentiment = COALESCE(p_sentiment, sentiment)
    WHERE id = p_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION update_conversation_metadata(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION update_conversation_metadata(UUID, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION close_conversation(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation chat_conversations%ROWTYPE;
  v_caller_uid UUID;
  v_is_admin BOOLEAN := false;
BEGIN
  SELECT * INTO v_conversation FROM chat_conversations WHERE id = p_conversation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found' USING ERRCODE = 'P0001';
  END IF;

  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM admin_users WHERE user_id = v_caller_uid) INTO v_is_admin;
  END IF;

  IF v_conversation.user_id IS NOT NULL AND v_caller_uid IS DISTINCT FROM v_conversation.user_id
     AND NOT v_is_admin AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE chat_conversations SET status = 'closed' WHERE id = p_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION close_conversation(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION close_conversation(UUID) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Admin-only replacements for the views removed by migration 020
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION active_conversations_for_admin()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  email TEXT,
  topic TEXT,
  sentiment TEXT,
  status TEXT,
  message_count INTEGER,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_is_admin BOOLEAN := false;
BEGIN
  v_caller_uid := auth.uid();

  IF v_caller_uid IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM admin_users WHERE user_id = v_caller_uid) INTO v_is_admin;
  END IF;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden: admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.user_id,
    c.email,
    c.topic,
    c.sentiment,
    c.status,
    (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id)::INTEGER,
    (SELECT MAX(created_at) FROM chat_messages WHERE conversation_id = c.id),
    c.created_at
  FROM chat_conversations c
  WHERE c.status != 'closed'
  ORDER BY c.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION active_conversations_for_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION tickets_needing_attention_for_admin()
RETURNS TABLE (
  id UUID,
  ticket_number TEXT,
  user_id UUID,
  email TEXT,
  subject TEXT,
  status TEXT,
  priority TEXT,
  created_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_is_admin BOOLEAN := false;
BEGIN
  v_caller_uid := auth.uid();

  IF v_caller_uid IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM admin_users WHERE user_id = v_caller_uid) INTO v_is_admin;
  END IF;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden: admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.ticket_number,
    t.user_id,
    t.email,
    t.subject,
    t.status,
    t.priority,
    t.created_at,
    t.updated_at
  FROM support_tickets t
  WHERE t.status IN ('open', 'in_progress')
  ORDER BY
    CASE t.priority
      WHEN 'urgent' THEN 1
      WHEN 'normal' THEN 2
      WHEN 'low' THEN 3
      ELSE 4
    END,
    t.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION tickets_needing_attention_for_admin() TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- check_rate_limit (migration 011 body; locked to service_role by 012)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_window_start TIMESTAMPTZ,
  p_max_requests INTEGER,
  p_window_ms INTEGER
)
RETURNS TABLE (allowed BOOLEAN, current_count INTEGER, window_end TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_end TIMESTAMPTZ;
  v_current_count INTEGER;
  v_result RECORD;
BEGIN
  v_window_end := p_window_start + (p_window_ms || ' ms')::INTERVAL;

  INSERT INTO rate_limit_requests (identifier, window_start, request_count)
  VALUES (p_identifier, p_window_start, 1)
  ON CONFLICT (identifier, window_start)
  DO UPDATE SET
    request_count = rate_limit_requests.request_count + 1,
    created_at = NOW()
  RETURNING * INTO v_result;

  v_current_count := v_result.request_count;

  RETURN QUERY SELECT
    v_current_count <= p_max_requests,
    v_current_count,
    v_window_end;
END;
$$;

REVOKE ALL ON FUNCTION check_rate_limit(TEXT, TIMESTAMPTZ, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, TIMESTAMPTZ, INTEGER, INTEGER) TO service_role;

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

-- updated_at triggers (migration 001)
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

-- Auto-create customers on signup (migration 002)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- The old inventory-decrement trigger is gone (migration 002)
DROP TRIGGER IF EXISTS decrement_inventory_on_order ON order_items;

-- Email automation updated_at triggers (migration 006)
DROP TRIGGER IF EXISTS update_newsletter_subscribers_updated_at ON newsletter_subscribers;
CREATE TRIGGER update_newsletter_subscribers_updated_at BEFORE UPDATE ON newsletter_subscribers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_cart_abandonment_tracking_updated_at ON cart_abandonment_tracking;
CREATE TRIGGER update_cart_abandonment_tracking_updated_at BEFORE UPDATE ON cart_abandonment_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Support updated_at + message counter triggers (migration 010)
DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_ticket_responses_updated_at ON ticket_responses;
CREATE TRIGGER update_ticket_responses_updated_at BEFORE UPDATE ON ticket_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS conversation_update_on_message ON chat_messages;
CREATE TRIGGER conversation_update_on_message AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- ============================================================================
-- 8. COMMENTS
-- ============================================================================
COMMENT ON COLUMN products.price IS 'Price in whole EGP (not cents/piastres). e.g. 1250 = EGP 1,250.';
COMMENT ON COLUMN products.compare_at_price IS 'Compare-at price in whole EGP.';
COMMENT ON COLUMN discount_codes.discount_value IS 'Percentage (e.g. 15) or fixed amount in whole EGP — not cents.';
COMMENT ON COLUMN discount_codes.minimum_purchase IS 'Minimum order subtotal in whole EGP.';
COMMENT ON COLUMN customers.date_of_birth IS 'User birth date for age-based features';
COMMENT ON COLUMN customers.gender IS 'User gender for personalization';
COMMENT ON COLUMN customers.city IS 'User city for location-based features';
COMMENT ON COLUMN customers.bio IS 'User bio/about me text (max 500 chars)';

-- ============================================================================
-- 9. ROW LEVEL SECURITY (RLS)
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
ALTER TABLE wishlist_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_helpful_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE back_in_stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_abandonment_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE unsubscribe_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_opt_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_context_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_idempotency ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Collections / products / colors / inventory
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view collections" ON collections;
CREATE POLICY "Public can view collections" ON collections FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can do everything" ON collections;
CREATE POLICY "Admins can do everything" ON collections FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

DROP POLICY IF EXISTS "Public can view products" ON products;
CREATE POLICY "Public can view products" ON products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can do everything on products" ON products;
CREATE POLICY "Admins can do everything on products" ON products FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

DROP POLICY IF EXISTS "Public can view product colors" ON product_colors;
CREATE POLICY "Public can view product colors" ON product_colors FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can do everything on product_colors" ON product_colors;
CREATE POLICY "Admins can do everything on product_colors" ON product_colors FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

-- Migration 012 replaced the original USING (true) policy by name
DROP POLICY IF EXISTS "Public can view product inventory" ON product_inventory;
DROP POLICY IF EXISTS "Public can view inventory availability" ON product_inventory;
CREATE POLICY "Public can view inventory availability" ON product_inventory FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "Admins can do everything on product_inventory" ON product_inventory;
CREATE POLICY "Admins can do everything on product_inventory" ON product_inventory FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

-- ---------------------------------------------------------------------------
-- Customers / addresses
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON customers;
CREATE POLICY "Users can view own profile" ON customers FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON customers;
CREATE POLICY "Users can update own profile" ON customers FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON customers;
CREATE POLICY "Users can insert own profile" ON customers
  FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own enhanced profile" ON customers;
CREATE POLICY "Users can update own enhanced profile" ON customers
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

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

-- ---------------------------------------------------------------------------
-- Orders / items
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (
  customer_id = auth.uid()
);
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
CREATE POLICY "Admins can view all orders" ON orders FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
CREATE POLICY "Users can view own order items" ON order_items FOR SELECT USING (
  order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
);

-- ---------------------------------------------------------------------------
-- Discount codes: public harvest removed by 012; admin manage (WITH CHECK)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view active discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Admins can manage discount codes" ON discount_codes;
CREATE POLICY "Admins can manage discount codes" ON discount_codes FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

-- ---------------------------------------------------------------------------
-- Carts / wishlists
-- ---------------------------------------------------------------------------
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

DROP POLICY IF EXISTS "Anyone can create wishlist share" ON wishlist_shares;
CREATE POLICY "Anyone can create wishlist share" ON wishlist_shares FOR INSERT
  WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can read wishlist share" ON wishlist_shares;
CREATE POLICY "Anyone can read wishlist share" ON wishlist_shares FOR SELECT
  USING (true);

-- ---------------------------------------------------------------------------
-- Guest orders: broken JWT-claim policy removed by 012 (deny-all for clients)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view guest order by email/token" ON guest_orders;

-- ---------------------------------------------------------------------------
-- Product reviews / helpful votes
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can CRUD own reviews" ON product_reviews;
CREATE POLICY "Authenticated users can CRUD own reviews" ON product_reviews FOR ALL USING (
  auth.uid() = customer_id
);
DROP POLICY IF EXISTS "Public can view all reviews" ON product_reviews;
CREATE POLICY "Public can view all reviews" ON product_reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can select helpful votes" ON review_helpful_votes;
CREATE POLICY "Public can select helpful votes" ON review_helpful_votes FOR SELECT
  USING (true);

-- ---------------------------------------------------------------------------
-- Admin users (migration 003: makes every admin-gated policy reachable)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can check own admin status" ON admin_users;
CREATE POLICY "Users can check own admin status" ON admin_users FOR SELECT USING (
  user_id = auth.uid()
);

-- ---------------------------------------------------------------------------
-- Newsletter subscribers
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can subscribe" ON newsletter_subscribers;
CREATE POLICY "Anyone can subscribe" ON newsletter_subscribers FOR INSERT
  WITH CHECK (true);
DROP POLICY IF EXISTS "Public can insert newsletter subscription" ON newsletter_subscribers;
CREATE POLICY "Public can insert newsletter subscription" ON newsletter_subscribers FOR INSERT
  WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can view subscribers" ON newsletter_subscribers;
CREATE POLICY "Admins can view subscribers" ON newsletter_subscribers FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);
DROP POLICY IF EXISTS "Admins can view all newsletter subscribers" ON newsletter_subscribers;
CREATE POLICY "Admins can view all newsletter subscribers" ON newsletter_subscribers FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);
DROP POLICY IF EXISTS "Admins can update newsletter subscribers" ON newsletter_subscribers;
CREATE POLICY "Admins can update newsletter subscribers" ON newsletter_subscribers FOR UPDATE USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);
DROP POLICY IF EXISTS "Users can view own newsletter subscription" ON newsletter_subscribers;
CREATE POLICY "Users can view own newsletter subscription" ON newsletter_subscribers FOR SELECT USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- ---------------------------------------------------------------------------
-- Contact messages
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Back-in-stock requests
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can request a back-in-stock alert" ON back_in_stock_requests;
CREATE POLICY "Anyone can request a back-in-stock alert" ON back_in_stock_requests FOR INSERT
  WITH CHECK (true);
DROP POLICY IF EXISTS "Users can insert back in stock requests" ON back_in_stock_requests;
CREATE POLICY "Users can insert back in stock requests" ON back_in_stock_requests FOR INSERT
  WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can view back-in-stock requests" ON back_in_stock_requests;
CREATE POLICY "Admins can view back-in-stock requests" ON back_in_stock_requests FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);
DROP POLICY IF EXISTS "Users can view own back in stock requests" ON back_in_stock_requests;
CREATE POLICY "Users can view own back in stock requests" ON back_in_stock_requests FOR SELECT USING (
  customer_email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
  auth.uid() IN (SELECT user_id FROM admin_users)
);
DROP POLICY IF EXISTS "Users can delete own back in stock requests" ON back_in_stock_requests;
CREATE POLICY "Users can delete own back in stock requests" ON back_in_stock_requests FOR DELETE USING (
  customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- ---------------------------------------------------------------------------
-- Email logs / cart abandonment / unsubscribe / opt-outs
-- (email_logs, cart_abandonment_tracking, unsubscribe_tokens, email_opt_outs:
--  RLS on, no client policies — service_role / SECURITY DEFINER only.)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view email logs" ON email_logs;
CREATE POLICY "Admins can view email logs" ON email_logs FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

DROP POLICY IF EXISTS "Anyone can log an unsubscribe event" ON unsubscribe_audit_log;
CREATE POLICY "Anyone can log an unsubscribe event" ON unsubscribe_audit_log FOR INSERT
  WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can view unsubscribe logs" ON unsubscribe_audit_log;
CREATE POLICY "Admins can view unsubscribe logs" ON unsubscribe_audit_log FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

-- ---------------------------------------------------------------------------
-- Chat / support
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can see own conversations" ON chat_conversations;
CREATE POLICY "Users can see own conversations" ON chat_conversations FOR SELECT USING (
  user_id = auth.uid() OR auth.uid() IN (SELECT user_id FROM admin_users)
);

DROP POLICY IF EXISTS "Users can see own messages" ON chat_messages;
CREATE POLICY "Users can see own messages" ON chat_messages FOR SELECT USING (
  conversation_id IN (SELECT id FROM chat_conversations WHERE user_id = auth.uid())
  OR auth.uid() IN (SELECT user_id FROM admin_users)
);

DROP POLICY IF EXISTS "Users can see own tickets" ON support_tickets;
CREATE POLICY "Users can see own tickets" ON support_tickets FOR SELECT USING (
  user_id = auth.uid() OR auth.uid() IN (SELECT user_id FROM admin_users)
);
DROP POLICY IF EXISTS "Users can create own tickets" ON support_tickets;
CREATE POLICY "Users can create own tickets" ON support_tickets FOR INSERT WITH CHECK (
  user_id = auth.uid() OR user_id IS NULL
);

DROP POLICY IF EXISTS "Users can see ticket responses" ON ticket_responses;
CREATE POLICY "Users can see ticket responses" ON ticket_responses FOR SELECT USING (
  ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.uid())
  OR auth.uid() IN (SELECT user_id FROM admin_users)
);

-- ---------------------------------------------------------------------------
-- Rate limiting (service-role policies from migration 011)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can view" ON rate_limit_requests;
CREATE POLICY "Service role can view" ON rate_limit_requests FOR SELECT
  USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role can insert" ON rate_limit_requests;
CREATE POLICY "Service role can insert" ON rate_limit_requests FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role can update" ON rate_limit_requests;
CREATE POLICY "Service role can update" ON rate_limit_requests FOR UPDATE
  USING (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- Payments / refunds / status history / returns / idempotency (013 + 021)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view payment attempts" ON payment_attempts;
CREATE POLICY "Admins can view payment attempts" ON payment_attempts FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM admin_users));
DROP POLICY IF EXISTS "Users can view own payment attempts" ON payment_attempts;
CREATE POLICY "Users can view own payment attempts" ON payment_attempts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = payment_attempts.order_id AND orders.customer_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage refunds" ON refunds;
CREATE POLICY "Admins can manage refunds" ON refunds FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));
DROP POLICY IF EXISTS "Users can view own refunds" ON refunds;
CREATE POLICY "Users can view own refunds" ON refunds FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = refunds.order_id AND orders.customer_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can view status history" ON order_status_history;
CREATE POLICY "Admins can view status history" ON order_status_history FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM admin_users));
DROP POLICY IF EXISTS "Users can view own order history" ON order_status_history;
CREATE POLICY "Users can view own order history" ON order_status_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_status_history.order_id AND orders.customer_id = auth.uid()));

-- Migration 021 replaced the 013 FOR ALL policy with insert/select only
DROP POLICY IF EXISTS "Users can manage own return requests" ON order_return_requests;
DROP POLICY IF EXISTS "Guests can view own return requests via order" ON order_return_requests;
DROP POLICY IF EXISTS "Users can view own return requests" ON order_return_requests;
CREATE POLICY "Users can view own return requests"
  ON order_return_requests FOR SELECT
  USING (
    auth.uid() = customer_id
  );
DROP POLICY IF EXISTS "Users can create return requests" ON order_return_requests;
CREATE POLICY "Users can create return requests"
  ON order_return_requests FOR INSERT
  WITH CHECK (
    auth.uid() = customer_id
  );
DROP POLICY IF EXISTS "Admins can manage all return requests" ON order_return_requests;
CREATE POLICY "Admins can manage all return requests"
  ON order_return_requests FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

DROP POLICY IF EXISTS "Service role can access" ON order_idempotency;
CREATE POLICY "Service role can access" ON order_idempotency FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 10. STORAGE BUCKETS & POLICIES (migrations 002 + 031)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('product-images', 'product-images', true),
  ('collection-images', 'collection-images', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-photos',
  'review-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
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

DROP POLICY IF EXISTS "Users write own avatar" ON storage.objects;
CREATE POLICY "Users write own avatar" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Public can view review photos" ON storage.objects;
CREATE POLICY "Public can view review photos" ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'review-photos');
DROP POLICY IF EXISTS "Authenticated can upload review photos" ON storage.objects;
CREATE POLICY "Authenticated can upload review photos" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'review-photos');
DROP POLICY IF EXISTS "Users can delete own review photos" ON storage.objects;
CREATE POLICY "Users can delete own review photos" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'review-photos' AND owner = auth.uid());

-- ============================================================================
-- 11. GRANTS / REVOKE (tables & views)
-- ============================================================================
-- Function EXECUTE grants/revokes appear next to each function above.

-- Payment / order lifecycle tables (migration 013)
GRANT SELECT ON payment_attempts, refunds, order_status_history, order_return_requests TO authenticated;
GRANT SELECT ON payment_attempts, refunds, order_status_history, order_return_requests TO service_role;
GRANT INSERT, UPDATE ON payment_attempts, refunds, order_status_history, order_return_requests TO service_role;

-- product_inventory: final state per migration 031 (anon gets column-level
-- SELECT only, so stock_quantity/low_stock_threshold stay hidden; the
-- security_invoker product_availability view keeps working for anon).
REVOKE ALL ON product_inventory FROM anon;
GRANT SELECT (product_id, size, in_stock) ON product_inventory TO anon;
GRANT SELECT ON product_inventory TO authenticated, service_role;

-- Views
GRANT SELECT ON product_availability TO anon, authenticated, service_role;
GRANT SELECT ON product_review_stats TO anon, authenticated;
GRANT SELECT ON product_stock_status TO anon, authenticated, service_role;

-- ============================================================================
-- 12. CRON JOBS (migrations 007 + 032)
-- pg_cron / pg_net jobs are optional: every block no-ops safely when the
-- extension (or cron schema) is unavailable. Secrets are never inlined —
-- jobs read CRON_SECRET / SUPABASE_SERVICE_ROLE_KEY from the vault at run time.
-- ============================================================================
DO $$
BEGIN
  GRANT USAGE ON SCHEMA cron TO postgres;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- Migration 007: weekly cleanup of old email logs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'cron' AND table_name = 'job') THEN
      BEGIN
        PERFORM cron.schedule('cleanup_old_email_logs', '0 3 * * 1', 'DELETE FROM email_logs WHERE created_at < NOW() - INTERVAL ''90 days'';');
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;
END $$;

-- Migration 007: weekly cleanup of old cart tracking rows
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'cron' AND table_name = 'job') THEN
      BEGIN
        PERFORM cron.schedule('cleanup_old_cart_tracking', '0 4 * * 1', 'DELETE FROM cart_abandonment_tracking WHERE created_at < NOW() - INTERVAL ''30 days'';');
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;
END $$;

-- Migration 032: hourly back-in-stock notifications (empty body → all products)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'cron' AND table_name = 'job') THEN
    BEGIN
      PERFORM cron.unschedule('send_back_in_stock_hourly');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    BEGIN
      PERFORM cron.schedule(
        'send_back_in_stock_hourly',
        '0 * * * *',
        $job$
        SELECT net.http_post(
          url := 'https://gfmxvvjqlhrnmidutjwx.supabase.co/functions/v1/send-back-in-stock',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || vault.get_secret('SUPABASE_SERVICE_ROLE_KEY'),
            'x-cron-secret', vault.get_secret('CRON_SECRET')
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 30000
        ) AS request_id;
        $job$
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;

-- Migration 032: daily 10:00 UTC abandoned-cart emails
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'cron' AND table_name = 'job') THEN
    BEGIN
      PERFORM cron.unschedule('process_abandoned_carts_daily');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    BEGIN
      PERFORM cron.schedule(
        'process_abandoned_carts_daily',
        '0 10 * * *',
        $job$
        SELECT net.http_post(
          url := 'https://gfmxvvjqlhrnmidutjwx.supabase.co/functions/v1/process-abandoned-carts',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || vault.get_secret('SUPABASE_SERVICE_ROLE_KEY'),
            'x-cron-secret', vault.get_secret('CRON_SECRET')
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 60000
        ) AS request_id;
        $job$
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;

-- ============================================================================
-- END OF SCHEMA (migrations 001-033)
-- ============================================================================
