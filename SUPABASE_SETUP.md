# Supabase Setup & Deployment Guide

## Prerequisites

1. **Supabase CLI installed**

   ***REMOVED***
   npm install -g supabase
   ```

2. **Supabase Account** - Create at https://supabase.com

3. **Access Token** - Generate from Supabase Dashboard > Settings > Access Tokens

## Step 1: Authenticate with Supabase CLI

***REMOVED***
supabase login
# Follow the prompts to authenticate
```

## Step 2: Link Project to Local Development

The project is already linked to the Supabase project `Nerve` (ref: `gfmxvvjqlhrnmidutjwx`).

To verify linking:

***REMOVED***
supabase projects list
```

You should see the Nerve project listed.

## Step 3: Push Migrations to Supabase

***REMOVED***
# Push all migrations to the linked project
supabase db push --linked

# Or with all options
supabase db push --linked --include-all
```

This will:

- Create/update all tables from migrations
- Create functions and triggers
- Set up Row Level Security (RLS) policies
- Configure scheduled jobs (if pg_cron is available)

## Step 4: Deploy Edge Functions

***REMOVED***
# Deploy all edge functions
supabase functions deploy

# Or deploy specific function
supabase functions deploy create-order
```

Functions included (see `supabase/functions/` for the authoritative list):

- `create-order` - Place orders (COD only)
- `auth-sign-in` / `auth-sign-up` - Supabase Auth wrappers
- `send-email` - Send transactional emails
- `handle-unsubscribe` - One-click unsubscribe
- `process-abandoned-carts` - Cart recovery emails (daily 10:00 UTC via pg_cron)
- `send-back-in-stock` - Back-in-stock notifications (hourly via pg_cron)
- `update-order-status` - Order status updates
- `process-restock` - Admin restock trigger
- `back-in-stock` - Notify-me requests
- `contact` - Contact form
- `verify-guest-order` - Guest order lookup
- `request-return` - Return/cancellation requests
- `chat-ai` / `create-support-ticket` - AI chat + support tickets

(Payment functions are out of scope — the store is COD only.)

## Current Setup

✅ **Linked to Supabase Project:**

- Project Name: `Nerve`
- Project Ref: `gfmxvvjqlhrnmidutjwx`
- Region: North EU (Stockholm)

✅ **Configuration Files:**

- `.supabase/config.json` - Supabase config with function definitions
- `supabase/migrations/` - 33 migrations (001–033) with all schema
- `supabase/functions/` - 17 edge functions (plus `_shared/` helper directory)

✅ **Local Development:**

***REMOVED***
# Start local Supabase instance
supabase start

# Stop local instance
supabase stop

# View logs
supabase logs
```

## Migrations Overview

All migrations in `supabase/migrations/`, applied in lexical order:

| Migration                                                   | Purpose                                                              |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| 001_schema.sql                                              | Core tables (products, orders, customers, etc.)                      |
| 002_orders_rpc_and_extras.sql                               | Order RPCs and order flow                                            |
| 003_security_notifications_and_reconciliation.sql           | Security & notifications                                             |
| 004_enhanced_profile_fields.sql                             | Customer profile enhancements                                        |
| 005_guest_tracking_and_reviews.sql                          | Guest orders & reviews                                               |
| 006_email_automation.sql                                    | Email automation tables                                              |
| 007_email_automation_cron.sql                               | Weekly cleanup jobs (pg_cron)                                        |
| 008_email_automation_verification.sql                       | Email verification                                                   |
| 009_unsubscribe_system.sql                                  | One-click unsubscribe                                                |
| 010_chatbot_system.sql                                      | AI chatbot & support tickets                                         |
| 011_rate_limiting.sql                                       | Distributed rate limiting                                            |
| 012_production_hardening.sql                                | IDOR fixes, RPC hardening                                            |
| 013_payment_architecture.sql                                | payment_attempts / refunds / returns RLS                             |
| 014_harden_guest_order_rpc.sql                              | Guest order lookup hardening                                         |
| 015_fix_place_order_grants.sql                              | place_order grants                                                   |
| 016_revoke_anon_chatbot_rpcs.sql                            | Revoke anon chatbot RPC access                                       |
| 017_revert_place_order_grants.sql                           | Revert 015                                                           |
| 018_add_order_idempotency.sql                               | Order idempotency keys                                               |
| 019_fix_lookup_guest_order_grants.sql                       | Guest lookup grants                                                  |
| 020_secure_chat_and_ticket_views.sql                        | Chat/ticket view security                                            |
| 021_security_hardening.sql                                  | Further RPC hardening                                                |
| 022_fix_product_inventory_access.sql                        | Inventory access fix                                                 |
| 023_fix_security_definer_views.sql                          | SECURITY DEFINER view fixes                                          |
| 024_virtual_try_on_placeholder.sql                          | Try-on placeholder                                                   |
| 025_remove_virtual_try_on.sql                               | Remove try-on                                                        |
| 026_security_invoker_views.sql                              | security_invoker views                                               |
| 027_order_tracking_and_status_history.sql                   | Order status history                                                 |
| 028_fix_email_automation_rpcs.sql                           | Fix email RPC regressions                                            |
| 029_unsubscribe_per_type_and_email_log_status.sql           | Per-type unsubscribe                                                 |
| 030_discount_egp_reseed.sql                                 | Discount seed (EGP)                                                  |
| 031_wishlist_shares_review_helpful_and_inventory_grants.sql | Wishlist shares, review helpfulness                                  |
| 032_email_automation_cron_jobs.sql                          | HTTP cron: back-in-stock hourly, abandoned carts daily 10:00 UTC     |
| 033_review_columns_bundle_discounts_low_stock_search.sql    | Review photos/votes, BUNDLE10/COMEBACK10, stock view, search indexes |

## Environment Variables

Add to `.env`:

```
VITE_SUPABASE_URL=https://gfmxvvjqlhrnmidutjwx.supabase.co
your_removed_credential_here=your_supabase_anon_key_here
```

For Edge Functions, add to Supabase project secrets:

```
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL="NERVE <orders@nerveey.shop>"
STORE_URL=https://www.nerveey.shop
```

## Testing Migrations

***REMOVED***
# Test a specific migration
supabase db reset

# Reset and re-run all migrations
supabase db push --linked
```

## Troubleshooting

### "Cannot find project ref"

***REMOVED***
# Re-link the project
supabase link --project-ref gfmxvvjqlhrnmidutjwx

# Or list available projects
supabase projects list
```

### Migration Fails

***REMOVED***
# See detailed error
supabase db push --linked --debug

# Check database directly
supabase db shell
```

### Function Deployment Issues

***REMOVED***
# Check function logs
supabase functions fetch-logs create-order

# Deploy with debug info
supabase functions deploy --debug
```

## Production Deployment Checklist

- [ ] All migrations pushed to production (`supabase db push`, 001–033)
- [ ] All edge functions deployed
- [ ] Environment variables configured in Supabase
- [ ] Database backups enabled
- [ ] RLS policies verified
- [ ] pg_cron extension enabled (scheduled jobs from migrations 007 + 032)
- [ ] Email service configured (Resend — `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `STORE_URL`)
- [ ] Sentry error tracking enabled
- [ ] Analytics services configured
- [ ] SSL certificates verified
- [ ] Database connection limits set

## Useful Commands

***REMOVED***
# View project details
supabase projects describe gfmxvvjqlhrnmidutjwx

# Pull remote database schema
supabase db pull

# Push local migrations
supabase db push --linked

# Deploy functions
supabase functions deploy

# View real-time logs
supabase functions fetch-logs <function-name>

# Start/stop local development
supabase start
supabase stop

# Reset local database
supabase db reset

# Open Supabase dashboard
supabase projects describe gfmxvvjqlhrnmidutjwx --output json
```

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli/introduction)
- [Database Migrations](https://supabase.com/docs/guides/database/migrations)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [Row Level Security](https://supabase.com/docs/guides/security/row-level-security)

---

**All migrations and functions are ready to deploy!**
