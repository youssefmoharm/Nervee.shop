# NERVE — Pre-Launch Testing & Verification Plan

This document provides a systematic checklist for testing all critical functionality before launch. Work through this **after** completing the deployment steps in SETUP.md.

---

## 🎯 Testing Philosophy

**DO NOT skip to production without completing these tests.** The architecture is solid, but untested code is broken code. Every check below has caught real bugs in production systems before.

---

## 1. Database Migration Verification

### ✅ Schema Integrity Check

Run these queries in your Supabase SQL Editor to verify all migrations applied correctly:

```sql
-- Verify all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected tables:
-- addresses, admin_users, back_in_stock_requests, cart_items, carts,
-- collections, contact_messages, customers, discount_codes, newsletter_subscribers,
-- order_items, orders, payment_events, product_colors, product_inventory, products,
-- wishlist_items, wishlists
```

```sql
-- Verify critical functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Expected functions:
-- merge_guest_cart, place_order, update_order_status
```

```sql
-- Verify storage buckets exist
SELECT name, public 
FROM storage.buckets 
ORDER BY name;

-- Expected buckets:
-- avatars (public), collection-images (public), product-images (public)
```

### ✅ RLS Policy Verification

**Critical**: Test that RLS is actually blocking unauthorized access:

```sql
-- This should return TRUE for all critical tables
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = true
ORDER BY tablename;

-- Every table should have rowsecurity = TRUE
```

```sql
-- Verify admin_users has the SELECT policy (migration 003)
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'admin_users';

-- Should see: "Admins can view their own record and service role can view all"
-- If NO policies show up, migration 003 didn't run — admin features won't work
```

---

## 2. Authentication & Authorization Testing

### Test Case 2.1: Guest User Flow

**Objective**: Verify guests can browse and add to cart without authentication.

Steps:
1. Open site in **incognito window**
2. Browse products ✓
3. Add 2-3 items to cart ✓
4. Verify cart persists on page refresh ✓
5. Close tab, reopen in new incognito → cart should be EMPTY (session storage cleared) ✓

**Expected**: No authentication required for browsing/cart.

---

### Test Case 2.2: User Registration

**Objective**: Verify new users can sign up and receive confirmation.

Steps:
1. Navigate to `/register`
2. Sign up with new email (use `+` trick: `yourname+test1@gmail.com`)
3. Check email for confirmation link
4. Click confirmation link
5. Verify redirect to home/account page

**Database Check**:
```sql
-- Should see new row in customers table
SELECT id, email, first_name, last_name, created_at
FROM customers
ORDER BY created_at DESC
LIMIT 5;
```

**Expected**: User created, email confirmed, auto-created `customers` row.

---

### Test Case 2.3: Cart Merge on Login

**Objective**: Verify guest cart merges into user cart on login.

Steps:
1. **As guest**: Add Product A (1x, Navy, M) to cart
2. **Log in** with existing account that has Product B (1x, White, L) in cart
3. After login, cart should contain BOTH items:
   - Product A: 1x Navy M
   - Product B: 1x White L

**Database Check**:
```sql
-- Replace with your user_id
SELECT ci.product_id, ci.color, ci.size, ci.quantity
FROM cart_items ci
JOIN carts c ON ci.cart_id = c.id
WHERE c.customer_id = 'YOUR_USER_ID';
```

**Expected**: Both items present, quantities summed if duplicate.

---

### Test Case 2.4: Admin Access Control

**Objective**: Verify only real admins can access admin features.

**Test 2.4a: Non-Admin Blocked**
1. Log in as regular user (NOT in `admin_users` table)
2. Navigate to `/admin`
3. Should redirect to home or show "Access Denied"

**Test 2.4b: Admin Granted**
1. Create admin user:
   ```sql
   -- Replace with actual user_id from Authentication > Users
   INSERT INTO admin_users (user_id, role)
   VALUES ('YOUR_USER_UUID', 'super_admin')
   ON CONFLICT (user_id) DO NOTHING;
   ```
2. Log in with that user
3. Navigate to `/admin`
4. Should see dashboard with stats

**Test 2.4c: Dashboard Data Loads**
5. Verify dashboard shows:
   - Total revenue (number)
   - Orders count
   - Customers count
   - Low stock products

**Expected**: Regular users blocked, admins see full dashboard.

---

## 3. Order Placement & Payment Flow Testing

### Test Case 3.1: COD Order (End-to-End)

**Objective**: Verify complete COD order flow from checkout to confirmation.

**Setup**:
1. Log in as regular user
2. Add 2 products to cart (different products, different sizes)

**Steps**:
1. Navigate to `/checkout`
2. Fill in shipping details:
   - Use real Egyptian governorate from dropdown
   - Valid phone format
3. Select "Cash on Delivery"
4. Click "Place Order"

**Expected Results**:
- ✓ Order created in database
- ✓ Order confirmation email received
- ✓ Inventory decremented
- ✓ Cart cleared
- ✓ Redirect to order confirmation page

**Database Checks**:
```sql
-- Verify order created
SELECT id, order_number, total, status, payment_method, payment_status
FROM orders
ORDER BY created_at DESC
LIMIT 1;

-- Verify order items
SELECT oi.product_id, oi.color, oi.size, oi.quantity, oi.price_at_time
FROM order_items oi
WHERE oi.order_id = 'ORDER_ID_FROM_ABOVE';

-- Verify inventory decremented
SELECT product_id, size, stock_quantity, in_stock
FROM product_inventory
WHERE product_id IN (SELECT product_id FROM order_items WHERE order_id = 'ORDER_ID');
```

**Email Verification**:
- Check inbox for "Order Confirmed" email
- Verify order number matches
- Verify items listed correctly

---

### Test Case 3.2: COD Abuse Limits

**Objective**: Verify COD limits prevent abuse.

**Test 3.2a: Guest COD Blocked**
1. Log out
2. Add item to cart
3. Go to checkout, select COD
4. Should see error: "Cash on Delivery requires an account"

**Test 3.2b: Multiple Open COD Orders**
1. Place 1st COD order → should succeed
2. Place 2nd COD order → should succeed
3. Place 3rd COD order → should succeed
4. Place 4th COD order → should FAIL with "maximum 3 open COD orders"

**Test 3.2c: High-Value COD Blocked**
1. Add items totaling > EGP 15,000 to cart
2. Select COD at checkout
3. Should FAIL with "exceeds EGP 15,000 limit"

**Expected**: All limits enforced server-side.

---

### Test Case 3.3: COD Full Checkout Flow

**Objective**: Verify the end-to-end Cash on Delivery checkout.

**Prerequisites**:
- Edge functions deployed
- Resend key set (optional — without it the email step is skipped)

**Steps**:
1. Add items to cart
2. Go to checkout, select "Cash on Delivery" (the only payment option)
3. Fill shipping details
4. Click "Place Order"

**Expected Results**:
- ✓ Order created with `payment_method = 'cod'`
- ✓ Order confirmation email sent
- ✓ No payment provider is contacted (nothing to redirect to)

**Database Checks**:
```sql
-- Verify order created with COD payment
SELECT id, status, payment_method, total_amount
FROM orders
ORDER BY created_at DESC
LIMIT 1;
```

**Edge Function Logs**:
```bash
# In Supabase dashboard: Edge Functions > Logs
# Check create-order logs for a successful order placement
```

---

### Test Case 3.4: Out of Stock Handling

**Objective**: Verify orders fail gracefully when items are unavailable.

**Setup**:
1. In admin panel, set a product size to 0 stock
2. Add that exact variant to cart as customer

**Steps**:
1. Proceed to checkout
2. Attempt to place order

**Expected**:
- Order rejected with clear error message
- NO order created in database
- Cart NOT cleared
- Customer can remove/change the unavailable item

**Database Check**:
```sql
-- Should NOT see a new order for this attempt
SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '5 minutes';
```

---

### Test Case 3.5: Concurrent Order Race Condition

**Objective**: Verify `place_order()` correctly handles concurrent checkouts for last units.

**Setup**:
1. Set a product variant to stock_quantity = 1
2. Open checkout in TWO browser windows (different sessions/users)
3. Both users add that same last unit to cart

**Steps**:
1. Window 1: Complete checkout (click submit)
2. Window 2: Immediately after, complete checkout

**Expected**:
- ✓ First order succeeds
- ✓ Second order FAILS with "out of stock" error
- ✓ Only ONE order created
- ✓ Stock = 0 after first order

**This tests the `FOR UPDATE` row locking in `place_order()`.**

---

### Test Case 3.6: Discount Code Validation

**Objective**: Verify discount codes apply and validate correctly.

**Setup**:
```sql
-- Verify test discount codes exist from seed.sql
SELECT code, discount_type, discount_value, min_purchase, active, expires_at
FROM discount_codes
WHERE code IN ('NERVE10', 'SUMMER50', 'FREESHIP');
```

**Test 3.6a: Valid Code**
1. Cart total: EGP 500
2. Apply code `NERVE10` (10% off)
3. Verify discount: EGP 50
4. Final total: EGP 450 + shipping

**Test 3.6b: Minimum Purchase Not Met**
1. Cart total: EGP 200
2. Apply code `SUMMER50` (min purchase EGP 500)
3. Should see error: "Minimum purchase not met"

**Test 3.6c: Expired Code**
```sql
-- Create expired code
INSERT INTO discount_codes (code, discount_type, discount_value, expires_at, active)
VALUES ('EXPIRED', 'percentage', 20, NOW() - INTERVAL '1 day', true);
```
4. Try to apply `EXPIRED` → should fail

**Test 3.6d: Server-Side Validation**
5. Apply valid code in UI
6. Inspect network request to `create-order` function
7. Verify discount is RE-VALIDATED server-side (not trusted from client)

---

## 4. Admin Panel Testing

### Test Case 4.1: Product CRUD Operations

**Test 4.1a: Create Product**
1. Log in as admin
2. Navigate to `/admin/products`
3. Click "Add Product"
4. Fill all fields:
   - Name, slug, category, collection
   - Price, description, material, care instructions
   - Add 2+ colors (name, hex, image URL)
   - Set inventory for each size
5. Save

**Database Check**:
```sql
SELECT id, name, slug, price FROM products ORDER BY created_at DESC LIMIT 1;
SELECT name, hex FROM product_colors WHERE product_id = 'NEW_PRODUCT_ID';
SELECT size, stock_quantity FROM product_inventory WHERE product_id = 'NEW_PRODUCT_ID';
```

**Test 4.1b: Edit Product**
6. Edit the product, change price
7. Save
8. Verify change reflected on storefront

**Test 4.1c: Delete Product**
9. Delete the product
10. Verify removed from storefront
11. Verify still exists in database (soft delete?) or actually deleted

---

### Test Case 4.2: Order Management

**Test 4.2a: View Orders**
1. Navigate to `/admin/orders`
2. Should see list of all orders
3. Filter by status
4. Search by order number or customer email

**Test 4.2b: Update Order Status**
1. Click on a `pending` order
2. Change status to "Processing"
3. Save
4. Verify customer receives email (if applicable)

**Test 4.2c: Cancel Order & Stock Release**
1. Create a test order (use COD)
2. Note the inventory levels:
   ```sql
   SELECT size, stock_quantity FROM product_inventory WHERE product_id = 'PRODUCT_ID';
   ```
3. In admin, change order status to "Cancelled"
4. **Critical**: Re-check inventory → should have INCREASED back
   ```sql
   -- Stock should be restored
   SELECT size, stock_quantity FROM product_inventory WHERE product_id = 'PRODUCT_ID';
   ```

**This tests `update_order_status()` automatic stock release.**

---

### Test Case 4.3: COD Payment Lifecycle

**Objective**: Verify Cash on Delivery payment handling.

**Setup**:
1. A COD order is placed (payment status `pending` — payment is collected
   at the door, so no provider transaction exists to reconcile)

**Steps**:
1. In `/admin/orders`, find the COD order
2. Advance it to `delivered` via the status dropdown
3. `update_order_status` should:
   - Lock the transition and release any held inventory on cancel/refund
   - Send the customer the order-delivered email

**Expected**:
- Status updated to `delivered`
- Payment status stays `pending` until confirmed separately (COD is
  collected by the courier — there is no payment provider to query)
- Delivered email sent; nothing is double-applied (idempotent by design)

---

### Test Case 4.4: Discount Code Management

**Test 4.4a: Create Code**
1. Navigate to `/admin/discounts`
2. Click "Create Code"
3. Set:
   - Code: `TEST20`
   - Type: Percentage
   - Value: 20
   - Min purchase: 300
   - Expiry: 7 days from now
4. Save

**Test 4.4b: Test Code**
5. As customer, go to checkout with EGP 400 cart
6. Apply `TEST20`
7. Verify 20% discount applied

**Test 4.4c: Deactivate Code**
8. In admin, deactivate `TEST20`
9. Try to use as customer → should fail

---

### Test Case 4.5: Back-in-Stock Notifications

**Test 4.5a: Request Notification**
1. As customer, find a sold-out product size
2. Click "Notify Me"
3. Enter email, submit

**Database Check**:
```sql
SELECT email, product_id, size, notified_at
FROM back_in_stock_requests
ORDER BY requested_at DESC
LIMIT 1;
```

**Test 4.5b: Trigger Notification**
4. As admin, edit that product
5. Set the sold-out size to in_stock = true, stock_quantity > 0
6. Save product

**Expected**:
- ✓ Email sent to all waiting customers for that size
- ✓ `notified_at` timestamp updated
- ✓ Edge function `process-restock` logs success

---

## 5. Email Delivery Testing

### Test Case 5.1: Order Confirmation (COD)

**Trigger**: Place COD order
**Expected Email**:
- Subject: "Order Confirmed - #[ORDER_NUMBER]"
- Contains: order items, total, shipping address
- Sender: `NERVE <orders@yourdomain.com>`

---

### Test Case 5.2: Order Confirmation Timing (COD)

**Trigger**: Place COD order
**Expected Email**:
- Sent once at order creation (COD is the only payment method)
- Sender: `NERVE <orders@yourdomain.com>`

---

### Test Case 5.3: Status Update Emails

**Trigger**: Change order status in admin
**Expected Emails**:
- Shipped: "Your order is on the way"
- Delivered: "Your order has been delivered"
- Cancelled: "Your order has been cancelled"
- Refunded: "Your refund has been processed"

**Test**: Update a single order through all statuses, verify each email.

---

### Test Case 5.4: Back-in-Stock Email

**Trigger**: Restock a previously sold-out size
**Expected Email**:
- Subject: "[PRODUCT NAME] is back in stock!"
- Contains: Product image, link to product page
- Only to customers who requested that specific size

---

## 6. Security Testing

### Test Case 6.1: RLS Enforcement

**Test 6.1a: Customer Data Isolation**
1. Create User A, add address
2. Log in as User B
3. Try to query User A's address via browser console:
   ```javascript
   await supabase.from('addresses').select('*').eq('customer_id', 'USER_A_ID')
   ```
4. Should return EMPTY (RLS blocks)

**Test 6.1b: Order Isolation**
5. User B should NOT be able to view User A's orders

---

### Test Case 6.2: Privilege Escalation Attempts

**Test 6.2a: Non-Admin Calling Admin Functions**
1. Log in as regular user
2. In browser console, try:
   ```javascript
   await supabase.functions.invoke('update-order-status', {
     body: { orderId: 'SOME_ORDER', newStatus: 'cancelled' }
   })
   ```
3. Should FAIL with 403/401 (function checks `admin_users`)

**Test 6.2b: Direct Database Function Calls**
```sql
-- Log in as regular user, try to call place_order directly
-- (This shouldn't be possible via Supabase client, but verify)
SELECT place_order(...);
```
4. Should fail (function expects to be called by service role via edge function)

---

### Test Case 6.3: Admin Function Auth

**Objective**: Verify admin-only functions reject unauthorized callers.

**Setup**: Use a tool like Postman or curl

**Test 6.3a: Authenticated Admin Call**
1. Generate a valid admin JWT (sign in as an admin user)
2. Send a valid `update-order-status` request with an admin token
3. Should succeed

**Test 6.3b: Tampered / Unauthorized Call**
4. Call without a token or with a non-admin token
5. Send to the function URL
6. Should REJECT with "Admin access required" (403)
7. Order should NOT be updated

**This is critical for order-integrity security.**

---

## 7. Performance & Load Testing

### Test Case 7.1: Concurrent Order Load

**Objective**: Verify system handles realistic concurrent traffic.

**Tool**: Use [Artillery](https://www.artillery.io/) or [k6](https://k6.io/)

**Scenario**:
- 50 concurrent users
- Each places 1 order
- Over 30 seconds

**Artillery Config** (`load-test.yml`):
```yaml
config:
  target: "https://your-project.supabase.co"
  phases:
    - duration: 30
      arrivalRate: 10
      name: "Ramp up orders"
  
scenarios:
  - name: "Place Order"
    flow:
      - post:
          url: "/functions/v1/create-order"
          headers:
            Authorization: "Bearer YOUR_ANON_KEY"
            apikey: "YOUR_ANON_KEY"
          json:
            email: "test{{ $randomNumber() }}@example.com"
            firstName: "Load"
            lastName: "Test"
            phone: "01234567890"
            address: "Test Address"
            city: "Cairo"
            governorate: "Cairo"
            deliveryMethod: "standard"
            paymentMethod: "cod"
            items:
              - productId: "PRODUCT_ID"
                color: "Navy"
                size: "M"
                quantity: 1
```

**Run**:
```bash
npm install -g artillery
artillery run load-test.yml
```

**Expected**:
- No errors
- All orders created successfully
- Response times < 3 seconds (p95)
- No database deadlocks

**If failures occur**: Check for lock contention in `place_order()`.

---

### Test Case 7.2: Database Query Performance

**Verify indexes exist**:
```sql
-- Check indexes on frequently queried columns
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

**Expected indexes**:
- `orders.customer_id`
- `order_items.order_id`
- `product_inventory.product_id`
- `carts.customer_id`
- `wishlists.customer_id`

**Add if missing**:
```sql
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_product_inventory_product_id ON product_inventory(product_id);
```

---

## 8. Edge Cases & Error Handling

### Test Case 8.1: Network Failures

**Test 8.1a: Failed Edge Function Call**
1. Cancel the power/network right before the frontend invokes
   `create-order`
2. Order is not created; the checkout stays on the form
3. Retrying re-attempts creation — no phantom order

**Test 8.1b: Duplicate Submission**
4. Double-click "Place Order" at checkout
5. Should create one order, not two (function validates and the order
   number/id is unique)

---

### Test Case 8.2: Invalid Input Handling

**Test 8.2a: Malformed Email**
- Try to register with `notanemail`
- Should fail with validation error

**Test 8.2b: SQL Injection Attempt**
- Enter `'; DROP TABLE products; --` in product search
- Should be safely handled (parameterized queries)

**Test 8.2c: XSS Attempt**
- Enter `<script>alert('xss')</script>` in product name (admin)
- Should be escaped in output (React handles this)

---

## 9. Mobile & Browser Compatibility

### Test Case 9.1: Mobile Responsive Design

**Test on**:
- iPhone (Safari)
- Android (Chrome)
- Tablet (iPad)

**Verify**:
- Navigation menu works
- Product images load and display correctly
- Cart drawer slides in smoothly
- Checkout form is usable
- Payment iframe renders correctly

---

### Test Case 9.2: Browser Compatibility

**Test on**:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

**Verify**:
- All features work
- No console errors
- CSS renders correctly

---

## 10. Pre-Launch Final Checklist

Before flipping the switch to production:

### Environment Configuration
- [ ] All production environment variables set in Vercel
- [ ] Resend verified sending domain configured
- [ ] All Edge Function secrets set (`supabase secrets list` to verify)
- [ ] Supabase project on appropriate tier (not paused free tier)

### Database
- [ ] All migrations run successfully (`supabase db push --include-all`)
- [ ] At least one admin user created in `admin_users`
- [ ] Seed data loaded (or real products added)
- [ ] RLS enabled on all tables (query from section 1)
- [ ] Performance indexes created (section 7.2)

### Payment Setup
- [ ] COD checkout tested end-to-end (guest + signed-in)
- [ ] COD limits tested and working (15k cap, 3 open orders, sign-in required)

### Email Setup
- [ ] Resend domain verified
- [ ] All 7 email types tested (order confirmed, shipped, delivered, cancelled, refunded, back-in-stock, password reset)
- [ ] Email sender address matches your domain

### Security
- [ ] All RLS policies tested (section 6.1)
- [ ] Admin privilege escalation attempts blocked (section 6.2)
- [ ] HTTPS enforced (Vercel does this automatically)
- [ ] No secrets in client-side code (verify no `VITE_` vars contain secrets)
- [ ] CORS configured on Edge Functions

### Performance
- [ ] Load test passed (section 7.1)
- [ ] Lighthouse score > 90 (run on Vercel preview)
- [ ] Images optimized and loading fast

### Monitoring & Alerts
- [ ] Error tracking set up (Sentry or similar)
- [ ] Supabase alerts configured (database CPU, storage)
- [ ] Uptime monitoring (UptimeRobot or Vercel's)
- [ ] Order-failure alerts (check Edge Function logs daily initially)

### Legal & Compliance
- [ ] Privacy Policy published and linked in footer
- [ ] Terms of Service published and linked
- [ ] Cookie consent (if tracking cookies used)

### Backup & Recovery
- [ ] Database backup strategy confirmed (Supabase does daily backups)
- [ ] Know how to restore from backup
- [ ] Documented rollback procedure for Vercel deployment

---

## 11. Post-Launch Monitoring (First 48 Hours)

After going live, monitor these closely:

### Hour 1-24:
- [ ] Check Edge Function logs every 2 hours
- [ ] Monitor order creation rate
- [ ] Verify webhooks arriving and processing
- [ ] Check for any failed payments
- [ ] Monitor customer support channels for bugs

### Hour 24-48:
- [ ] Review all error logs
- [ ] Check email delivery rates
- [ ] Verify no inventory issues (oversold items)
- [ ] Monitor database performance metrics
- [ ] Review customer feedback

### Week 1:
- [ ] Analyze conversion funnel (where are dropoffs?)
- [ ] Review failed order attempts and reasons
- [ ] Optimize slow queries if any
- [ ] Address any UX friction points reported

---

## 12. Known Limitations (Documented, Not Bugs)

These are acceptable trade-offs for v1, but document them:

1. **Admin product images**: URL paste only, no drag-and-drop upload yet
2. **Order tracking**: No public order lookup by order number + email (customers must log in)
3. **Inventory forecasting**: No low-stock prediction, just current count
4. **Analytics**: No built-in GA4/Meta Pixel yet (Phase 5)
5. **Returns**: Policy documented, but no self-service return flow
6. **Wishlist**: No wishlist sharing or public lists

---

## 🚨 Show-Stopper Bugs (DO NOT LAUNCH if these fail)

These tests MUST pass, no exceptions:

1. ✅ COD order completes and creates order in database
2. ✅ Order confirmation email is sent on placement
3. ✅ Out-of-stock orders are rejected
4. ✅ Concurrent orders don't oversell inventory
5. ✅ Admin panel loads and shows data (tests migration 003)
6. ✅ Cancelling order releases inventory
7. ✅ RLS blocks users from accessing others' data
8. ✅ Admin-only Edge Functions reject unauthorized callers

If ANY of these fail, stop and fix before proceeding.

---

## Support & Resources

- **Supabase Logs**: Project > Logs > Function Logs
- **Vercel Logs**: Project > Deployments > Logs
- **Resend Dashboard**: Emails > Logs
- **Supabase Database**: Project > SQL Editor (inspect orders/stock directly)

---

## Next Steps

After completing this testing plan:

1. Document any bugs found in GitHub Issues
2. Fix critical bugs before launch
3. Create a runbook for common operations (how to add product, how to process return, etc.)
4. Train your team on the admin panel
5. Set up a staging environment for future testing

**Remember**: Testing is not a one-time event. As you add features, repeat relevant tests.

---

*Last Updated: 2026-08-01*
*Version: 1.0*
