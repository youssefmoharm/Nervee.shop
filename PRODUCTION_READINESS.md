# NERVE — Production Readiness

**Project:** NERVE Fashion Ecommerce
**Stack:** Vite + React + Supabase (PostgreSQL + Edge Functions + Auth + Storage)
**Branch:** `main`
**Last hardened:** through migration 033

---

## 1. Architecture Summary

```
Browser (Vite React)
  ├─ Supabase JS client (anon key, RLS-enforced)
  ├─ Edge Functions (/functions/v1/*) — JWT or service_role gated
  └─ Vercel (static hosting, remote build)
Supabase
  ├─ PostgreSQL + RLS + SECURITY DEFINER RPCs (place_order, etc.)
  ├─ Edge Functions (Deno, service_role bypass)
  ├─ Auth (GoTrue, JWT, admin_users table)
  └─ Storage (product images)
External: Resend (email), Gemini (AI), Sentry, GA4 — payments are COD only
```

---

## 2. Deployment Flow

```
Push to main
  → GitHub Actions: CI (typecheck → lint → vitest → build → Playwright E2E)
  → On CI success: Deploy to Vercel (workflow_run gated)
  → Vercel remote build reads env from Vercel dashboard (not from .env file)
  → Supabase migrations + edge functions deployed separately:
      supabase link --project-ref $SUPABASE_PROJECT_REF
      supabase db push --linked --include-all
      supabase functions deploy --project-ref $SUPABASE_PROJECT_REF --no-verify-jwt
```

**Important:** CI E2E `continue-on-error` has been removed — red builds block deploy.

---

## 3. Required Environment Variables

### Frontend (Vite) — PUBLIC, bundled to browser, set in Vercel dashboard

| Variable                 | Required    | Example                                    | Notes                                   |
| ------------------------ | ----------- | ------------------------------------------ | --------------------------------------- |
| `VITE_SUPABASE_URL`      | **Yes**     | `https://gfmxvvjqlhrnmidutjwx.supabase.co` | Build FAILS in prod if missing          |
| `your_removed_credential_here` | **Yes**     | `sb_publishable_...`                       | Publishable anon key, public by design  |
| `VITE_ENV`               | No          | `production`                               | Runtime environment tag for logs/Sentry |
| `VITE_SENTRY_DSN`        | Recommended | `https://...@ingest.sentry.io/...`         | Error tracking                          |
| `VITE_GA_ID`             | No          | `G-XXXXXXXXXX`                             | GA4                                     |
| `VITE_META_PIXEL_ID`     | No          | `123456789`                                | Meta Pixel                              |

`src/lib/supabase.ts` enforces: missing `VITE_SUPABASE_URL`/`ANON_KEY` in a production build (`import.meta.env.PROD`) throws at startup — no silent demo fallback.

### Backend — SERVER SECRETS, set via `supabase secrets set KEY=value`

| Secret                  | Required    | Used by                                            | Notes                                   |
| ----------------------- | ----------- | -------------------------------------------------- | --------------------------------------- |
| `RESEND_API_KEY`        | **Yes**     | `send-email`, `create-order`, `process-*`          | Resend transactional email              |
| `RESEND_FROM_EMAIL`     | **Yes**     | `send-email`                                       | e.g. `"NERVE <orders@nerveey.shop>"`    |
| `STORE_URL`             | **Yes**     | `send-email`, `create-support-ticket`, `process-*` | e.g. `https://www.nerveey.shop`         |
| `GOOGLE_GEMINI_API_KEY` | **Yes**     | `chat-ai`                                          | `OPENAI_API_KEY` also accepted as alias |
| `CRON_SECRET`           | Recommended | `send-back-in-stock`, `process-abandoned-carts`    | Extra auth for scheduler endpoints      |

Payments are out of scope for this launch: **COD only** — there are
no payment-provider secrets and no online-payment edge functions.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase — do NOT set them.

---

## 4. Supabase Setup

1. Create project at https://supabase.com (project ref `gfmxvvjqlhrnmidutjwx` is current prod).
2. `supabase link --project-ref $SUPABASE_PROJECT_REF`
3. `supabase db push --linked --include-all` — applies migrations `001`–`033`.
4. `supabase secrets set RESEND_API_KEY=... RESEND_FROM_EMAIL=... STORE_URL=... GOOGLE_GEMINI_API_KEY=...`
5. `supabase functions deploy --project-ref $SUPABASE_PROJECT_REF` — deploys all edge functions.
6. Verify: `supabase secrets list` and `supabase functions list`.

### Edge Functions

| Function                        | Auth                                             | Purpose                                         |
| ------------------------------- | ------------------------------------------------ | ----------------------------------------------- |
| `create-order`                  | JWT (customer) + anon (guest), rate-limited      | Order creation (re-prices server-side)          |
| `send-email`                    | **service_role or admin JWT only**               | Transactional email (Resend) — blocks anon      |
| `chat-ai`                       | JWT (auth user) or anon (guest, limited context) | Gemini chatbot with ownership checks            |
| `create-support-ticket`         | JWT + conversation ownership                     | Support tickets from chat                       |
| `verify-guest-order`            | anon, rate-limited                               | Secure guest order lookup (hashed token)        |
| `send-back-in-stock`            | service_role / admin / CRON_SECRET               | Back-in-stock notifications                     |
| `process-abandoned-carts`       | service_role / admin / CRON_SECRET               | Cart abandonment emails                         |
| `process-restock`               | admin only                                       | Admin restock trigger                           |
| `update-order-status`           | admin only                                       | Order status transitions                        |
| `contact`                       | anon, rate-limited                               | Contact form                                    |
| `back-in-stock`                 | anon, rate-limited                               | Back-in-stock requests                          |
| `handle-unsubscribe`            | token capability                                 | Unsubscribe via token                           |
| `auth-sign-in` / `auth-sign-up` | pre-auth                                         | Supabase Auth wrappers for the frontend         |
| `request-return`                | JWT (order owner) or guest token                 | Return/cancellation requests                    |
| `record-abandoned-cart`         | anon, rate-limited                               | Record/refresh abandoned-cart tracking          |
| `resend-guest-verification`     | anon, rate-limited                               | Re-issue guest tracking link (anti-enumeration) |

Full list: `supabase/functions/` (17 functions; each `index.ts` documents
its own auth mode).

---

## 5. Payment

- **Payments are out of scope for this launch: COD only.** Do not add
  payment-provider secrets or online-payment functions.
- `place_order` RPC re-prices from `products.price`, locks inventory with `FOR UPDATE`, validates discounts server-side.
- **UI:** `Checkout.tsx` is COD only.
- **Order status vs payment status are distinct** (`orders.status` vs `payment_status` + `payment_attempts.status`).
- **Refunds/returns:** `refunds` table, `order_return_requests` table (cancellation/return with reason, status, dedup via `UNIQUE(order_id, type)`), stock restored only once via `update_order_status`.

---

## 6. Email

- Provider: Resend via `send-email` (service_role/admin only, payload validated: subject ≤200, body ≤100KB, type whitelist, sender fixed server-side).
- Required secrets: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `STORE_URL`.
- `create-order` sends `orderConfirmedEmail` (fixed template, not client HTML).
- Scheduled jobs (registered by pg_cron in migrations 007 + 032):
  `send-back-in-stock` **hourly**, `process-abandoned-carts` **daily 10:00 UTC**,
  plus weekly cleanup of old email logs / cart tracking. Both call `send-email` with service_role.
- Frontend `emailAutomation.ts` no longer sends arbitrary emails — server is the gate.
- Unsubscribe: `create_unsubscribe_token` (PUBLIC by design for email generation) + `process_unsubscribe` (service_role only), `should_send_email` check.

---

## 7. Sentry / Monitoring

- Frontend: `src/lib/sentry.ts` — `initSentry()` reads `VITE_SENTRY_DSN`, tags `environment` from `VITE_ENV`, `tracesSampleRate` 0.1 in prod, 1.0 in dev, PII minimized.
- Edge: `supabase/functions/_shared/monitoring.ts` — `PerformanceTimer`, `logEvent`, `logOrderSuccess/Failure`, `logRateLimitHit`, `logEmailSuccess`.
- Every edge function logs with correlation: order creation, order status, ticket, rate limit, guest verification.
- **Verify:** trigger a test error in staging and confirm ingestion in Sentry dashboard.

---

## 8. Vercel Setup

1. Import repo `youssefmoharm/Nervee.shop` to Vercel.
2. Set env vars in Vercel → Settings → Environment Variables (Production + Preview):
   - `VITE_SUPABASE_URL`, `your_removed_credential_here` (required — build fails without them)
   - Optionally `VITE_SENTRY_DSN`, `VITE_GA_ID`, `VITE_META_PIXEL_ID`
3. Deploy is gated on CI: `deploy.yml` triggers only on `workflow_run` success of `CI`.
4. Custom domain: add `www.nerveey.shop` in Vercel → Settings → Domains, set DNS.

---

## 9. Security Model

### RLS Summary

| Table                                                   | anon                              | authenticated    | admin        | service_role |
| ------------------------------------------------------- | --------------------------------- | ---------------- | ------------ | ------------ |
| `products`, `product_colors`, `collections`             | SELECT (public)                   | SELECT           | ALL          | bypass       |
| `product_inventory`                                     | SELECT (availability)             | SELECT           | ALL          | bypass       |
| `discount_codes`                                        | **no SELECT** (harvest blocked)   | **no SELECT**    | ALL          | bypass       |
| `orders`, `order_items`                                 | —                                 | SELECT own only  | SELECT all   | bypass       |
| `customers`, `customer_addresses`, `carts`, `wishlists` | —                                 | own only         | —            | bypass       |
| `guest_orders`                                          | **deny-all** (edge function only) | **deny-all**     | **deny-all** | bypass       |
| `chat_conversations`, `chat_messages`                   | —                                 | own only         | all          | bypass       |
| `support_tickets`                                       | —                                 | own + guest NULL | all          | bypass       |
| `admin_users`                                           | —                                 | SELECT own row   | —            | bypass       |
| `payment_attempts`, `refunds`, `order_status_history`   | —                                 | own orders       | all          | bypass       |

### RPC Grants

- `service_role` only: `place_order`, `check_rate_limit`, `process_unsubscribe`, `log_email_send`, `find_*`, `mark_*`.
- `authenticated + service_role`: `merge_guest_cart` (v2, uses `auth.uid()`), `verify_review_purchase` (with owner check), `create_ticket_from_chat`, `update_conversation_metadata`, `close_conversation`, `get_ai_context` (scoped to caller), `validate_discount_code`.
- Explicit `REVOKE PUBLIC` on all sensitive functions; `SET search_path = public` on all `SECURITY DEFINER`.
- `verify_review_purchase` enforces `customer_id = auth.uid()` — fixes prior IDOR.
- `get_ai_context` enforces `p_email` must match caller unless admin/service_role.

### Edge Auth

- `send-email`: service_role token or admin JWT — anon rejected.
- `chat-ai`: JWT required for customer context; conversation `user_id` ownership enforced; guest conversations require email match.
- `create-support-ticket`: conversation ownership + email consistency + one-ticket-per-conversation guard.
- `send-back-in-stock`, `process-abandoned-carts`: service_role / admin / `CRON_SECRET`.

### Guest Order

- `guest_orders` RLS is deny-all. Lookup is via `verify-guest-order` edge function → `lookup_guest_order` RPC (token hash comparison, expiry check). Rate-limited per IP + per email. No JWT claim dependency. Token stored as `token_hash` (SHA-256) when available.

---

## 10. Rollback Strategy

- **Code:** `git revert` the offending commit, push to `main` — CI must pass, then Vercel auto-deploys previous good build. Do NOT force-push or delete migrations.
- **Database:** forward migrations only. To undo a schema change, create a new migration that reverses it (e.g., `ALTER TABLE ... DROP COLUMN`). Never edit already-deployed migration files.
- **Secrets:** rotate via `supabase secrets set KEY=new_value` + `supabase functions deploy <function>`. Old tokens remain valid until rotated.
- **Payments:** out of scope (COD only) — refunds via `refunds` table + admin status transitions; never mutate `orders.total` directly.
- **Backups:** Supabase PITR (Point-in-Time Recovery) is enabled on paid plan — restore to a timestamp via dashboard.

---

## 11. Monitoring Strategy

- Frontend errors → Sentry (alert on new issue, error rate spike).
- Edge function logs → Supabase Dashboard → Edge Functions → Logs.
- Structured logs: `logOrderSuccess/Failure`, `logRateLimitHit`, `logEmailSuccess`, chat `logEvent`.
- Rate limiting: `rate_limit_requests` table (auto-cleaned, window-based).
- Uptime: Vercel Analytics + Supabase health checks.

---

## 12. Production Launch Checklist

- [x] Supabase project created and linked (`gfmxvvjqlhrnmidutjwx`)
- [x] All migrations present in repo (`supabase/migrations`, `001`–`033`) — push via `supabase db push`
- [x] All edge functions present and type-checked (`deno check` clean)
- [ ] Secrets set: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `STORE_URL`, `GOOGLE_GEMINI_API_KEY`, `CRON_SECRET` (dashboard — not verifiable from code)
- [x] Vercel env vars set: `VITE_SUPABASE_URL`, `your_removed_credential_here` (site builds and serves product data)
- [x] Custom domain `www.nerveey.shop` configured and HTTPS verified
- [x] `ci.yml` passes on `main` (typecheck, lint, format, vitest, build, E2E without `continue-on-error`)
- [ ] `npm audit` passes (0 vulnerabilities) — re-run before launch
- [ ] Manual smoke test (see below) passes — full path not re-verified in this hardening pass
- [ ] Sentry DSN set and test event ingested (dashboard)
- [ ] Resend domain verified (SPF/DKIM) (dashboard)

**Hardening notes (this pass):**

- Edge rate limiting: `verify-guest-order`, `create-support-ticket`, and `request-return` use distributed `check_rate_limit` (not instance-local maps alone).
- Crisp chat loads only after cookie consent (`granted`).
- Product OG meta injected at the edge for `/product/*` scrapers.
- `img-src` CSP tightened to self + Supabase Storage + own origin (no blanket `https:`).

### Smoke Test

1. Homepage loads, no console errors.
2. Shop → search → product → add to cart → cart → checkout (guest, COD) → order confirmation.
3. Register → login → wishlist → add address → place order → account/orders shows order.
4. Guest `/guest-order` lookup with email+orderNumber+token → correct order.
5. Admin login → dashboard → product CRUD → inventory → orders → tracking → customers.
6. Back-in-stock request → admin restock → email received.
7. Chatbot → message → receive reply → escalate → ticket created.
8. Unsubscribe link → token flow.

---

_Generated from actual code, migrations, edge functions, workflows, and tests — not from prior markdown claims._
