# NERVE E-Commerce Setup Guide

This guide walks you through setting up the NERVE e-commerce application from scratch, covering backend infrastructure, payments, authentication, and deployment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Setup](#supabase-setup)
3. [Image Storage Setup](#image-storage-setup)
4. [Authentication Setup](#authentication-setup)
5. [Payment Integration](#payment-integration)
6. [Environment Configuration](#environment-configuration)
7. [Local Development](#local-development)
8. [Deployment](#deployment)

---

## Prerequisites

- Node.js 18+ and npm
- A Supabase account (free tier works)
- A Paymob account for Egyptian payment processing (or Stripe for international)

---

## Supabase Setup

### 1. Create a New Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose organization, set project name to `nerve-ecommerce`
4. Set a strong database password (save this!)
5. Choose region closest to your users (e.g., Frankfurt for Egypt)
6. Wait for the project to provision (~2 minutes)

### 2. Run Database Schema

1. In your Supabase project, navigate to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `supabase/schema.sql`
4. Paste into the query editor and click **Run**
5. Verify success (should see tables created)

### 3. Seed Initial Data

1. In SQL Editor, create another new query
2. Copy contents of `supabase/seed.sql`
3. Paste and click **Run**
4. You should see a success message with counts:
   ```
   ✓ Seed data loaded successfully
     - 3 collections
     - 12 products
     - 27 product colors
     - 66 inventory records
     - 3 discount codes
   ```

### 3b. Run the Follow-up Migrations

Run these next, in order, the same way (new query in SQL Editor, paste, Run):

**`supabase/migrations/002_orders_rpc_and_extras.sql`** adds:

- `newsletter_subscribers` and `contact_messages` tables (the forms on the
  site write to these)
- The `place_order()` function — the only place orders get created. It
  locks inventory rows, re-prices from the DB, and rejects the call
  entirely if anything is out of stock.
- Storage buckets (`product-images`, `collection-images`, `avatars`) and
  their access policies.

**`supabase/migrations/003_security_notifications_and_reconciliation.sql`** adds:

- **A critical fix**: `admin_users` had Row Level Security enabled with
  zero policies defined on it. Every "is this caller an admin?" check
  elsewhere in the schema works by querying `admin_users` — with no policy
  on that table, that inner query silently returned nothing for everyone,
  meaning every admin-only capability was unreachable even for a real
  admin. This migration adds the missing policy. **If you skip this
  migration, admin login will "work" but nothing in `/admin` will function.**
- COD abuse limits (sign-in required, max 3 open unpaid COD orders per
  customer, EGP 15,000 order cap), enforced inside `place_order` itself so
  they can't be bypassed by calling the database function directly.
- A `payment_events` table for webhook idempotency, so a redelivered Paymob
  callback can't double-apply a payment or send a duplicate email.
- `back_in_stock_requests` table for the "Notify Me" flow on sold-out sizes.
- `update_order_status()` — the only way an order's status changes after
  creation; automatically releases held inventory back to stock when an
  order is cancelled/refunded.
- Closes a second privilege gap: `merge_guest_cart` (from migration 002)
  trusted whatever customer id was passed to it, so any signed-in user
  could technically have called it with someone else's id. It now always
  uses the caller's own session identity.

### 4. Get API Credentials

1. Go to **Project Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)
3. Add them to your `.env` file (see [Environment Configuration](#environment-configuration))

---

## Image Storage Setup

> If you already ran `supabase/migrations/002_orders_rpc_and_extras.sql`
> (step 3b above), the `product-images`, `collection-images`, and `avatars`
> buckets and their policies already exist — skip ahead to the
> "Folder Structure" section below. The manual steps here are for reference
> / if you'd rather do it through the dashboard instead.

### 1. Create Storage Bucket

1. In Supabase, navigate to **Storage**
2. Click "Create a new bucket"
3. Bucket name: `product-images`
4. Make it **Public** (check the public checkbox)
5. Click "Create bucket"

### 2. Set Bucket Policies

1. Click on the `product-images` bucket
2. Go to **Policies** tab
3. Click "New Policy" → "For full customization"
4. Policy name: `Public read access`
5. Use this policy definition:
   ```sql
   CREATE POLICY "Public read access"
   ON storage.objects FOR SELECT
   USING (bucket_id = 'product-images');
   ```
6. Click "Review" and "Save policy"

7. Add upload policy for authenticated users (admins):
   ```sql
   CREATE POLICY "Authenticated users can upload"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'product-images');
   ```

### 3. Folder Structure

Images should be organized as:
```
product-images/
├── products/
│   ├── {product-slug}/
│   │   ├── {color}/
│   │   │   ├── 01-front.jpg
│   │   │   ├── 02-back.jpg
│   │   │   ├── 03-detail.jpg
│   │   │   └── 04-on-model.jpg
```

Example:
```
product-images/products/nerve-core-tee/navy/01-front.jpg
product-images/products/nerve-core-tee/navy/02-back.jpg
product-images/products/nerve-core-tee/white/01-front.jpg
```

### 4. Upload Images (Manual Process Until Admin UI is Built)

Until the admin dashboard is complete, upload images manually:

1. Go to **Storage** → `product-images` bucket
2. Create folder structure: `products/{slug}/{color}/`
3. Upload images with correct naming: `01-front.jpg`, `02-back.jpg`, etc.
4. Ensure images are:
   - High quality (at least 1800×2250px for full-size)
   - Consistent aspect ratio (4:5 recommended)
   - Optimized (under 500KB per image)

**Note:** The app automatically falls back to placeholder images if real images don't exist yet.

---

## Authentication Setup

### 1. Enable Email Authentication

1. In Supabase, go to **Authentication** → **Providers**
2. **Email** should be enabled by default
3. Configure email templates:
   - Go to **Email Templates**
   - Customize the "Confirm signup" and "Reset password" templates with NERVE branding
   - Use navy (#061735) as primary color

### 2. Enable OAuth (Optional)

For Google Sign-In:
1. Go to **Authentication** → **Providers**
2. Enable **Google**
3. Follow Supabase's guide to create OAuth credentials in Google Cloud Console
4. Add credentials to Supabase

For Apple Sign-In:
1. Enable **Apple** provider
2. Configure Apple Developer credentials (requires Apple Developer account)

### 3. Configure Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Add these redirect URLs:
   - `http://localhost:5173/**` (development)
   - `https://yourdomain.com/**` (production)

### 4. Create First Admin User

After schema is set up, create an admin account:

1. Sign up through the app (or via Supabase Auth)
2. Get the user's UUID from **Authentication** → **Users** in Supabase dashboard
3. Run this SQL in **SQL Editor**:
   ```sql
   INSERT INTO admin_users (user_id, role)
   VALUES ('your-user-uuid-here', 'super_admin');
   ```

---

## Payment Integration

Card payments and Cash on Delivery are both already wired up in the app —
this section is about supplying your real Paymob credentials so card
payments go live. **None of these values go in the frontend `.env`** —
Paymob's secret key and HMAC secret must never reach the browser. They're
set as Supabase Edge Function secrets instead (step 4).

### 1. Create Paymob Account
1. Sign up at [paymob.com](https://paymob.com)
2. Complete business verification
3. Get account approved (usually 1-2 business days)

### 2. Get API Credentials
1. Log in to the Paymob dashboard
2. Go to **Settings** → **Account Info** and copy:
   - **API Key**
   - **HMAC** secret
3. Go to **Developers** → **Payment Integrations**, create/open your "Online
   Card" integration, and copy its **Integration ID**
4. Under the same integration, copy the **Iframe ID**

### 3. Set the Webhook URL

In the integration's callback settings, set the "Transaction processed"
callback to:
```
https://<your-project-ref>.supabase.co/functions/v1/paymob-webhook
```

### 4. Deploy the Edge Functions and Set Secrets

```bash
# Install the Supabase CLI if you haven't: npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>

supabase functions deploy create-order
supabase functions deploy paymob-webhook --no-verify-jwt
supabase functions deploy verify-payment
supabase functions deploy update-order-status
supabase functions deploy process-restock

supabase secrets set PAYMOB_API_KEY=your_paymob_api_key
supabase secrets set PAYMOB_INTEGRATION_ID_CARD=your_integration_id
supabase secrets set PAYMOB_IFRAME_ID=your_iframe_id
supabase secrets set PAYMOB_HMAC_SECRET=your_hmac_secret
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set RESEND_FROM_EMAIL="NERVE <orders@yourdomain.com>"
supabase secrets set STORE_URL=https://your-production-domain.com
```

`verify-payment`, `update-order-status`, and `process-restock` are
admin-only — they check the caller's JWT against `admin_users` themselves
(via `requireAdmin` in `supabase/functions/_shared/admin.ts`), so they're
deployed with the default JWT verification (no `--no-verify-jwt` flag).
Only `paymob-webhook` needs that flag, since Paymob calls it directly
without a Supabase session — its HMAC check is what authenticates the
request instead.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically —
you don't set those.

### 4b. Set Up Transactional Email (Resend)

1. Create a free account at [resend.com](https://resend.com)
2. Verify a sending domain (Resend won't send from an unverified domain —
   you can use their `onboarding@resend.dev` sender for testing before you do)
3. Create an API key and set it as shown above
4. Test: place a Cash on Delivery order and confirm the order-received email
   arrives. If `RESEND_API_KEY` isn't set, emails are silently skipped (logged
   to the function's logs) rather than blocking checkout — so the store
   still works end-to-end without email configured, you just won't get
   receipts until you add the key.

### 5. Test in Paymob's Sandbox

Use Paymob's test integration/cards before switching to live credentials.
Until you've done this, **Cash on Delivery still works end-to-end** (order
creation doesn't depend on Paymob at all), so the store isn't blocked on
payment setup.

### Adding a Second Provider (e.g. Stripe, for international cards)

`orderService.placeOrder()` and the `create-order` Edge Function are the
only places that know about Paymob specifically — add a `paymentMethod:
'stripe'` branch in `create-order/index.ts` alongside the existing Paymob
branch, following the same "create a session, return a redirect/client
secret" shape, without touching the checkout UI's structure.

---

## Environment Configuration

### 1. Copy Environment Template

```bash
cp .env.example .env
```

### 2. Fill in Values

Edit `.env` with your actual credentials:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Payment Provider (Paymob)
VITE_PAYMOB_PUBLIC_KEY=your_paymob_public_key_here
VITE_PAYMOB_IFRAME_ID=your_paymob_iframe_id_here

# Environment
VITE_ENV=development
```

### 3. Secure Your Keys

**IMPORTANT:**
- Never commit `.env` to version control (already in `.gitignore`)
- Use different keys for development vs. production
- Rotate keys if they're ever exposed

---

## CI & Secrets

This project runs CI on GitHub Actions. Add the following repository secrets in GitHub Settings → Secrets:

- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (if using the provided Vercel deploy job)
- Any production-only env vars used by Edge Functions should be added to your hosting provider's secret store (Supabase secrets for Edge Functions).

In CI the workflow expects Playwright browsers to be installable via `npx playwright install --with-deps`.


## Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

The app will open at `http://localhost:5173`

### 3. Verify Setup

Check that:
- Products load on the homepage
- You can view product details
- Collections page works
- You can add items to cart as a guest, then sign up/log in and confirm the
  guest cart merged into your account (check the `carts`/`cart_items`
  tables, or just reload and see the same items)
- Checkout completes with Cash on Delivery and creates a row in `orders`,
  and an order-received email arrives (Paymob card payments need the Edge
  Function secrets from the Payment Integration section above)
- After creating an admin user (see Authentication Setup above), `/admin`
  shows the dashboard with real numbers — **if the dashboard loads but every
  list is empty even though data exists, migration 003 likely wasn't run**
  (see the note about the `admin_users` RLS fix above)
- In `/admin/orders`, changing a status to "Shipped" sends the shipped
  email; cancelling an order that held stock releases it back to
  `product_inventory`
- On a sold-out size on a product page, "Notify Me" creates a row in
  `back_in_stock_requests`; increasing that size's stock in the admin
  Product form triggers the back-in-stock email
- `/admin/discounts` can create a code, and it applies correctly at checkout

### 4. Development Workflow

```bash
# Type check
npm run build

# Check for issues
# (No test command yet — add Vitest if needed)
```

---

## Deployment

### Deploy to Vercel (Recommended)

#### 1. Install Vercel CLI

```bash
npm install -g vercel
```

#### 2. Connect Project

```bash
vercel
```

Follow prompts to:
- Link to your Git repository
- Select framework preset: **Vite**
- Set build command: `npm run build`
- Set output directory: `dist`

#### 3. Add Environment Variables

In Vercel dashboard:
1. Go to **Project Settings** → **Environment Variables**
2. Add all variables from `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_PAYMOB_PUBLIC_KEY`
   - `VITE_PAYMOB_IFRAME_ID`
   - `VITE_ENV` (set to `production`)

#### 4. Deploy

```bash
vercel --prod
```

#### 5. Configure Custom Domain

1. In Vercel dashboard, go to **Domains**
2. Add your custom domain (e.g., `nerve-store.com`)
3. Follow DNS configuration instructions
4. SSL certificate will be provisioned automatically

### Set Up Staging Environment

1. Create a separate Supabase project for staging
2. Run schema and seed scripts on staging project
3. In Vercel, create a separate project for staging
4. Use staging environment variables
5. Deploy staging branch to staging project

---

## Next Steps

After basic setup is complete:

### Phase 1: Image Migration
- [ ] Photograph all products (professional campaign shots)
- [ ] Process images (resize, optimize, color-correct)
- [ ] Upload to Supabase Storage following folder convention
- [ ] Verify images load correctly on site

### Phase 2: Admin Dashboard
- [ ] Build admin login page (`/admin/login`)
- [ ] Create product management UI (CRUD)
- [ ] Add inventory management
- [ ] Build order fulfillment interface
- [ ] Add discount code manager

### Phase 3: Payment Webhooks
- [ ] Create Supabase Edge Function for Paymob webhooks
- [ ] Handle payment success/failure
- [ ] Update order status based on payment events
- [ ] Send order confirmation emails

### Phase 4: Customer Accounts
- [ ] Build account page (`/account`)
- [ ] Show order history
- [ ] Manage saved addresses
- [ ] Sync cart/wishlist for logged-in users

### Phase 5: Analytics & SEO
- [ ] Add Google Analytics 4
- [ ] Add Meta Pixel
- [ ] Generate dynamic meta tags
- [ ] Create sitemap.xml
- [ ] Add structured data (Product schema)

### Phase 6: Testing & Launch
- [ ] Load test with expected traffic
- [ ] Security audit
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Performance optimization (Lighthouse score > 90)
- [ ] Soft launch to limited audience
- [ ] Monitor and iterate

---

## Troubleshooting

### Images Not Loading

**Problem:** Seeing placeholder images instead of real ones

**Solution:**
1. Check Supabase Storage bucket is public
2. Verify images are uploaded with correct naming convention
3. Check browser console for 404 errors
4. Ensure `VITE_SUPABASE_URL` is set correctly

### Authentication Errors

**Problem:** Can't sign up or log in

**Solution:**
1. Check email provider is enabled in Supabase
2. Verify redirect URLs are configured
3. Check browser console for CORS errors
4. Ensure `VITE_SUPABASE_ANON_KEY` is correct

### Database Connection Issues

**Problem:** Products not loading, "Network error" messages

**Solution:**
1. Verify `VITE_SUPABASE_URL` is set correctly
2. Check Supabase project is not paused (free tier pauses after 7 days inactivity)
3. Restart dev server after changing `.env`
4. Check browser console for specific errors

### Payment Not Working

**Problem:** Payment form not submitting, errors on checkout

**Solution:**
1. Verify Paymob credentials are correct
2. Check Paymob integration is in "test mode" for development
3. Use test card numbers from Paymob docs
4. Check webhook endpoint is accessible (use ngrok for local testing)

---

## Support

For issues specific to:
- **Supabase:** [Supabase Docs](https://supabase.com/docs) or [Discord](https://discord.supabase.com)
- **Paymob:** Contact Paymob support or check [documentation](https://docs.paymob.com)
- **NERVE App:** Check GitHub issues or contact the development team

---

## Security Checklist

Before going live:

- [ ] All environment variables are set in production
- [ ] RLS policies are enabled and tested (they are, by default, in `schema.sql` + migration 002)
- [ ] `place_order()` re-checked against real concurrent-checkout load, not just single-request testing
- [ ] Payment webhooks validate signatures (`paymob-webhook` already does — confirm the HMAC field list against Paymob's current docs)
- [ ] HTTPS is enforced (Vercel does this automatically)
- [ ] Sensitive routes require authentication (`ProtectedRoute`/`AdminRoute` — client-side UX only; the real enforcement is RLS + `place_order`/Edge Functions)
- [ ] Admin panel is gated by `admin_users` table check (both in the UI guard and in every RLS policy — never trust the UI guard alone)
- [ ] Rate limiting is configured (use Vercel's built-in protection, and consider rate-limiting the Edge Functions)
- [ ] Input validation on all forms
- [ ] SQL injection prevention (Supabase client + parameterized RPC args handle this)
- [ ] XSS prevention (React handles this by default)
- [ ] CORS is configured correctly on the Edge Functions
- [ ] No API keys in client-side code (Paymob secret/HMAC live only in Edge Function secrets — verify nothing with a `VITE_` prefix holds a real secret)
- [ ] Database backups are enabled (Supabase auto-backs up daily)
- [ ] Paymob is switched from sandbox to live credentials only after a full test-mode checkout succeeds end-to-end

---

## License

Proprietary - NERVE Concept Store © 2026
