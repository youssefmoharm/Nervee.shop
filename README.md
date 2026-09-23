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
- Framer Motion (animations)
- Lucide React (icons)
- TanStack Query (server state)

**Backend & Infrastructure:**
- Supabase (PostgreSQL, Auth, Storage)
- Supabase Edge Functions (Deno)
- Cash on Delivery (COD) checkout across Egypt
- Resend (transactional email)
- Vercel (hosting)

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account (free tier)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

App available at `http://localhost:5173`

## Documentation

- **[SETUP.md](./SETUP.md)** - Complete setup guide (Supabase, payments, deployment)
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
│   ├── migrations/    # Database migrations
│   ├── schema.sql     # Database schema
│   └── functions/     # Edge Functions
└── tests/             # Test files
```

## Available Scripts

```bash
npm run dev           # Start dev server
npm run build         # Build for production
npm run preview       # Preview production build
npm run typecheck     # Type check
npm run lint          # Lint
npm run test          # Run tests
npm run test:e2e      # Run E2E tests
```

## Database Setup

1. Create Supabase project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in SQL Editor
3. Run migrations (in order):
   - `supabase/migrations/002_orders_rpc_and_extras.sql`
   - `supabase/migrations/003_security_notifications_and_reconciliation.sql`
   - `supabase/migrations/006_guest_tracking_and_reviews.sql` (NEW)
   - `supabase/migrations/006_email_automation.sql` (NEW)
4. Run `supabase/seed.sql` for sample data

## Edge Functions

Deploy the Edge Functions to Supabase:

```bash
supabase functions deploy create-order
supabase functions deploy update-order-status
supabase functions deploy process-restock
supabase functions deploy back-in-stock
supabase functions deploy contact
supabase functions deploy send-email
supabase functions deploy process-abandoned-carts
```

## Environment Variables

Create `.env` from `.env.example`:

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GA_ID=your-google-analytics-id
VITE_ENV=development
```

Edge Functions require these secrets (set via Supabase dashboard):

```bash
supabase secrets set RESEND_API_KEY=your-resend-api-key
supabase secrets set RESEND_FROM_EMAIL="NERVE <orders@yourdomain.com>"
supabase secrets set STORE_URL=https://your-production-domain.com
```

## Security

- Row Level Security (RLS) enabled on all tables
- Distributed rate limiting
- Input validation & sanitization
- Input validation & sanitization
- SQL injection prevention via parameterized queries

See [SECURITY_IMPLEMENTATION.md](./SECURITY_IMPLEMENTATION.md) for full details.

## Deployment

1. Deploy to Vercel (recommended):
   ```bash
   npm install -g vercel
   vercel --prod
   ```

2. Add environment variables in Vercel dashboard
3. Run [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) checklist

## Testing

Run the test suite:

```bash
npm run test -- --run          # Unit tests
npm run test:e2e -- --headless # E2E tests
```

Security regression tests in `tests/security.test.ts` verify:
- HMAC validation
- Replay attack prevention
- Rate limiting
- RLS policies
- Input validation

## Contributing

This is a proprietary project. For internal development team only.

## License

Proprietary - NERVE Concept Store © 2026
