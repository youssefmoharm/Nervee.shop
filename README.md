# NERVE E-Commerce Platform

A production-ready e-commerce platform for NERVE, an Egyptian fashion concept store. Built with React, TypeScript, Vite, Tailwind CSS, and Supabase.

## Features

- Full-featured shopping experience (browse, search, filter, cart, wishlist)
- Customer authentication & accounts (Supabase Auth)
- Cash on Delivery (Egyptian market)
- Admin dashboard (products, orders, customers, discount codes)
- Transactional email via Resend
- Inventory management & order fulfillment
- Responsive image pipeline with Supabase Storage
- Premium brand-consistent UI (navy/white, Anton typography)
- Fully responsive mobile-first design
- WCAG 2.1 accessible

## Tech Stack

**Frontend:**

- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- React Router (navigation)
- Lucide React (icons)

**Backend & Infrastructure:**

- Supabase (PostgreSQL, Auth, Storage)
- Supabase Edge Functions (Deno)
- Cash on Delivery (COD) checkout across Egypt
- Resend (transactional email)
- Vercel (hosting)

## Quick Start

### Prerequisites

- Node.js `>=22.12.0` (see `.nvmrc`; `nvm use` picks the right version)
- npm
- Supabase account (free tier)

### Installation

**_REMOVED_**
npm install

```

### Development

***REMOVED***
npm run dev
```

App available at `http://localhost:5173`

## Documentation

- **[SETUP.md](./SETUP.md)** - Complete setup guide (Supabase, deployment)
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Design decisions & architecture
- **[SECURITY_IMPLEMENTATION.md](./SECURITY_IMPLEMENTATION.md)** - Security details
- **[TESTING.md](./TESTING.md)** - Testing checklist
- **[PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)** - Deploy checklist

## Project Structure

```
nerve/
├── src/
│   ├── components/    # Reusable UI components
│   ├── context/       # React Context providers
│   ├── pages/         # Page components
│   ├── services/      # API service layer
│   ├── lib/           # Utility libraries
│   └── types/         # TypeScript types
├── supabase/
│   ├── migrations/    # Database migrations (applied in lexical order)
│   ├── schema.sql     # Database schema
│   └── functions/     # Edge Functions
└── tests/             # Test files (unit tests live in src/test, e2e in tests/e2e)
```

## Available Scripts

**_REMOVED_**
npm run dev # Start dev server
npm run build # Build for production (runs sitemap prebuild + tsc -b)
npm run preview # Preview production build
npm run typecheck # Type check (tsc --noEmit)
npm run lint # Lint src, tests, and scripts
npm run format # Format with Prettier
npm run format:check # Verify formatting
npm run test # Unit/component tests (Vitest, watch)
npm run test -- --run # Unit/component tests, single run
npm run test:e2e # E2E tests (Playwright; @live specs excluded by default)
npm run ci # typecheck + lint + test --run + build

```

## Database Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Apply **all** migrations in `supabase/migrations/` — they run in lexical
   order (`001_…` through `033_…`), never edit one that has already run:

   ***REMOVED***
   supabase link --project-ref <your-ref>
   supabase db push --linked --include-all
```

(Or paste them one by one into the SQL Editor in lexical order.)

3. Run `supabase/seed.sql` for sample data

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for details.

## Edge Functions

Functions live under `supabase/functions/` (one directory per function) and
deploy with:

**_REMOVED_**
supabase functions deploy

````

For the COD-only launch there are 17 functions: `auth-sign-in`,
`auth-sign-up`, `create-order`, `update-order-status`, `send-email`,
`contact`, `back-in-stock`, `send-back-in-stock`, `process-restock`,
`process-abandoned-carts`, `record-abandoned-cart`, `handle-unsubscribe`,
`chat-ai`, `create-support-ticket`, `verify-guest-order`,
`resend-guest-verification`, `request-return` (`_shared/` holds common
utilities). Payment functions are out of scope — the store is Cash on
Delivery only.

## Environment Variables

Create `.env` from `.env.example` (never commit `.env`):

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GA_ID=your-google-analytics-id
VITE_ENV=development
````

Edge Functions require these secrets (set via Supabase dashboard):

**_REMOVED_**
supabase secrets set RESEND_API_KEY=your-resend-api-key
supabase secrets set RESEND_FROM_EMAIL="NERVE <orders@yourdomain.com>"
supabase secrets set STORE_URL=https://www.nerveey.shop

```

## Security

- Row Level Security (RLS) enabled on all tables
- Distributed rate limiting
- Input validation & sanitization
- SQL injection prevention via parameterized queries

See [SECURITY_IMPLEMENTATION.md](./SECURITY_IMPLEMENTATION.md) for full details.

## Deployment

1. Deploy to Vercel (recommended):

   ***REMOVED***
   npm install -g vercel
   vercel --prod
```

2. Add environment variables in Vercel dashboard
3. Run [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) checklist

## Testing

**_REMOVED_**
npm run test -- --run # Unit/component tests (Vitest + Testing Library + MSW)
npm run test:e2e # E2E tests (Playwright — excludes @live specs)
npm run ci # Full local CI: typecheck + lint + unit tests + build

```

- **Unit/component tests** (`src/test/**`, `tests/security.test.ts`):
  pure-function coverage (Egyptian validation, checkout totals, password
  strength, checkout session persistence), real Login/Checkout page
  rendering, and one MSW-backed test documenting how the client surfaces an
  HTTP 429 from `create-order`.
- **E2E** (`tests/e2e/**`): user journeys, axe-core accessibility scans,
  cookie-consent gating, contrast checks. Specs tagged `@live` hit the
  production site/backend and are excluded from normal runs — the nightly
  `live-smoke.yml` workflow sets `PLAYWRIGHT_LIVE=1` and runs only those.
- **Server-side controls** (Postgres RLS, edge-function rate limiting)
  live in Supabase and are verified by the `@live` specs, not by vitest.

## Contributing

This is a proprietary project. For internal development team only.

## License

Proprietary - NERVE Concept Store © 2026
```
