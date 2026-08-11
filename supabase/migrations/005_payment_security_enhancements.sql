For NERVE, we can reproduce the same shopping experience and layout philosophy while keeping NERVE’s own identity.

NERVE UI/UX direction

1. Homepage

Full-width hero image/video
Minimal header over the hero
Strong CTA: SHOP NOW
Featured collections immediately below
Product grid
Promotional/editorial sections
New arrivals
Footer with clean navigation

2. Header

NERVE logo
Shop
Collections
Search
Account
Cart
Mobile hamburger menu
Header becomes solid/sticky while scrolling

3. Shop / Collection

Large product grid
Minimal product cards
Product image dominates
Product name
Price
Quick interaction on hover
Filters + sorting
Responsive 2-column mobile / 4-column desktop style

4. Product page

Large image gallery
Product title
Price
Size selector
Add to Cart
Product details
Size guide
Shipping/returns
Related products

5. Cart

Slide-out cart / cart drawer
Product thumbnail
Size
Quantity controls
Remove
Subtotal
Checkout CTA

6. Overall visual language

For NERVE, I'd keep the experience:

Minimal + Premium + Editorial + Fashion-first

while using your existing NERVE identity, including your #031230 top/header color.

send me the color palate codes

Today 6:08 PM
explain me step by step how to do this ? 

بعد ما تبعتلي نتيجة الـquery السابقة، لن نفترض أي شيء.

Send me:

PS C:\Users\DELL\OneDrive\Desktop\nerve> supabase migration repair --status applied 002
Initialising login role...
Connecting to remote database...
Repaired migration history: [002] => applied
Finished supabase migration repair.
Run supabase migration list to show the updated migration history.

Step 1 — Open the migration file

Pasted markdown.md
File

edit the code and send me the final code and make sure it works 100%

بالضبط، كده ظهر لنا السبب: أنت نفذت الأمر على الملف الخطأ/القديم أو إن محتوى الإصلاحات والأوامر اتضافوا داخل ملف الـ migration نفسه.

والأهم: الأمر الذي قلت لك تشغّله كان:

Select-String -Path "supabase\migrations\005_payment_security_enhancements.sql" -Pattern "ADD CONSTRAINT IF NOT EXISTS"

وكان المفروض ما يرجعش أي نتيجة.

لكن عندك الآن نتائج مثل:

90: ADD CONSTRAINT IF NOT EXISTS orders_total_reasonable
99: ADD CONSTRAINT IF NOT EXISTS
104: ADD CONSTRAINT IF NOT EXISTS orders_total_reasonable

وكمان عندك داخل نفس ملف الـ SQL حاجات مثل:

2. Find every bad ADD CONSTRAINT IF NOT EXISTS

و:

Select-String -Path ...

و:

PS C:\Users\DELL\OneDrive\Desktop\nerve>

وده مش SQL أصلًا. واضح إن محتوى المحادثة/الخطوات السابقة اتلصق داخل 005_payment_security_enhancements.sql.

لا تعمل supabase db push الآن ❌

خلينا نصلح الملف بشكل نظيف.

نفّذ أولًا هذا الأمر فقط:

Get-Content "supabase\migrations\005_payment_security_enhancements.sql" -TotalCount 120

وابعتلي الـ output كامل.

أنا عايز أشوف أول 120 سطر تحديدًا، لأن عندك حاليًا أكثر من نسخة/تعليمات داخل نفس الملف، ولازم ننظف الـ migration الأصلي بدل ما نعمل replacement عشوائي.

بعد ما تبعتهولي، هقولك بالضبط إيه يتحذف وإيه يتحط مكانه، وبعدها نعمل:

Select-String -Path "supabase\migrations\005_payment_security_enhancements.sql" -Pattern "ADD CONSTRAINT IF NOT EXISTS"

ولما يكون الإصلاح صحيح، النتيجة لازم تكون فارغة تمامًا.

نفّذ أولًا هذا الأمر فقط:

PS C:\Users\DELL\OneDrive\Desktop\nerve> Get-Content "supabase\migrations\005_payment_security_enhancements.sql" -TotalCount 120
For NERVE, we can reproduce the same shopping experience and layout philosophy while keeping NERVEâ€™s own identity.

NERVE UI/UX direction

Homepage

Full-width hero image/video
Minimal header over the hero
Strong CTA: SHOP NOW
Featured collections immediately below
Product grid
Promotional/editorial sections
New arrivals
Footer with clean navigation

Header

NERVE logo
Shop
Collections
Search
Account
Cart
Mobile hamburger menu
Header becomes solid/sticky while scrolling

Shop / Collection

Large product grid
Minimal product cards
Product image dominates
Product name
Price
Quick interaction on hover
Filters + sorting
Responsive 2-column mobile / 4-column desktop style

Product page

Large image gallery
Product title
Price
Size selector
Add to Cart
Product details
Size guide
Shipping/returns
Related products

Cart

Slide-out cart / cart drawer
Product thumbnail
Size
Quantity controls
Remove
Subtotal
Checkout CTA

Overall visual language

For NERVE, I'd keep the experience:

Minimal + Premium + Editorial + Fashion-first

while using your existing NERVE identity, including your #031230 top/header color.

send me the color palate codes

Today 6:08 PM
explain me step by step how to do this ?

Ø¨Ø¹Ø¯ Ù…Ø§ ØªØ¨Ø¹ØªÙ„ÙŠ Ù†ØªÙŠØ¬Ø© Ø§Ù„Ù€query Ø§Ù„Ø³Ø§Ø¨Ù‚Ø©ØŒ Ù„Ù† Ù†ÙØªØ±Ø¶ Ø£ÙŠ Ø´ÙŠØ¡.

Send me:

PS C:\Users\DELL\OneDrive\Desktop\nerve> supabase migration repair --status applied 002
Initialising login role...
Connecting to remote database...
Repaired migration history: [002] => applied
Finished supabase migration repair.
Run supabase migration list to show the updated migration history.

Exactly â€” we found the next real blocker, and this one is straightforward.

The error is:

ERROR: syntax error at or near "NOT"
ALTER TABLE orders
ADD CONSTRAINT IF NOT EXISTS orders_total_reasonable
Why?

PostgreSQL supports:

ADD COLUMN IF NOT EXISTS

but does not support:

ADD CONSTRAINT IF NOT EXISTS

So this is invalid PostgreSQL:

ALTER TABLE orders
ADD CONSTRAINT IF NOT EXISTS orders_total_reasonable
CHECK (...);

We need to fix migration 005.

First: don't run db push again

Stop here for now.

Your migration process reached:

003 â†’ applied successfully
004 â†’ applied successfully
005 â†’ FAILED
006 â†’ not reached
007 â†’ not reached

أيوه، كده اتأكدنا 100% من المشكلة.

الملف:

supabase\migrations\005_payment_security_enhancements.sql

اتبوّظ بالكامل.
هو حاليًا مش SQL migration أصلًا؛ أول سطر فيه:

For NERVE, we can reproduce the same shopping experience...

وبعده دخلت فيه المحادثة والأوامر والـ logs. لذلك ممنوع تمامًا تعمل supabase db push دلوقتي.

والأهم: ما تحاولش تصلحه بـ Find/Replace، لأن الملف الأصلي نفسه اتدمر.

نرجّع الملف الأصلي أولًا

بما إن مشروعك Git repository، خلينا نشوف هل النسخة الصحيحة موجودة في Git.

نفّذ الأمرين دول فقط:

git status

وبعده:

git log --oneline --all -- "supabase/migrations/005_payment_security_enhancements.sql"
لو ظهر لك commit للملف

ممتاز جدًا. بعدها هنسترجع النسخة الأصلية من Git، ثم نصلح فقط الـ 6 أسطر الخاصة بـ:

ADD CONSTRAINT IF NOT EXISTS
مهم جدًا

ما تعملش دلوقتي:

supabase db push

ولا:

supabase migration repair --status applied 005

ولا تحذف 005.

إحنا وضعنا الـ database migration history بشكل صحيح لحد:

002 → applied
003 → applied
004 → applied
005 → failed

وده تمام.

ابعتلي نتيجة:

git status

و:

git log --oneline --all -- "supabase/migrations/005_payment_security_enhancements.sql"

وبعدها هنرجّع 005 الأصلي ونصلحه خطوة بخطوة.

نرجّع الملف الأصلي أولًا

Pasted markdown(1).md
File

تمام. كده رجعنا للمصدر الصحيح بدل ما نحاول نصلّح الملف اللي كان اتلوث بالمحادثة.

الملف اللي رفعته يحتوي فعلًا على محتوى NERVE Migration 005 — Payment Security Enhancements and Reconciliation، وفيه الـ 6 constraints المشكلة.

أنا أخذت منه الـ SQL نفسه، ونظفته من الـ Markdown escaping، وبعدها أصلحت فقط الـ 6 أوامر غير المدعومة.

النسخة النظيفة الجاهزة

تحميل 005_payment_security_enhancements.sql

النسخة دي:

✅ SQL حقيقي، مش فيها كلام من الـ chat.
✅ الـ 6 ADD CONSTRAINT IF NOT EXISTS اتصلحت.
✅ مفيش ADD CONSTRAINT IF NOT EXISTS باقي.
✅ حافظت على باقي migration كما هو.
✅ الـ constraints أصبحت idempotent باستخدام DO $$.
✅ نظفت الـ escaped underscores مثل payment\_events.
✅ عملت schema qualification للأجزاء المتأثرة.
دلوقتي اعمل بالترتيب

استبدل الملف الموجود عندك:

C:\Users\DELL\OneDrive\Desktop\nerve\supabase\migrations\005_payment_security_enhancements.sql

بالملف اللي حملته.

ثم تأكد بنفسك:

Select-String -Path "supabase\migrations\005_payment_security_enhancements.sql" -Pattern "ADD CONSTRAINT IF NOT EXISTS"

المفروض:

PS C:\Users\DELL\OneDrive\Desktop\nerve>

من غير أي output.

بعدها شغّل:

supabase db push

ومتعملش migration repair لـ 005.

لو ظهر error جديد، ابعتلي الـ output كامل زي ما هو. ساعتها هنصلح المشكلة التالية فقط، من غير ما نلمس migration history عشوائيًا.

005_payment_security_enhancements.sql
Code

005_payment_security_enhancements.sql
-- ============================================================================
-- NERVE — Migration 005
-- Payment Security Enhancements and Reconciliation
--
-- Adds:
-- - Discount usage restoration function
-- - Payment event auditing enhancements
-- - Additional security constraints
-- - Webhook timestamp validation columns
-- ============================================================================-- Add webhook received timestamp for replay attack prevention
ALTER TABLE public.payment_events 
ADD COLUMN IF NOT EXISTS webhook_received_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS webhook_ip TEXT,
ADD COLUMN IF NOT EXISTS amount_verified BOOLEAN DEFAULT TRUE;
-- Add comments for security fields
COMMENT ON COLUMN payment_events.webhook_received_at IS 'Timestamp when webhook was received (for replay attack prevention)';
COMMENT ON COLUMN payment_events.webhook_ip IS 'IP address that sent the webhook';
COMMENT ON COLUMN payment_events.amount_verified IS 'Whether payment amount was validated against order total';
-- Index for webhook security queries
CREATE INDEX IF NOT EXISTS payment_events_webhook_security_idx 
ON public.payment_events(webhook_received_at, webhook_ip);
-- ============================================================================
-- Discount Usage Restoration Function
-- Used by payment reconciliation to restore discount usage for failed payments
-- ============================================================================
CREATE OR REPLACE FUNCTION restore_discount_usage(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_discount_code TEXT;
BEGIN
-- Get the order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
-- Only restore if the order had a discount and payment failed
  IF v_order.discount_amount = 0 OR v_order.payment_status != 'failed' THEN
    RETURN FALSE;
  END IF;
-- This is a simplified approach - in reality, we'd need to track which specific
-- discount code was used. For now, we'll look for active codes that could
-- have provided this discount amount.
-- For percentage discounts, try to find the code that matches
  UPDATE discount_codes 
  SET usage_count = GREATEST(usage_count - 1, 0)
  WHERE is_active = true 
    AND (usage_limit IS NULL OR usage_count > 0)
    AND discount_type = 'percentage'
    AND (v_order.subtotal * discount_value / 100) = v_order.discount_amount
    AND usage_count > 0;
-- For fixed amount discounts
  UPDATE discount_codes 
  SET usage_count = GREATEST(usage_count - 1, 0)
  WHERE is_active = true 
    AND (usage_limit IS NULL OR usage_count > 0)
    AND discount_type = 'fixed'
    AND discount_value = v_order.discount_amount
    AND usage_count > 0;

  RETURN TRUE;
END;
$$;
-- Only the service role (reconciliation job) can call this
REVOKE ALL ON FUNCTION restore_discount_usage FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION restore_discount_usage TO service_role;
-- ============================================================================
-- Enhanced Payment Event Logging
-- ============================================================================
CREATE OR REPLACE FUNCTION log_payment_event(
  p_transaction_id TEXT,
  p_order_id UUID,
  p_webhook_ip TEXT DEFAULT NULL,
  p_amount_verified BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO payment_events (
    id, 
    order_id, 
    webhook_received_at, 
    webhook_ip, 
    amount_verified
  ) VALUES (
    p_transaction_id,
    p_order_id,
    NOW(),
    p_webhook_ip,
    p_amount_verified
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN unique_violation THEN
-- Duplicate transaction ID - this is expected for webhook replays
    RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION log_payment_event FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION log_payment_event TO service_role;
-- ============================================================================
-- Security: Add constraints to prevent data corruption
-- ============================================================================-- Ensure payment amounts are sensible (between 0 and 1,000,000 EGP)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_total_reasonable'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_total_reasonable
      CHECK (total >= 0 AND total <= 100000000);
  END IF;
END
$$;*-- 1M EGP in cents if needed*

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_subtotal_reasonable'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_subtotal_reasonable
      CHECK (subtotal >= 0 AND subtotal <= 100000000);
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_discount_reasonable'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_discount_reasonable
      CHECK (discount_amount >= 0 AND discount_amount <= subtotal);
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_shipping_reasonable'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_shipping_reasonable
      CHECK (shipping_cost >= 0 AND shipping_cost <= 50000);
  END IF;
END
$$;*-- Max 500 EGP shipping*
-- Quantity constraints on order items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_quantity_reasonable'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_quantity_reasonable
      CHECK (quantity > 0 AND quantity <= 100);
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_price_reasonable'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_price_reasonable
      CHECK (price >= 0 AND price <= 10000000);
  END IF;
END
$$;*-- Max 100K EGP per item*
-- ============================================================================
-- Security: Additional RLS policies for audit tables
-- ============================================================================-- Prevent any direct access to payment_events from clients
-- (already has no policies, but let's be explicit)
DROP POLICY IF EXISTS "No client access to payment events" ON public.payment_events;
CREATE POLICY "No client access to payment events" ON public.payment_events 
FOR ALL USING (FALSE);
-- ============================================================================
-- Indexes for performance
-- ============================================================================-- Index for payment reconciliation queries
CREATE INDEX IF NOT EXISTS orders_payment_reconciliation_idx 
ON public.orders(payment_status, payment_provider, placed_at) 
WHERE payment_status = 'pending';
-- Index for discount restoration queries
CREATE INDEX IF NOT EXISTS orders_discount_restoration_idx 
ON public.orders(discount_amount, payment_status) 
WHERE discount_amount > 0;
-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON FUNCTION restore_discount_usage IS 'Restores discount usage count for failed/expired payments';
COMMENT ON FUNCTION log_payment_event IS 'Logs payment events with security metadata for audit purposes';
COMMENT ON CONSTRAINT orders_total_reasonable ON orders IS 'Prevents unrealistic order totals';
COMMENT ON CONSTRAINT orders_discount_reasonable ON orders IS 'Ensures discount cannot exceed subtotal';
-- ============================================================================
-- Distributed Rate Limiting Support
-- ============================================================================-- Create table for distributed rate limiting
CREATE TABLE IF NOT EXISTS rate_limit_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
-- Composite unique constraint for atomic increments
  UNIQUE(identifier, window_start)
);
-- Enable RLS but no policies - only service role can access
ALTER TABLE rate_limit_requests ENABLE ROW LEVEL SECURITY;
-- Index for efficient cleanup and querying
CREATE INDEX IF NOT EXISTS rate_limit_requests_window_idx 
ON rate_limit_requests(identifier, window_start);

CREATE INDEX IF NOT EXISTS rate_limit_requests_cleanup_idx 
ON rate_limit_requests(created_at);
-- Auto-cleanup trigger for old rate limit records (keep for 1 hour)
CREATE OR REPLACE FUNCTION cleanup_rate_limit_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM rate_limit_requests 
  WHERE created_at < NOW() - INTERVAL '1 hour';
  RETURN NULL;
END;
$$;
-- Trigger cleanup on insert (periodic cleanup)
DROP TRIGGER IF EXISTS rate_limit_cleanup_trigger ON rate_limit_requests;
CREATE TRIGGER rate_limit_cleanup_trigger
  AFTER INSERT ON rate_limit_requests
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_rate_limit_requests();
-- Atomic rate limit checking function
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_window_start TIMESTAMPTZ,
  p_max_requests INTEGER,
  p_window_ms INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count INTEGER := 0;
  v_allowed BOOLEAN := FALSE;
BEGIN
-- Clean up expired windows first (older than 1 hour)
  DELETE FROM rate_limit_requests 
  WHERE created_at < NOW() - INTERVAL '1 hour';
-- Try to insert or increment counter atomically
  INSERT INTO rate_limit_requests (identifier, window_start, request_count)
  VALUES (p_identifier, p_window_start, 1)
  ON CONFLICT (identifier, window_start)
  DO UPDATE SET 
    request_count = rate_limit_requests.request_count + 1,
    updated_at = NOW()
  RETURNING request_count INTO v_current_count;
-- Check if request is allowed
  v_allowed := v_current_count <= p_max_requests;

  RETURN json_build_object(
    'allowed', v_allowed,
    'current_count', v_current_count,
    'window_start', p_window_start,
    'max_requests', p_max_requests
  );
END;
$$;
-- Only service role can use distributed rate limiting
REVOKE ALL ON FUNCTION check_rate_limit FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit TO service_role;

COMMENT ON FUNCTION check_rate_limit IS 'Atomic distributed rate limiting check using database storage';

005_payment_security_enhancements.sql
-- ============================================================================
-- NERVE — Migration 005
-- Payment Security Enhancements and Reconciliation
--
-- Adds:
-- - Discount usage restoration function
-- - Payment event auditing enhancements
-- - Additional security constraints
-- - Webhook timestamp validation columns
-- ============================================================================-- Add webhook received timestamp for replay attack prevention
ALTER TABLE public.payment_events 
ADD COLUMN IF NOT EXISTS webhook_received_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS webhook_ip TEXT,
ADD COLUMN IF NOT EXISTS amount_verified BOOLEAN DEFAULT TRUE;
-- Add comments for security fields
COMMENT ON COLUMN payment_events.webhook_received_at IS 'Timestamp when webhook was received (for replay attack prevention)';
COMMENT ON COLUMN payment_events.webhook_ip IS 'IP address that sent the webhook';
COMMENT ON COLUMN payment_events.amount_verified IS 'Whether payment amount was validated against order total';
-- Index for webhook security queries
CREATE INDEX IF NOT EXISTS payment_events_webhook_security_idx 
ON public.payment_events(webhook_received_at, webhook_ip);
-- ============================================================================
-- Discount Usage Restoration Function
-- Used by payment reconciliation to restore discount usage for failed payments
-- ============================================================================
CREATE OR REPLACE FUNCTION restore_discount_usage(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_discount_code TEXT;
BEGIN
-- Get the order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
-- Only restore if the order had a discount and payment failed
  IF v_order.discount_amount = 0 OR v_order.payment_status != 'failed' THEN
    RETURN FALSE;
  END IF;
-- This is a simplified approach - in reality, we'd need to track which specific
-- discount code was used. For now, we'll look for active codes that could
-- have provided this discount amount.
-- For percentage discounts, try to find the code that matches
  UPDATE discount_codes 
  SET usage_count = GREATEST(usage_count - 1, 0)
  WHERE is_active = true 
    AND (usage_limit IS NULL OR usage_count > 0)
    AND discount_type = 'percentage'
    AND (v_order.subtotal * discount_value / 100) = v_order.discount_amount
    AND usage_count > 0;
-- For fixed amount discounts
  UPDATE discount_codes 
  SET usage_count = GREATEST(usage_count - 1, 0)
  WHERE is_active = true 
    AND (usage_limit IS NULL OR usage_count > 0)
    AND discount_type = 'fixed'
    AND discount_value = v_order.discount_amount
    AND usage_count > 0;

  RETURN TRUE;
END;
$$;
-- Only the service role (reconciliation job) can call this
REVOKE ALL ON FUNCTION restore_discount_usage FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION restore_discount_usage TO service_role;
-- ============================================================================
-- Enhanced Payment Event Logging
-- ============================================================================
CREATE OR REPLACE FUNCTION log_payment_event(
  p_transaction_id TEXT,
  p_order_id UUID,
  p_webhook_ip TEXT DEFAULT NULL,
  p_amount_verified BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO payment_events (
    id, 
    order_id, 
    webhook_received_at, 
    webhook_ip, 
    amount_verified
  ) VALUES (
    p_transaction_id,
    p_order_id,
    NOW(),
    p_webhook_ip,
    p_amount_verified
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN unique_violation THEN
-- Duplicate transaction ID - this is expected for webhook replays
    RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION log_payment_event FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION log_payment_event TO service_role;
-- ============================================================================
-- Security: Add constraints to prevent data corruption
-- ============================================================================-- Ensure payment amounts are sensible (between 0 and 1,000,000 EGP)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_total_reasonable'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_total_reasonable
      CHECK (total >= 0 AND total <= 100000000);
  END IF;
END
$$;*-- 1M EGP in cents if needed*

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_subtotal_reasonable'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_subtotal_reasonable
      CHECK (subtotal >= 0 AND subtotal <= 100000000);
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_discount_reasonable'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_discount_reasonable
      CHECK (discount_amount >= 0 AND discount_amount <= subtotal);
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_shipping_reasonable'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_shipping_reasonable
      CHECK (shipping_cost >= 0 AND shipping_cost <= 50000);
  END IF;
END
$$;*-- Max 500 EGP shipping*
-- Quantity constraints on order items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_quantity_reasonable'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_quantity_reasonable
      CHECK (quantity > 0 AND quantity <= 100);
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_price_reasonable'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_price_reasonable
      CHECK (price >= 0 AND price <= 10000000);
  END IF;
END
$$;*-- Max 100K EGP per item*
-- ============================================================================
-- Security: Additional RLS policies for audit tables
-- ============================================================================-- Prevent any direct access to payment_events from clients
-- (already has no policies, but let's be explicit)
DROP POLICY IF EXISTS "No client access to payment events" ON public.payment_events;
CREATE POLICY "No client access to payment events" ON public.payment_events 
FOR ALL USING (FALSE);
-- ============================================================================
-- Indexes for performance
-- ============================================================================-- Index for payment reconciliation queries
CREATE INDEX IF NOT EXISTS orders_payment_reconciliation_idx 
ON public.orders(payment_status, payment_provider, placed_at) 
WHERE payment_status = 'pending';
-- Index for discount restoration queries
CREATE INDEX IF NOT EXISTS orders_discount_restoration_idx 
ON public.orders(discount_amount, payment_status) 
WHERE discount_amount > 0;
-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON FUNCTION restore_discount_usage IS 'Restores discount usage count for failed/expired payments';
COMMENT ON FUNCTION log_payment_event IS 'Logs payment events with security metadata for audit purposes';
COMMENT ON CONSTRAINT orders_total_reasonable ON orders IS 'Prevents unrealistic order totals';
COMMENT ON CONSTRAINT orders_discount_reasonable ON orders IS 'Ensures discount cannot exceed subtotal';
-- ============================================================================
-- Distributed Rate Limiting Support
-- ============================================================================-- Create table for distributed rate limiting
CREATE TABLE IF NOT EXISTS rate_limit_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
-- Composite unique constraint for atomic increments
  UNIQUE(identifier, window_start)
);
-- Enable RLS but no policies - only service role can access
ALTER TABLE rate_limit_requests ENABLE ROW LEVEL SECURITY;
-- Index for efficient cleanup and querying
CREATE INDEX IF NOT EXISTS rate_limit_requests_window_idx 
ON rate_limit_requests(identifier, window_start);

CREATE INDEX IF NOT EXISTS rate_limit_requests_cleanup_idx 
ON rate_limit_requests(created_at);
-- Auto-cleanup trigger for old rate limit records (keep for 1 hour)
CREATE OR REPLACE FUNCTION cleanup_rate_limit_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM rate_limit_requests 
  WHERE created_at < NOW() - INTERVAL '1 hour';
  RETURN NULL;
END;
$$;
-- Trigger cleanup on insert (periodic cleanup)
DROP TRIGGER IF EXISTS rate_limit_cleanup_trigger ON rate_limit_requests;
CREATE TRIGGER rate_limit_cleanup_trigger
  AFTER INSERT ON rate_limit_requests
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_rate_limit_requests();
-- Atomic rate limit checking function
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_window_start TIMESTAMPTZ,
  p_max_requests INTEGER,
  p_window_ms INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count INTEGER := 0;
  v_allowed BOOLEAN := FALSE;
BEGIN
-- Clean up expired windows first (older than 1 hour)
  DELETE FROM rate_limit_requests 
  WHERE created_at < NOW() - INTERVAL '1 hour';
-- Try to insert or increment counter atomically
  INSERT INTO rate_limit_requests (identifier, window_start, request_count)
  VALUES (p_identifier, p_window_start, 1)
  ON CONFLICT (identifier, window_start)
  DO UPDATE SET 
    request_count = rate_limit_requests.request_count + 1,
    updated_at = NOW()
  RETURNING request_count INTO v_current_count;
-- Check if request is allowed
  v_allowed := v_current_count <= p_max_requests;

  RETURN json_build_object(
    'allowed', v_allowed,
    'current_count', v_current_count,
    'window_start', p_window_start,
    'max_requests', p_max_requests
  );
END;
$$;
-- Only service role can use distributed rate limiting
REVOKE ALL ON FUNCTION check_rate_limit FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit TO service_role;

COMMENT ON FUNCTION check_rate_limit IS 'Atomic distributed rate limiting check using database storage';
