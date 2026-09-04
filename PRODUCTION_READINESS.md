# NERVE — Production Readiness

**Project:** NERVE Fashion Ecommerce  
**Stack:** Vite + React + Supabase (PostgreSQL + Edge Functions + Auth + Storage)  
**Branch:** `main`  
**Last hardened:** 2026-09-04 (COD-only, Paymob removed)

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
External: Resend (email), Gemini (AI), Sentry, GA4
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
| `RESEND_FROM_EMAIL` | **Yes** | `send-email` | e.g. `"NERVE <orders@nerveey.shop>"` |
| `STORE_URL` | **Yes** | `send-email`, `create-support-ticket`, `process-*` | e.g. `https://nerveey.shop` |
| `GOOGLE_GEMINI_API_KEY` | **Yes** | `chat-ai` | `OPENAI_API_KEY` also accepted as alias |
| `CRON_SECRET` | Recommended | `send-back-in-stock`, `process-abandoned-carts` | Extra auth for scheduler endpoints |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase — do NOT set them.

---

## 4. Supabase Setup

1. Create project at https://supabase.com (project ref `gfmxvvjqlhrnmidutjwx` is current prod).
2. `supabase link --project-ref $SUPABASE_PROJECT_REF`
3. `supabase db push --linked --include-all` — applies migrations `001`–`019`.
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
| `create-payment` | JWT required | Payment attempt (COD only, idempotent) |
| `payment-webhook` | service_role/admin only | COD payment webhook, source of truth |
| `send-back-in-stock` | service_role / admin / CRON_SECRET | Back-in-stock notifications |
| `process-abandoned-carts` | service_role / admin / CRON_SECRET | Cart abandonment emails |
| `process-restock` | admin only | Admin restock trigger |
| `update-order-status` | admin only | Order status transitions |
| `contact` | anon, rate-limited | Contact form |
| `back-in-stock` | anon, rate-limited | Back-in-stock requests |

---

## 5. Order Flow

```
Customer → Checkout → create-order Edge Function → Order Created
                ↓
         Payment Method: CASH ON DELIVERY
                ↓
         Order Status: pending → confirmed → processing → shipped → delivered
                ↓
         Admin/Courier collects cash on delivery
                ↓
         payment-webhook marks order: paid
                ↓
         Order completed
```

**COD Only:** NERVE uses Cash on Delivery exclusively. No online payment gateways (Stripe, Paymob, Fawry, etc.) are integrated or supported.

---

## 6. Security

### Row Level Security (RLS)
- All tables have RLS enabled
- Customers can only access their own orders
- Admins have full access
- Service role is used for edge functions

### Authentication
- All protected operations derive identity from `auth.uid()` (JWT)
- Never trust email, user_id, or role from request body
- Guest orders use hashed tracking tokens

### Rate Limiting
- `create-order`: 10 orders/minute per IP
- `contact`: 5 requests/minute per IP
- `verify-guest-order`: 5 requests/minute per IP

### CORS
- Production: `nerveey.shop` and `www.nerveey.shop` only
- Development: localhost allowed

---

## 7. CI/CD

- **CI:** typecheck → lint → vitest → build → Playwright E2E
- **Deploy:** Vercel gated on CI success
- **Status:** Green (all checks passing)

---

## 8. Monitoring

- **Sentry:** Error tracking (optional, configured via `VITE_SENTRY_DSN`)
- **GA4:** Analytics (optional, configured via `VITE_GA_ID`)
- **Edge Functions:** Logs visible in Supabase dashboard
- **Email:** Resend delivery status in logs

---

## 9. Known Limitations

- No multi-currency support (EGP only)
- No subscription/recurring billing
- No inventory reservations beyond checkout

---

## 10. Production Checklist

- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in Vercel
- [ ] `RESEND_API_KEY` and `RESEND_FROM_EMAIL` set as Supabase secrets
- [ ] `STORE_URL` set as Supabase secret
- [ ] `GOOGLE_GEMINI_API_KEY` set as Supabase secret
- [ ] Migrations `001`–`019` pushed (`supabase db push`)
- [ ] All edge functions deployed
- [ ] Custom domain `nerveey.shop` configured in Vercel
- [ ] Sitemap: `https://nerveey.shop/sitemap.xml`
- [ ] robots.txt: `https://nerveey.shop/robots.txt`

---

## 11. Rollback

If rollback is needed:
1. Revert `main` to previous commit
2. `supabase functions deploy --project-ref $SUPABASE_PROJECT_REF`
3. Database migrations are **not** automatically rolled back — use `supabase db reset` only in development
