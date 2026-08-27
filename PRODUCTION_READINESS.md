# NERVE — Production Readiness

**Project:** NERVE Fashion Ecommerce
**Stack:** Vite + React + Supabase (PostgreSQL + Edge Functions + Auth + Storage)
**Branch:** `main`
**Last hardened:** 2026-08-19 (migrations 012, 013)

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
External: Resend (email), Gemini (AI), Paymob (future), Sentry, GA4
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

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `VITE_SUPABASE_URL` | **Yes** | `https://gfmxvvjqlhrnmidutjwx.supabase.co` | Build FAILS in prod if missing |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | `sb_publishable_...` | Publishable anon key, public by design |
| `VITE_ENV` | No | `production` | Used by security-test gate |
| `VITE_SENTRY_DSN` | Recommended | `https://...@ingest.sentry.io/...` | Error tracking |
| `VITE_GA_ID` | No | `G-XXXXXXXXXX` | GA4 |
| `VITE_META_PIXEL_ID` | No | `123456789` | Meta Pixel |

`src/lib/supabase.ts` enforces: missing `VITE_SUPABASE_URL`/`ANON_KEY` in a production build (`import.meta.env.PROD`) throws at startup — no silent demo fallback.

### Backend — SERVER SECRETS, set via `supabase secrets set KEY=value`

| Secret | Required | Used by | Notes |
|--------|----------|---------|-------|
| `RESEND_API_KEY` | **Yes** | `send-email`, `create-order`, `process-*` | Resend transactional email |
| `RESEND_FROM_EMAIL` | **Yes** | `send-email` | e.g. `"NERVE <orders@nerve-store.com>"` |
| `STORE_URL` | **Yes** | `send-email`, `create-support-ticket`, `process-*` | e.g. `https://nerve-store.com` |
| `GOOGLE_GEMINI_API_KEY` | **Yes** | `chat-ai` | `OPENAI_API_KEY` also accepted as alias |
| `CRON_SECRET` | Recommended | `send-back-in-stock`, `process-abandoned-carts` | Extra auth for scheduler endpoints |
| `PAYMOB_API_KEY` | No (P1) | `create-payment`, `payment-webhook` | Enables card payments when set |
| `PAYMOB_HMAC_SECRET` | No (P1) | `payment-webhook` | HMAC verification |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase — do NOT set them.

---

## 4. Supabase Setup

1. Create project at https://supabase.com (project ref `gfmxvvjqlhrnmidutjwx` is current prod).
2. `supabase link --project-ref $SUPABASE_PROJECT_REF`
3. `supabase db push --linked --include-all` — applies migrations `001`–`013`.
4. `supabase secrets set RESEND_API_KEY=... RESEND_FROM_EMAIL=... STORE_URL=... GOOGLE_GEMINI_API_KEY=...`
5. `supabase functions deploy --project-ref $SUPABASE_PROJECT_REF` — deploys all edge functions.
6. Verify: `supabase secrets list` and `supabase functions list`.

### Edge Functions

| Function | Auth | Purpose |
|----------|------|---------|
| `create-order` | JWT (customer) + anon (guest), rate-limited | Order creation (re-prices server-side) |
| `send-email` | **service_role or admin JWT only** | Transactional email (Resend) — blocks anon |
| `chat-ai` | JWT (auth user) or anon (guest, limited context) | Gemini chatbot with ownership checks |
| `create-support-ticket` | JWT + conversation ownership | Support tickets from chat |
| `verify-guest-order` | anon, rate-limited | Secure guest order lookup (hashed token) |
| `create-payment` | JWT required | Payment attempt (COD/Paymob, idempotent) |
| `payment-webhook` | HMAC verified | Provider webhook, source of truth |
| `send-back-in-stock` | service_role / admin / CRON_SECRET | Back-in-stock notifications |
| `process-abandoned-carts` | service_role / admin / CRON_SECRET | Cart abandonment emails |
| `process-restock` | admin only | Admin restock trigger |
| `update-order-status` | admin only | Order status transitions |
| `contact` | anon, rate-limited | Contact form |
| `back-in-stock` | anon, rate-limited | Back-in-stock requests |
| `handle-unsubscribe` | token capability | Unsubscribe via token |
| `security-test` | admin + non-production guard | Security regression suite |

---

## 5. Payment

- **Active:** COD (Cash on Delivery). `place_order` RPC re-prices from `products.price`, locks inventory with `FOR UPDATE`, validates discounts server-side.
- **Architecture for Paymob:** `payment_attempts` table (idempotent, provider-agnostic), `create-payment` edge function (creates attempt, calls Paymob when configured), `payment-webhook` (HMAC verification, idempotent updates, `order.payment_status` is source of truth — browser `/success` never marks paid).
- **UI:** `Checkout.tsx` shows card option only when `PAYMOB_API_KEY` is configured; otherwise COD only. No faking.
- **Order status vs payment status are distinct** (`orders.status` vs `payment_status` + `payment_attempts.status`).
- **Refunds/returns:** `refunds` table, `order_return_requests` table (cancellation/return with reason, status, dedup via `UNIQUE(order_id, type)`), stock restored only once via `update_order_status`.

---

## 6. Email

- Provider: Resend via `send-email` (service_role/admin only, payload validated: subject ≤200, body ≤100KB, type whitelist, sender fixed server-side).
- Required secrets: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `STORE_URL`.
- `create-order` sends `orderConfirmedEmail` (fixed template, not client HTML).
- Scheduled jobs (`process-abandoned-carts`, `send-back-in-stock`) call `send-email` with service_role.
- Frontend `emailAutomation.ts` no longer sends arbitrary emails — server is the gate.
- Unsubscribe: `create_unsubscribe_token` (PUBLIC by design for email generation) + `process_unsubscribe` (service_role only), `should_send_email` check.

---

## 7. Sentry / Monitoring

- Frontend: `src/lib/sentry.ts` — `initSentry()` reads `VITE_SENTRY_DSN`, tags `environment` from `VITE_ENV`, `tracesSampleRate` 0.1 in prod, 1.0 in dev, PII minimized.
- Edge: `supabase/functions/_shared/monitoring.ts` — `PerformanceTimer`, `logEvent`, `logOrderSuccess/Failure`, `logRateLimitHit`, `logEmailSuccess`.
- Every edge function logs with correlation: order creation, payment, ticket, rate limit, guest verification.
- **Verify:** trigger a test error in staging and confirm ingestion in Sentry dashboard.

---

## 8. Vercel Setup

1. Import repo `youssefmoharm/Nervee.shop` to Vercel.
2. Set env vars in Vercel → Settings → Environment Variables (Production + Preview):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (required — build fails without them)
   - Optionally `VITE_SENTRY_DSN`, `VITE_GA_ID`, `VITE_META_PIXEL_ID`
3. Deploy is gated on CI: `deploy.yml` triggers only on `workflow_run` success of `CI`.
4. Custom domain: add `nerve-store.com` (or your domain) in Vercel → Settings → Domains, set DNS.

---

## 9. Security Model

### RLS Summary

| Table | anon | authenticated | admin | service_role |
|-------|------|---------------|-------|--------------|
| `products`, `product_colors`, `collections` | SELECT (public) | SELECT | ALL | bypass |
| `product_inventory` | SELECT (availability) | SELECT | ALL | bypass |
| `discount_codes` | **no SELECT** (harvest blocked) | **no SELECT** | ALL | bypass |
| `orders`, `order_items` | — | SELECT own only | SELECT all | bypass |
| `customers`, `customer_addresses`, `carts`, `wishlists` | — | own only | — | bypass |
| `guest_orders` | **deny-all** (edge function only) | **deny-all** | **deny-all** | bypass |
| `chat_conversations`, `chat_messages` | — | own only | all | bypass |
| `support_tickets` | — | own + guest NULL | all | bypass |
| `admin_users` | — | SELECT own row | — | bypass |
| `payment_attempts`, `refunds`, `order_status_history` | — | own orders | all | bypass |

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
- `security-test`: blocked in production (`VITE_ENV=production` → 403) + admin required.

### Guest Order

- `guest_orders` RLS is deny-all. Lookup is via `verify-guest-order` edge function → `lookup_guest_order` RPC (token hash comparison, expiry check). Rate-limited per IP + per email. No JWT claim dependency. Token stored as `token_hash` (SHA-256) when available.

---

## 10. Rollback Strategy

- **Code:** `git revert` the offending commit, push to `main` — CI must pass, then Vercel auto-deploys previous good build. Do NOT force-push or delete migrations.
- **Database:** forward migrations only. To undo a schema change, create a new migration that reverses it (e.g., `ALTER TABLE ... DROP COLUMN`). Never edit already-deployed migration files.
- **Secrets:** rotate via `supabase secrets set KEY=new_value` + `supabase functions deploy <function>`. Old tokens remain valid until rotated.
- **Payments:** refunds via `refunds` table + provider refund API; never mutate `orders.total` directly.
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

- [ ] Supabase project created and linked (`gfmxvvjqlhrnmidutjwx`)
- [ ] Migrations `001`–`013` pushed (`supabase db push`)
- [ ] All edge functions deployed
- [ ] Secrets set: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `STORE_URL`, `GOOGLE_GEMINI_API_KEY`, `CRON_SECRET`, (optional `PAYMOB_*`)
- [ ] Vercel env vars set: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [ ] Custom domain `nerve-store.com` configured and HTTPS verified
- [ ] `ci.yml` passes on `main` (typecheck, lint, vitest, build, E2E without `continue-on-error`)
- [ ] `npm audit` passes (0 vulnerabilities)
- [ ] Manual smoke test (see below) passes
- [ ] Sentry DSN set and test event ingested
- [ ] Resend domain verified (SPF/DKIM)
- [ ] `security-test` returns 403 in production (verify non-prod leak)

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

*Generated from actual code, migrations, edge functions, workflows, and tests — not from prior markdown claims.*
