# GO-LIVE CHECKLIST

Final release gates for https://www.nerveey.shop. Code-side work is done and
green; the ❌ items are owner/infra actions that cannot be completed from this
repository. Verify with the commands at the bottom before flipping DNS/launch.

**Legend:** ✅ done · ❌ owner action required · ⏸ deferred (not launch-blocking,
tracked below)

---

## 1. Verification gates — ✅

| Gate                    | Status | Evidence                                          |
| ----------------------- | ------ | ------------------------------------------------- |
| `npm run typecheck`     | ✅     | tsc, 0 errors                                     |
| `npm run lint`          | ✅     | 0 errors, 34 warnings                             |
| `npm run format:check`  | ✅     | prettier clean (incl. this file)                  |
| `npm run test -- --run` | ✅     | 211/211 pass (21 files)                           |
| `npx playwright test`   | ✅     | 255 pass / 0 fail / 24 skipped (3 browsers)       |
| `npm run build`         | ✅     | production build passes                           |
| `npm audit`             | ✅     | 0 vulnerabilities                                 |
| Audit campaign          | ✅     | `AUDIT_REPORT.md` — all launch-critical IDs fixed |

## 2. Database migrations — ❌

Migrations 036–040 exist in `supabase/migrations/` but are **not confirmed
applied** to the production project (cannot be verified from code):

- [ ] ❌ `supabase db push` — applies 036–040 (SEC-01 admin RLS on
      `customers`/`order_items`, SEC-12 `review_authors` view, PERF-06 catalog
      indexes, PERF-05 wishlist batch indexes)
- [ ] ❌ spot-check in SQL editor: `select relname from pg_stat_user_tables where relname = 'review_authors';`
- [ ] ❌ confirm anon role cannot `select * from customers;`

## 3. Secrets & environment — ❌

- [ ] ❌ `supabase secrets set SENTRY_DSN=...` (server-side; OPS-02 forwards
      edge-function failures) + optional `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`
- [ ] ❌ Vercel env `VITE_SENTRY_DSN` (browser; error-only until consent) —
      placeholder in `.env.example` is intentionally commented out
- [ ] ❌ Vercel env `VITE_GA_ID` / `VITE_META_PIXEL_ID` (real IDs; analytics
      events already wired, OPS-06)
- [ ] ❌ Vercel env `SENTRY_AUTH_TOKEN` + `SENTRY_ORG`/`SENTRY_PROJECT` +
      `SENTRY_UPLOAD=1` if uploading sourcemaps from CI (PERF-02 keeps them off
      by default)
- [ ] ❌ all `VITE_` values re-checked for prod domain
      (`VITE_APP_URL=https://www.nerveey.shop`)
- [ ] ❌ `.env` / `.env.local` confirmed untracked (baseline check passed;
      re-confirm `git ls-files .env*` is empty of secrets)

## 4. CI E2E fixtures — ❌

`skipGuard` (TEST-02/03) turns these into CI failures the moment the secrets
exist — seed them and the 24 skips collapse to real coverage:

- [ ] ❌ `ADMIN_TEST_EMAIL` / `ADMIN_TEST_PASSWORD` — real admin row (admin CRUD
      suite, cart-merge admin login)
- [ ] ❌ `AUTH_TEST_EMAIL` / `AUTH_TEST_PASSWORD` — real customer
- [ ] ❌ seed catalog rows expected by tests (orders to edit/return, products
      with `order_items` history) so CRUD/empty-catalog skips go live
- [ ] ❌ `VITE_GA_ID`/`VITE_META_PIXEL_ID` for the consent.spec analytics skips

## 5. Content & ops — ❌ / ⏸

- [ ] ❌ real product photography replaces placeholders (FLOW-01 fix only
      stops rendering picsum in prod; images themselves are owner-supplied)
- [ ] ❌ verify `npm run build` output once with real images wired
- [ ] ❌ support inbox live for `VITE_SUPPORT_EMAIL` (Resend `RESEND_FROM_EMAIL` + `STORE_URL` set)
- [ ] ❌ cookie banner copy reviewed post LEG-03 (footer link works)
- [ ] ⏸ SEC-08 captcha/Turnstile on auth + checkout (owner decision; rate
      limits already active)
- [ ] ⏸ LEG-02 double opt-in for newsletter (deferred; single opt-in currently
      functional)
- [ ] ⏸ OPS-04 separate staging Supabase/Vercel project (preview gate silently
      skips without `PREVIEW_URL`)
- [ ] ⏸ OPS-05 confirm PITR/backup state in the Supabase dashboard (docs claim
      on; not verifiable from code)

## 6. Deferred engineering (launch-safe, tracked) — ⏸

| ID                                                                    | Item                                                    | Why deferred                        |
| --------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------- |
| PERF-04                                                               | server-side pagination for `list()`/`search()`          | catalog fits client slice today     |
| PERF-09                                                               | PDP data waterfall / request coalescing                 | single-request PDP, low impact      |
| FLOW-10                                                               | order-tracking timeline UI (`order_status_history`)     | data present; UI is nice-to-have    |
| UX-02                                                                 | 63 missing `ar.ts` keys (mixed-language fallback)       | keys fall back to English safely    |
| A11Y-01                                                               | `/shop` heading order h1→h2→h3                          | exempted in a11y.spec, listed below |
| BUG-09                                                                | `DiscountCodeInput`/`comparisonService` still dead code | imageService wired via FLOW-08      |
| FLOW-12..17, BUG-01/10/11/12/14, SEO-06, UX-04/07, LEG-04, TEST-01/04 | Low-severity backlog                                    | see `AUDIT_REPORT.md`               |
| —                                                                     | 5 aria-label ar.ts translations + `text-navy` leftovers | follow UX-02 translation pass       |

## 7. Sign-off sequence

```bash
npm ci
npm run typecheck && npm run lint && npm run format:check
npm run test -- --run
npm run build && npm audit
npx playwright test            # after CI fixtures are seeded
supabase db push               # migration gate (section 2)
git ls-files .env              # no secrets tracked
```

- [ ] all gates ✅
- [ ] migrations applied
- [ ] secrets set
- [ ] fixtures seeded (or skips consciously accepted for day one)
- [ ] monitor Sentry for the first 24 h (OPS-01/02 now reporting)

---

_Owner: @youssefmoharm — update this file as each ❌ becomes ✅._
