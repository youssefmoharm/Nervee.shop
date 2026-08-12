# NERVE Production Readiness Checklist

## What's Code-Complete (Ready to Deploy)
- [x] Frontend React/TypeScript build passing
- [x] Database schema with 16 tables and RLS policies
- [x] Edge Functions deployed (create-order, paymob-webhook, etc.)
- [x] Customer authentication (Supabase Auth)
- [x] Payment integration (Cash on Delivery)

## What Requires External Action (HUMAN DEPLOYMENT REQUIRED)
- [ ] Create production Supabase project
- [ ] Run database migrations (002, 003, 006)
- [ ] Deploy Edge Functions to production
- [ ] Set Edge Function secrets (RESEND_*, STORE_URL)
- [ ] Configure Vercel deployment
- [ ] Set Vercel environment variables
- [ ] Configure custom DNS domain

## CI/CD Status
- [ ] GitHub Actions workflow passes on latest commit
- [ ] Typecheck passes (npm run typecheck)
- [ ] Lint passes (npm run lint)
- [ ] Unit tests pass (npm run test -- --run)
- [ ] Build succeeds (npm run build)
- [ ] E2E tests pass (npm run test:e2e -- --headless)

## Post-Deployment Verification (Run After Deploy)
- [ ] Test product browsing (anonymous)
- [ ] Test guest checkout (email + COD)
- [ ] Test authenticated checkout (cart persistence)
- [ ] Test admin login and dashboard
- [ ] Test order confirmation email delivery
- [ ] Test order confirmation email delivery
- [ ] Verify RLS policies work (no data leakage)
- [ ] Test rate limiting (create 15 rapid orders)
