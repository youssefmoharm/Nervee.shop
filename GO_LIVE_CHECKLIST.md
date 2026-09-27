# GO-LIVE CHECKLIST

Final release gates for https://www.nerveey.shop. Local CI currently passes,
but live security remediation, deployment, and owner/infra gates remain before
launch can be considered complete.

**Legend:** ✅ done · ❌ owner action required · ⏸ deferred (not launch-blocking,
tracked below)

---

## 1. Verification gates — ✅

| Gate                    | Status | Evidence                                          |
| ----------------------- | ------ | ------------------------------------------------- |
| `npm run typecheck`     | ✅     | tsc, 0 errors                                     |
| `npm run lint`          | ✅     | 0 errors, 38 warnings                             |
| `npm run format:check`  | ✅     | prettier clean (incl. this file)                  |
| `npm run test -- --run` | ✅     | 271/271 pass (25 files)                           |
| `npx playwright test`   | ✅     | 255 pass / 0 fail / 24 skipped (3 browsers)       |
| `npm run build`         | ✅     | local build passes; production snapshot is Ready  |
| `npm audit`             | ✅     | 0 vulnerabilities                                 |
| Audit campaign          | ✅     | `AUDIT_REPORT.md` — all launch-critical IDs fixed |

## 2. Database migrations — ✅ / security follow-up required

- [x] Production migration history confirms migrations 001–053 are applied.
- [x] Migrations 051–053 re-enabled RLS, revoked `anon` privileges, and added
      restrictive deny policies to private customer, order, payment, return,
      cart, wishlist, token, and support tables.
- [x] Post-deploy anon API probes returned HTTP 401 for all 29 tested private
      tables; public product reads still return HTTP 200.
- [ ] Investigate the period of anonymous data exposure in Supabase logs and
      assess notification/reporting obligations with the site owner.
- [ ] Verify authenticated customer and admin workflows after the lockdown.
- [ ] Run the catalog/RLS spot-checks in the SQL editor. `npm run test:sql`
      currently skips because no database URL is configured for that runner.

## 3. Secrets & environment — partial

- [x] Core Supabase, Resend, AI, and cron secret names are present in the live
      Supabase project. Secret values were not printed or copied into this repo.
- [x] Vercel production has Supabase URL/key, `VITE_ENV`, and browser
      `VITE_SENTRY_DSN` configured.
- [x] `VITE_APP_URL=https://www.nerveey.shop` is now set in Vercel Production;
      it takes effect on the next successful production build.
- [x] `git ls-files .env*` confirms local secret files are not tracked.
- [ ] Configure and validate the support inbox in Vercel/Resend.
- [ ] Add real `VITE_GA_ID` / `VITE_META_PIXEL_ID` values if analytics are
      required at launch.
- [ ] Configure Sentry sourcemap upload settings if required. No server-side
      `SENTRY_DSN` is currently configured, and the repository does not contain
      an Edge Function Sentry integration to validate.

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

- [ ] ❌ real product photography replaces placeholders. Live browser check
      previously found a mislabeled SVG served as JPEG. The fallback is now
      corrected and decodes, but no actual product photography is present in
      the workspace.
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

The current production deployment is Ready at
`https://nerve-r6w6iaa3l-youssef-moharm.vercel.app` and is aliased to
`https://www.nerveey.shop`. The live storefront returns HTTP 200, public
products and collections return HTTP 200, and `/admin` redirects signed-out
visitors to `/login`. The empty-cart checkout route renders its expected state.
The branded placeholder asset now serves as `image/svg+xml` and decodes in the
browser; it is not a substitute for product photography.

This was deployed from the validated local workspace snapshot. The source
changes are still uncommitted on top of `c24c454`; Vercel's latest Git-built
deployment before this snapshot failed because its commit lacked the admin
dashboard modules and matching context API. Future Git-triggered builds will
remain at risk until the intended source changes are reviewed and committed.
Authenticated checkout/admin workflows have not been run because production
test credentials are not configured. Do not call the release fully verified
until those flows, real product photography, inbox ownership, analytics IDs,
and monitoring are confirmed.

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
- [x] migrations applied
- [x] anonymous access to tested private tables denied
- [ ] secrets set
- [ ] fixtures seeded (or skips consciously accepted for day one)
- [x] production snapshot deployed and public routes smoke-tested
- [ ] intended source changes committed so Git-based deployments reproduce it
- [ ] signed-in customer checkout and admin workflows smoke-tested
- [ ] production content, support inbox, analytics, and Sentry validated
- [ ] monitor Sentry for the first 24 h after launch

---

_Owner: @youssefmoharm — update this file as each ❌ becomes ✅._
