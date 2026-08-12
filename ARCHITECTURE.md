# NERVE — Architecture

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + React Router +
  Framer Motion + lucide-react. Deployed to Vercel.
- **Backend:** Supabase (Postgres + Auth + Storage) accessed directly from
  the frontend via `@supabase/supabase-js`, protected by Row Level Security
  on every table — plus two small Supabase Edge Functions for the handful
  of operations that must not run in the browser.
- **Payments:** Cash on Delivery (Egyptian market).

## Why no separate Express/Node API

A generic e-commerce brief defaults to "React frontend + Express API +
Postgres," and that's a fine architecture — but it's not what this project
already was, and it's not the simplest correct answer for a Supabase-backed
store of this size.

With Supabase, RLS policies **are** your authorization layer:
`orders.customer_id = auth.uid()`, `admin_users` membership checks, etc. are
enforced by Postgres itself on every query, regardless of which client
issues it. Standing up a parallel Express service would mean either (a)
re-implementing that authorization in Express — duplicating logic that
already exists and is already tested by Postgres — or (b) having Express
just proxy Supabase calls with no added logic, which is pure overhead: an
extra service to deploy, monitor, and keep patched, for no security or
functionality gain.

What genuinely cannot happen in the browser:
1. **Order pricing/stock validation.** The client must never be trusted for totals or "is this in stock."

Both are narrow, well-defined operations — a natural fit for **Supabase Edge
Functions** (Deno, deployed alongside the same Supabase project, with
`SUPABASE_SERVICE_ROLE_KEY` injected automatically) rather than a whole
second Node deployment on Render/Railway. If this store grows into something
that needs more custom server-side business logic later (fraud scoring,
multi-warehouse routing, ERP sync, etc.), that's the point where a dedicated
Express/Fastify service earns its keep — introducing one now, for two
functions, would just be undifferentiated infrastructure to maintain.

## Data flow: placing an order

```
Client (Checkout.tsx)
  → orderService.placeOrder()
  → supabase.functions.invoke('create-order')
      - resolves the real customer_id from the caller's JWT (or null = guest)
      - calls the `place_order` Postgres function:
          - locks the relevant product_inventory rows (FOR UPDATE)
          - re-prices every line from products.price (ignores client price)
          - validates + applies any discount code
          - rejects the whole call if anything is out of stock
          - inserts orders + order_items atomically
      - if COD: returns the confirmed order directly
  ← { order }

Nothing about price, stock, or "did payment succeed" is ever trusted from
the browser at any point in this chain.

## Cart & wishlist persistence

- **Guests:** `sessionStorage` only, scoped to `CartContext`/`WishlistContext`.
- **Signed-in customers:** mirrored to `carts`/`cart_items` and
  `wishlists`/`wishlist_items`. On login, the guest's session cart is merged
  into the DB cart exactly once (`merge_guest_cart` RPC, quantities summed
  for matching lines), then the DB is the source of truth for the session.

## Deployment

- **Frontend:** Vercel (`vercel --prod`), env vars = the `VITE_*` values only.
- **Database + Auth + Storage:** Supabase project (migrations run via SQL
  Editor or `supabase db push`).
- **Edge Functions:** `supabase functions deploy create-order`,
  `verify-payment`, `update-order-status`, and `process-restock` (default
  JWT verification), plus `paymob-webhook --no-verify-jwt` (Paymob calls
  this directly; its HMAC check authenticates the request instead). Secrets
  set via `supabase secrets set` — see `SETUP.md`.
- No separate backend host (Render/Railway) is needed with this architecture.

## Guest Order Tracking System

When a guest completes checkout without an account, they can track their order
using email + order number verification.

### Data Flow

```
Guest Checkout → place_order() creates order + guest_orders entry
  → confirmation email sent with verification URL
  → guest visits /guest-order?token=X&email=Y&orderNumber=Z
  → guestOrderService.lookup() validates and displays order
```

### URL Structure

```
https://your-site.com/guest-order?token=VERIFICATION_TOKEN&email=USER_EMAIL&orderNumber=ORDER_NUM
```

### RLS Policy

```sql
CREATE POLICY "Public can view guest order by email/token" ON guest_orders
  USING (verification_token = auth.jwt() ->> 'verify_token')
```

---

## Product Reviews System

Customers can submit reviews after receiving their products. Admins can
verify purchases to mark reviews as "verified."

### Data Flow

```
Customer writes review → POST /reviews
  → reviewService.create() validates and inserts
  → review visible with unverified status
  → Admin calls verify_review_purchase() RPC
  → review marked as "verified" + badge displayed
```

### Database Schema

```sql
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

CREATE VIEW product_review_stats AS
SELECT 
  p.id AS product_id,
  COUNT(r.id) AS review_count,
  COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0) AS average_rating
FROM products p
LEFT JOIN product_reviews r ON p.id = r.product_id
GROUP BY p.id;
```

### API Methods

```typescript
// Get reviews for a product
reviewService.getByProduct(productId)

// Get review statistics
reviewService.getStats(productId)

// Submit a review
reviewService.create({ productId, rating, title, comment })

// Verify purchase (admin only)
reviewService.verifyPurchase(reviewId)
```

---

## Google Analytics 4 Integration

Full GA4 tracking with typed event helpers for e-commerce.

### Setup

Add `VITE_GA_ID` to your environment variables.

### Usage

```typescript
import { ecommerce } from './lib/ga4'

// Product view
ecommerce.viewItem('p-001', 'White T-Shirt', 'T-Shirts', 499)

// Add to cart
ecommerce.addToCart('p-001', 'White T-Shirt', 'T-Shirts', 499, 2)

// Begin checkout
ecommerce.beginCheckout(1497)

// Purchase
ecommerce.purchase('NRV-123456', 1497, 'NERVE10', 0, 0)
```

### Automatic Tracking

- Page views tracked on route changes
- Performance metrics (LCP, FID, CLS) collected
- User engagement time tracked

---

## Stack Extensions

### New Frontend Libraries

| Feature | Library | Purpose |
|---------|---------|---------|
| GA4 Analytics | Custom (`lib/ga4.ts`) | Google Analytics 4 event tracking |
| Guest Orders | Custom (`services/guestOrderService.ts`) | Order lookup without account |
| Product Reviews | Custom (`services/reviewService.ts`) | Review submission and display |

### New Database Tables

| Table | Purpose | RLS |
|-------|---------|-----|
| `guest_orders` | Guest checkout tracking | Email + token lookup |
| `product_reviews` | Customer product reviews | Authenticated CRUD |
| `product_review_stats` | Review aggregates (view) | Public read |

---

## Deployment

- **Frontend:** Vercel (`vercel --prod`), env vars = the `VITE_*` values only.
- **Database + Auth + Storage:** Supabase project (migrations run via SQL
  Editor or `supabase db push`).
- **Edge Functions:** `supabase functions deploy create-order`,
  `verify-payment`, `update-order-status`, and `process-restock` (default
  JWT verification), plus `paymob-webhook --no-verify-jwt` (Paymob calls
  this directly; its HMAC check authenticates the request instead). Secrets
  set via `supabase secrets set` — see `SETUP.md`.
- No separate backend host (Render/Railway) is needed with this architecture.

---

## Data Migration

Run migration `006_guest_tracking_and_reviews.sql` to add new tables:

```bash
# Via Supabase CLI
supabase db push

# Or run in Supabase SQL Editor
# Paste contents of supabase/migrations/006_guest_tracking_and_reviews.sql
```

Migration includes:
- `guest_orders` table with verification tokens
- `product_reviews` table with verified status
- `product_review_stats` view for review aggregates
- RLS policies for secure access
- `verify_review_purchase()` RPC for admin verification

---

## Security Considerations

### Guest Order Access
- Verification token expires after order completion
- Token embedded in confirmation email URL
- Email + order number + token required for lookup

### Product Reviews
- Authenticated users only (via Supabase Auth)
- One review per product per user
- Admin verification required for "verified purchase" badge
- SQL injection prevented by Supabase RLS and parameterized queries

### GA4 Integration
- No PII sent to GA4 by default
- User ID only set after authentication
- Analytics ID exposed in browser (intentional for GA4)


