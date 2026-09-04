# NERVE E-Commerce — Gap Analysis

## What's actually solid (so this report is honest, not just a hit-list)

- Real product catalog page with category/color/size/price filters, sort, grid/list view, and URL-synced search params.
- Real PDP with color swatches, size picker, inventory-aware add-to-cart, stock alerts, reviews (CRUD + verify-purchase RPC), related products, OG/Twitter + Product schema.
- Real multi-step checkout wiring `orderService.placeOrder` to the `create-order` edge function (COD), discount code UI, shipping calc.
- Guest orders with email+order-number lookup, verification token, and an `/guest-order` route.
- Real account area: orders list, order detail with items, address book, wishlist — all backed by real Supabase RLS.
- Real admin dashboard with products (full form over colors/inventory/collections), orders (status changes via edge function), customers, customer detail, contacts, newsletter, + discount CRUD.
- Real cart persistence: guest sessionStorage + signed-in DB mirror with `merge_guest_cart`.
- Real cross-cutting: Supabase Auth, AdminRoute + ProtectedRoute guards, Analytics (GA4 + Meta Pixel), Core Web Vitals, sourcemaps, error boundaries, Sentry hook (config off until DSN set), SEO helpers, sitemap.xml, robots.txt, favicon.
- Real infra: 11 migrations, idempotent seed, 12 edge functions, RLS on all tables, distributed rate limiting, security regression tests + e2e.
- CI: vitest, playwright e2e, eslint, prettier, husky, `npm run ci`.

So this is a legitimately far-along v1 storefront, not a scaffold. The gaps below are mostly **operational, payment-lifecycle, and edge-case hardening** — not obvious missing views.

---

## 1. Payments & order lifecycle (highest impact)

### 1.1 No online payment method — COD is the only path
- `place_order()` hard-fails anything that isn't `payment_provider = 'cod'` (migration 003 line 124). The schema has `payment_provider TEXT` and `payment_status TEXT` but there's **no provider integration at all**. Stripe is in the README's "next steps" language, not in the repo.
- **Severity:** important (limits revenue to Egyptian COD, which is fine for launch in Egypt but caps scale and refund handling).
- **Files:** `supabase/migrations/003_security_notifications_and_reconciliation.sql:124`, `supabase/functions/create-order/index.ts:138`, `src/lib/checkout.ts`.
- **What's missing:** COD-only payment flow (Stripe/Paymob/Fawry integration is not planned). The system is designed to only accept Cash on Delivery.

### 1.2 No order cancellation / return / refund flow for customers
- Admins can flip status (placed→processing→shipped→delivered), but there's **no customer-facing cancel/return/refund** path. Migration 003 has `cancel_order` and `start_return` functions, but no UI or flow to invoke them. GuestOrder only lets a guest *look up* their order, not cancel it.
- **Severity:** important (returns are a top driver of customer support load; not having this means every request goes to chat/contact).
- **Files:** `supabase/functions/update-order-status/index.ts`, `src/pages/GuestOrder.tsx`, `src/pages/Account/OrderDetail.tsx`, migration 003 `cancel_order`/`start_return` functions.
- **What's missing:** order detail "Cancel order" / "Start return" actions (for eligible statuses), return reason capture, return tracking, refund status, and the guest-order equivalent.

### 1.3 Refund logic is not (yet) wired
- Migration 003 has email reconciliation jobs and a `refunded` status, but there's no payout reversal or partial refund story yet; `place_order` doesn't know about refunds.
- **Severity:** nice-to-have for COD-only, critical once online payments exist.
- **Files:** `supabase/migrations/003_security_notifications_and_reconciliation.sql`, `supabase/functions/update-order-status`.

### 1.4 Checkout discount UI only honors a hardcoded promo code
- `Cart.tsx` and `Checkout.tsx` apply `NERVE10` / `FREESHIP`-style logic client-side, but there's no **server-side discount validation** in the checkout path (the `create-order` function does validate discount codes server-side — good — but the client-side "applied" state is optimistic and not synced). The cart's promo apply is a demo shortcut.
- **Severity:** nice-to-have / polish.
- **Files:** `src/pages/Cart.tsx:26-34`, `src/pages/Checkout.tsx`.

---

## 2. Search & discovery (important for conversion)

### 2.1 No full-text search on the actual `/shop` page
- `Shop.tsx` does client-side `filterProducts` (name/category/description/material substring). There's a full-text `products_search_idx` in Postgres (`to_tsvector('english', name || ' ' || description || ' ' || category)`) and the `productService.search` uses it, but `/shop` doesn't route to it. So search is substring, not relevance-ranked, and doesn't use Postgres GIN.
- **Severity:** important for a catalog store.
- **Files:** `supabase/migrations/001_schema.sql:55-57`, `src/services/productService.ts` (`search`), `src/pages/Shop.tsx`.
- **What's missing:** wire `productService.search` into the `/shop` search input and filter bar, with debounce, and ideally separate "search results" state.

### 2.2 No URL-preserving filters in the cart/checkout/after-search state
- The `/shop` page keeps filters in `useSearchParams` (good), but the cart page's "recommended" and related-product logic aren't persisted, and there's no shared "recently viewed" / "you may also like" state outside the PDP.
- **Severity:** nice-to-have.
- **Files:** `src/pages/Cart.tsx`, `src/context/CartContext.tsx`.

### 2.3 No "recently viewed" / "you may also like" persistence
- PDP shows related products (by category) which is good. But there's no cross-session "recently viewed" and no personalized recommendation story.
- **Severity:** nice-to-have.
- **Files:** `src/pages/ProductDetail.tsx`.

---

## 3. Customer account & self-service (important)

### 3.1 No address-at-checkout auto-fill from saved addresses
- `Addresses.tsx` is a real address book. But `Checkout.tsx` does not offer "Use saved address" — it re-enters everything. For returning customers this is the biggest checkout friction.
- **Severity:** important.
- **Files:** `src/pages/Checkout.tsx`, `src/services/addressService.ts`.

### 3.2 No order status / tracking detail beyond status string
- `OrderDetail` shows status + items. But there's no tracking number/URL display (those fields exist on `orders` and admin can set them via `update-order-status`, but the customer doesn't see them). Delivery estimates are generic ("2–5 business days") not order-specific.
- **Severity:** important.
- **Files:** `src/pages/Account/OrderDetail.tsx`, `supabase/functions/update-order-status`.

### 3.3 No order confirmation/download/invoice
- After checkout you get a confirmation page, but there's no downloadable invoice / order summary printable, no "reorder" action, no gift-card-like delivery.
- **Severity:** nice-to-have.
- **Files:** `src/pages/Account/OrderDetail.tsx`, `src/pages/Checkout.tsx`.

### 3.4 Email-based auth magic-link not wired (only password + reset)
- `AuthContext` supports `signIn` (password) and `resetPasswordForEmail`. There's no magic-link sign-in ("Sign in with email link") — common for Egyptian markets where passwords are a friction point. The UI pages Login/Register exist; magic link would be a UX win, not strictly required.
- **Severity:** nice-to-have.
- **Files:** `src/context/AuthContext.tsx`, `src/pages/Auth/Login.tsx`.

### 3.5 Guest checkout order lookup requires the token / email to be passed in URL by the customer
- `/guest-order` expects the customer to have the email + order number + token. If they only have the order number, they can't look it up. The flow works but is fragile — no "forgot token" path.
- **Severity:** nice-to-have.
- **Files:** `src/pages/GuestOrder.tsx`, `src/services/guestOrderService.ts`.

---

## 4. Admin tooling (important)

### 4.1 No inventory cap / low-stock alert UX in admin beyond the dashboard widget
- Dashboard shows `lowStock` (top 20 under threshold). But there's no dedicated "Low Stock" view, no ability to bulk-edit stock, no restock-note field, no back-in-stock request queue visible in admin (the `back_in_stock_requests` table exists in migration 005 but admin has no view for it).
- **Severity:** important.
- **Files:** `supabase/migrations/005_guest_tracking_and_reviews.sql`, `src/pages/Admin/Dashboard.tsx`, no `Admin/Stock` page.
- **What's missing:** a stock/reorder page listing low-stock items + sizes with a quick edit, and a back-in-stock requests admin view.

### 4.2 Product form doesn't support collections via dropdown (no collection select UI)
- `ProductForm.tsx` fetches `collections` and has state for `collectionId`, but the form field for selecting a collection isn't shown in the portion I read — needs verification but looks like a likely missing select.
- **Severity:** nice-to-have.
- **Files:** `src/pages/Admin/ProductForm.tsx`.

### 4.3 No order-notification/fulfillment note or shipment notes field
- Orders have no `notes` / internal staff note column. Admins can't leave internal notes on an order (e.g., "call customer before delivery").
- **Severity:** nice-to-have.
- **Files:** `supabase/migrations/001_schema.sql` (`orders` table), `src/pages/Admin/Orders.tsx`.

### 4.4 Admin order status change doesn't expose tracking URL/number to the admin UI
- `adminService.updateOrderStatus` sends `tracking?` but the admin `Orders.tsx` UI I read doesn't surface a tracking input — status dropdown only.
- **Severity:** nice-to-have.
- **Files:** `src/pages/Admin/Orders.tsx`, `src/services/adminService.ts`.

---

## 5. Notifications & email (operational)

### 5.1 Email sending is conditional on RESEND_API_KEY being set
- `sendEmail()` in `_shared/email.ts` skips when `RESEND_API_KEY` is unset. For the project this was just seeded, if RESEND isn't configured, order confirmations and outreach emails silently don't send. The project I verified has the DB seeded but I didn't confirm RESEND is configured.
- **Severity:** critical *if* the site is live without email; the `create-order` test I ran succeeded but orders won't email without RESEND.
- **Files:** `supabase/functions/_shared/email.ts`, `supabase/functions/create-order/index.ts`.
- **What's missing / verify:** confirm `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `STORE_URL` secrets are actually set on the project. This is the single most important operational check post-launch.

### 5.2 No double opt-in for newsletter
- `newsletterService.subscribe` inserts immediately with no confirmation email. Compliant-enough for a concept store but not for GDPR/marketing-list hygiene at scale.
- **Severity:** nice-to-have.
- **Files:** `src/services/newsletterService.ts`, `supabase/migrations/009_unsubscribe_system.sql`.

---

## 6. Trust, compliance, and SEO polish (nice-to-have)

### 6.1 Static sitemap doesn't include products / collections dynamically
- `public/sitemap.xml` is hand-written with static URLs. Products and collections are dynamic and should be in the sitemap for SEO, especially given the on-site full-text search + product schema.
- **Severity:** important for SEO.
- **Files:** `public/sitemap.xml`.
- **What's missing:** a sitemap edge function or build-time generation listing all product slugs and collection URLs.

### 6.2 No real favicon/icon asset beyond an inline SVG; no manifest.json / PWA
- There's `favicon.svg` and `robots.txt` and `sitemap.xml`, but no `manifest.json`, no service worker / offline support, no app-like install. Fine for a website, but not a PWA.
- **Severity:** nice-to-have.
- **Files:** `public/`.

### 6.3 Social links are placeholders
- The structured data embeds `instagram.com/gothennerve58`, `tiktok.com/@user795916160817`, `linkedin.com/in/nerve-shop-b67623429`, and `nerve-store.com` — these look like placeholder/example URLs. Worth verifying before launch.
- **Severity:** low (but a bad look at launch).
- **Files:** `src/lib/seo.ts`, `src/pages/ProductDetail.tsx`.

### 6.4 No privacy / cookie consent UI (only policy pages)
- There are `/privacy` and `/terms` pages, but no cookie consent banner despite GA4 + Meta Pixel being wired. In the EU/UK this is a compliance gap; for an Egyptian store less so, but still good hygiene.
- **Severity:** nice-to-have / compliance.
- **Files:** `src/lib/analytics.ts`, `src/pages/`.

---

## 7. Robustness, security, and testing (operational)

### 7.1 No active VITE_SENTRY_DSN → error tracking is disabled
- `initSentry` warns and disables itself when `VITE_SENTRY_DSN` isn't set. So production error visibility is off until that's configured.
- **Severity:** important for a live store.
- **Files:** `src/lib/sentry.ts`.
- **What's missing / verify:** set `VITE_SENTRY_DSN` and `VITE_ENV=production` and confirm errors surface.

### 7.2 No live tests / passing e2e I can confirm are wired to the real env
- Tests exist (`tests/`, `tests/e2e/`) but I can't confirm they pass against the live DB. The `npm run ci` target depends on them. Worth running a smoke test against the seeded DB (products list, PDP load, add-to-cart, checkout place-order) to confirm the end-to-end path is green.
- **Severity:** important before any launch.
- **Files:** `tests/`, `package.json` `ci` script.

### 7.3 No rate limiting on the storefront's *public* API reads
- RLS protects writes, but public product/collection reads have no per-IP rate limiting at the database layer (only edge functions rate-limit). A scraper could hammer product reads.
- **Severity:** nice-to-have.
- **Files:** `supabase/migrations/001_schema.sql` (products policies), `supabase/migrations/011_rate_limiting.sql`.

### 7.4 Chatbot is "AI" but not authenticated or scoped to a session
- The `chat-ai` edge function creates conversations by email, but there's no link between the Supabase auth session and the chat session if the user is signed in (it uses email from the request body, not the verified JWT user). If you send from the storefront, verify the JWT and pass the real email/user.
- **Severity:** nice-to-have / correctness.
- **Files:** `supabase/functions/chat-ai/index.ts`, `src/pages/Home.tsx` (chatbot trigger).

---

## 8. Mobile / performance polish

### 8.1 Product images are picsum placeholders, not real product photos
- All seeded products use `picsum.photos` seeds. The image pipeline (`imageService.ts`) supports Storage + transforms, but there's no real product imagery yet. For a concept store, this is the biggest visual gap.
- **Severity:** critical for a visual fashion brand.
- **Files:** `supabase/seed.sql` (image URLs), `src/services/imageService.ts`.

### 8.2 Hero image and gallery are also picsum
- Same story on the home page hero and category tiles — placeholder imagery throughout.
- **Severity:** critical for first impression.
- **Files:** `src/pages/Home.tsx`, `public/`.

---

## 9. i18n / localization

### 9.1 Hardcoded Egyptian context, no i18n framework
- The whole store is Egypt / EGP / Arabic-ready in theme but there's no `i18next` or locale routing. If the plan is Egypt-only Arabic/English, that's fine; if expansion to KSA/UAE is on the roadmap, the whole copy, governorate list, and number/currency formatting would need a locale layer.
- **Severity:** depends on roadmap; not a launch blocker if Egypt-only.
- **Files:** `src/data/governorates`, `src/pages/Checkout.tsx`, `src/lib/checkout.ts`.

---

## Summary — what to do, in priority order

1. **Operational must-check now:** confirm RESEND secrets are set (otherwise no order emails). Confirm `VITE_SENTRY_DSN` + `VITE_ENV=production` so errors are tracked. Confirm the Vercel dashboard has `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` production env vars (that's the fix for the mock-mode checkout error).
2. **Critical product readiness:** replace picsum placeholder imagery with real product photos + hero (the brand's weakest link today).
3. **High-value features to add pre-launch or early post-launch:**
   - Saved-address auto-fill at checkout.
   - Order detail showing tracking number/URL + delivery estimate.
   - Customer-facing cancel/return flow (start with cancel for eligible statuses).
   - Wire `/shop` search to Postgres full-text.
   - Dynamic sitemap with product slugs + collections.
4. **Admin gaps to close:**
   - Low-stock / back-in-stock requests admin view + bulk stock edit.
   - Order internal-notes field + expose tracking fields in admin orders UI.
   - Collection select in product form.
5. **Operational/e2e:** run the test suite against the live seeded DB and get a green smoke test (shop → PDP → add to cart → checkout → order placed). Add a Sentry DSN and confirm errors show in Sentry.
6. **Polish:** favicon/manifest, verify social links aren't placeholder, add a cookie-consent banner if any EU/UK traffic is expected.

Overall the project is a real, coherent v1 with a strong admin + infra spine. The biggest launch risks are the placeholder imagery, the missing email-secret confirmation, and the absence of a customer-facing order self-service (status/tracking/cancel) — not missing pages.
