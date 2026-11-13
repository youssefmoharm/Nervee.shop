# NERVE store

Egyptian fashion storefront and administration app built with React 18, TypeScript,
Vite, Tailwind and Supabase. Checkout is Cash on Delivery.

## Development

Use Node 24 (`.nvmrc`), then run:

```sh
npm ci
npm run dev
```

With no Supabase variables the development server uses demo catalog data.
Do not copy placeholder credentials into your environment: supplying both variables
activates live backend mode. Checkout requires a real backend.

For a configured backend, create an ignored `.env.local` with your project's
`VITE_SUPABASE_URL` and public `VITE_SUPABASE_ANON_KEY`. These values are bundled
into the browser; never put a service-role key in a `VITE_` variable. Use a separate
Supabase project for development and testing.

## Validation

```sh
npm run typecheck
npm run lint
npm run test -- --run
npm run build
npm run test:e2e
```

`build` also fetches the active catalog to generate `public/sitemap.xml`; it requires
the two Supabase variables and network access. For compilation without sitemap
or backend validation, run `npm exec -- tsc -b && npm exec -- vite build`.
Playwright runs the core suite followed by isolated mocked admin/catalog checks.
Desktop suites cover Chromium, Firefox and WebKit. Core mobile checks cover
Chromium shopping, accessibility and policy flows.
Playwright requires its browsers (`npx playwright install --with-deps`). Live specs
are excluded by default.

The separate CI database job starts isolated Supabase, applies every migration,
and runs SQL assertions with `REQUIRE_SQL_TESTS=1`. Missing prerequisites fail this
job rather than silently skipping tests. Run it locally with:

```sh
supabase start -x studio,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor
REQUIRE_SQL_TESTS=1 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:sql
```

Use CLI 2.39.2 and a local PostgreSQL client for parity with this job. Deno tests
run with `npm run test:deno`.

## Database and deployment

Apply **all** files in `supabase/migrations` in lexical order using
`supabase db push --linked --include-all`. Never edit an already-applied migration;
add a forward migration. `supabase/seed.sql` is optional catalog data, not production
setup. Back up and review migrations before deploying. See [OPERATIONS.md](OPERATIONS.md)
for notification setup, monitoring, fulfillment and recovery.

`SETUP.md`, `SUPABASE_SETUP.md` and older readiness documents contain historical
examples. This README and OPERATIONS.md describe the current workflow; the migration
files are authoritative for the schema. Deployment workflows require configured
GitHub secrets and production environment protection.
