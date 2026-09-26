# Changelog

All notable changes to NERVE (nerveey.shop), reverse-chronological.
This file documents the production-readiness campaign triggered by
[`AUDIT_REPORT.md`](./AUDIT_REPORT.md): audit first, then fixes committed one
audit ID at a time in severity order. Final release gates live in
[`GO_LIVE_CHECKLIST.md`](./GO_LIVE_CHECKLIST.md).

## [Unreleased] — production-readiness campaign

### Added

- **FLOW-08** — image uploads directly from the admin ProductForm via
  `imageService.uploadProductImage` (5 MB / type / path-traversal validation,
  `products/{slug}/{color}/01-front.jpg` convention); paste-URL remains for
  hover images. `72220d9`
- **LEG-03** — footer "Cookie preferences" link reopens the consent banner
  (`nerve:open-cookie-consent` event). `756c538`
- **SEO-05** — collection detail pages added to `public/sitemap.xml`
  (13 static + 3 collections + 12 products = 28 URLs) with a shared fetch-retry
  helper that fails the build on fetch errors. `086b368`
- **OPS-01** — Sentry now initializes on mount in **error-only mode**; performance
  sampling and interaction breadcrumbs switch on only after cookie consent.
  `aa66066`
- **TEST-02/TEST-03** — `tests/e2e/skipGuard.ts`: every E2E skip is annotated and
  converts to a CI failure when its backing secrets/fixtures are configured, so
  CI cannot go green on skipped assertions. `7ef075f`, `1dd36bf`

### Fixed

- **SEC-01** — admin RLS SELECT policies on `customers` + `order_items`
  (migration 038; also resolves FLOW-02/03). `0f19019`
- **SEC-12** — public review author names render again via narrow
  `review_authors` view (migration 039). `9561037`
- **SEC-11** — `@lhci/cli` dev chain dropped; `npm audit` reports 0 vulns.
  `ec970ae`, `546042b`
- **FLOW-01** — picsum placeholders never render in production (mock guard).
  `00471fc`
- **FLOW-05** — sign-out clears cart, wishlist and checkout session.
  `82cea09`
- **FLOW-04** — `addLine` clamps to 1..10 like the steppers; checkout shows the
  server's field-level `details[]` under `role="alert"`. `a347f33`
- **FLOW-06** — checkout session cart lines are restored on mount when the live
  cart is empty (`CartContext.restoreLines`); recovery banner requires real
  progress and tells the truth when there was no cart to recover. `67195a9`
- **FLOW-07** — product delete soft-hides products that have order history
  (`is_active=false`), hard-deletes only unreferenced rows, and surfaces
  success/failure as toasts + a Hidden badge in admin. `0dcc340`
- **FLOW-09** — admin order/return status changes confirm before irreversible
  transitions (cancel/refund + restock warning). `7d59373`
- **FLOW-11** — editing a product keeps its original slug (URLs stay stable).
  `3774ee5`
- **BUG-02** — `ErrorBoundary` moved outside the provider tree. `46b8caa`
- **BUG-03** — error fallback resets on navigation (`resetKeys`), default
  fallback extracted, `/500` route added. `ef228be`
- **BUG-04** — Account Orders/Addresses/OrderDetail show a retry state instead
  of spinning forever on fetch failure. `0dee3f3`
- **BUG-05** — Admin Returns refetch loop removed (`load` out of effect deps).
  `b721ee9`
- **BUG-06** — `/shop?category=New Arrivals` renders newest products (special
  case in Shop + `productService`); previously always empty.
  `5c82a53` (search refactor)
- **BUG-07** — live homepage no longer renders demo/mock products. `d20cac5`
- **BUG-08** — Shop shows a retryable error state (Try again) instead of the
  empty-catalog state on network failure. `5c82a53` (search refactor)
- **BUG-13** — `orderService.getById` distinguishes not-found from transient
  fetch failures (no more false "Order not found"). `0258c53`
- **SEO-01** — per-route `<title>` + canonical served from the edge middleware
  (previously every non-product route served the homepage values).
  `82dfc5e`
- **SEO-02** — product JSON-LD served from the edge (crawlable without JS).
  `a48fdda`
- **SEO-03** — admin pages `noindex`; each account sub-page sets its own title
  and robots value. `29a38a2`
- **SEO-04** — contradictory `Disallow: /wishlist/` removed from robots.txt.
  `c4daab2`
- **UX-01** — language-switcher mojibake repaired (UTF-8 literals).
  `5cf6d99`
- **UX-03** — undersized tap targets bumped: header icons 40→44 px, heart
  32→44 px, swatches 16→24 px, drawer/modal controls ≥24 px. `21eeb24`
- **A11Y-02** — accessible names for placeholder-only inputs/selects (cart
  promo, PDP notify, chatbot, share modal, newsletter, unsubscribe, admin
  filters). `41a0a5d`
- **A11Y-03** — focus traps, dialog roles and Escape for all modals.
  `b233a9a`
- **A11Y-04** — failing `text-navy` opacity levels raised to WCAG AA contrast
  (109 fixes). `593b5f0`
- **A11Y-05** — accessible names for icon-only buttons. `7c2be1a`
- **A11Y-06** — axe E2E gate widened to 15 static routes + seeded checkout +
  PDP (heading-order promoted to blocker, `/shop` exempt pending A11Y-01);
  checkout/CompleteTheLook regressions fixed. `169e595`
- **a11y** — `FloatingDock` wrapper no longer carries a prohibited
  `aria-label` (axe `aria-prohibited-attr` on every route). `553dd62`
- **LEG-01** — privacy policy no longer contradicts live GA4/Meta tracking.
  `00a47ac`
- **OPS-02** — edge-function failures forward to Sentry. `d21d006`
- **ci** — missing `$` on the `VITE_SUPABASE_ANON_KEY` guard quoted.
  `f3c8117`

### Performance

- **PERF-01** — `decoding=async` on every image, `loading="lazy"` on offscreen
  ones. `839f20c`
- **PERF-02** — real `@supabase` split via `advancedChunks`; production build
  skips sourcemap upload (`SENTRY_UPLOAD` gated). `05a9b9f`
- **PERF-03** — unused `@tanstack/react-query` removed (−26 kB).
  `964be08`
- **PERF-05** — wishlist N+1 queries batched: shared wishlist loads via one
  `.in('slug')` query; merge is 1 + 1 batched upsert. `250e516`
- **PERF-06** — btree indexes for catalog filter/sort paths (migration 040).
  `40858eb`
- **PERF-07** — the three self-hosted woff2 fonts are preloaded. `c628798`

### Changed

- **search refactor** — catalog search/filter/sort unified behind
  `src/lib/productDiscovery.ts` (typo-tolerant search, facet counts);
  `SearchOverlay` rebuilt; `src/services/searchService.ts` removed; new
  `FloatingDock`; logo renamed to `nerve-final-logo.png`; `Shop.test.tsx` (19
  tests) + `productDiscovery.test.ts` + `discovery.spec.ts` added.
  `b7d1568`, `5c82a53`
- **style** — prettier violations blocking the `format:check` CI job fixed.
  `124eeb4`

### Tests

- Unit suite grew 131 → **211** (21 files); E2E suite **255 passed / 0 failed**
  across chromium/firefox/webkit (24 credential-gated skips).
- New suites: `wishlistService`, `sentryConsent` (OPS-01), `imageService`
  (FLOW-08), `ErrorBoundary` (BUG-03), `Cart` restore (FLOW-06),
  `Shop`/`productDiscovery` (search refactor).

## Verification (end state)

| Check                   | Result                         |
| ----------------------- | ------------------------------ |
| `npm run typecheck`     | pass                           |
| `npm run lint`          | 0 errors, 34 warnings          |
| `npm run test -- --run` | 211/211 pass                   |
| `npm run format:check`  | pass                           |
| `npx playwright test`   | 255 pass / 0 fail / 24 skipped |
| `npm run build`         | pass                           |
| `npm audit`             | 0 vulnerabilities              |
