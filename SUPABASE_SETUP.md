# Supabase Setup & Deployment Guide

## Prerequisites

1. **Supabase CLI installed**
   ```bash
   npm install -g supabase
   ```

2. **Supabase Account** - Create at https://supabase.com

3. **Access Token** - Generate from Supabase Dashboard > Settings > Access Tokens

## Step 1: Authenticate with Supabase CLI

```bash
supabase login
# Follow the prompts to authenticate
```

## Step 2: Link Project to Local Development

The project is already linked to the Supabase project `Nerve` (ref: `tlzsipeyxrkvpjfcyssw`).

To verify linking:
```bash
supabase projects list
```

You should see the Nerve project listed.

## Step 3: Push Migrations to Supabase

```bash
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

```bash
# Deploy all edge functions
supabase functions deploy

# Or deploy specific function
supabase functions deploy create-order
```

Functions included:
- `create-order` - Place orders (COD only)
- `send-email` - Send transactional emails
- `handle-unsubscribe` - One-click unsubscribe
- `process-abandoned-carts` - Cart recovery emails
- `update-order-status` - Order status updates
- `process-restocks` - Back-in-stock notifications

## Current Setup

✅ **Linked to Supabase Project:**
- Project Name: `Nerve`
- Project Ref: `tlzsipeyxrkvpjfcyssw`
- Region: North EU (Stockholm)

✅ **Configuration Files:**
- `.supabase/config.json` - Supabase config with function definitions
- `supabase/migrations/` - 11 migrations with all schema
- `supabase/functions/` - 6 edge functions

✅ **Local Development:**
```bash
# Start local Supabase instance
supabase start

# Stop local instance
supabase stop

# View logs
supabase logs
```

## Migrations Overview

| Migration | Purpose |
|-----------|---------|
| 001_schema.sql | Core tables (products, orders, customers, etc.) |
| 002_orders_rpc_and_extras.sql | Order RPCs and order flow |
| 003_security_notifications_and_reconciliation.sql | Security & notifications |
| 004_enhanced_profile_fields.sql | Customer profile enhancements |
| 005_guest_tracking_and_reviews.sql | Guest orders & reviews |
| 006_email_automation.sql | Email automation tables |
| 007_email_automation_cron.sql | Scheduled cleanup jobs |
| 008_email_automation_verification.sql | Email verification |
| 009_unsubscribe_system.sql | One-click unsubscribe |
| 010_chatbot_system.sql | AI chatbot & support tickets |
| 011_rate_limiting.sql | Distributed rate limiting |

## Environment Variables

Add to `.env`:
```
VITE_SUPABASE_URL=https://tlzsipeyxrkvpjfcyssw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

For Edge Functions, add to Supabase project settings:
```
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@nerve.shop
```

## Testing Migrations

```bash
# Test a specific migration
supabase db reset

# Reset and re-run all migrations
supabase db push --linked
```

## Troubleshooting

### "Cannot find project ref"
```bash
# Re-link the project
supabase link --project-ref tlzsipeyxrkvpjfcyssw

# Or list available projects
supabase projects list
```

### Migration Fails
```bash
# See detailed error
supabase db push --linked --debug

# Check database directly
supabase db shell
```

### Function Deployment Issues
```bash
# Check function logs
supabase functions fetch-logs create-order

# Deploy with debug info
supabase functions deploy --debug
```

## Production Deployment Checklist

- [ ] All migrations pushed to production
- [ ] All edge functions deployed
- [ ] Environment variables configured in Supabase
- [ ] Database backups enabled
- [ ] RLS policies verified
- [ ] pg_cron extension enabled (if using scheduled jobs)
- [ ] Email service configured (SendGrid)
- [ ] Sentry error tracking enabled
- [ ] Analytics services configured
- [ ] SSL certificates verified
- [ ] Database connection limits set

## Useful Commands

```bash
# View project details
supabase projects describe tlzsipeyxrkvpjfcyssw

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
supabase projects describe tlzsipeyxrkvpjfcyssw --output json
```

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli/introduction)
- [Database Migrations](https://supabase.com/docs/guides/database/migrations)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [Row Level Security](https://supabase.com/docs/guides/security/row-level-security)

---

**All migrations and functions are ready to deploy!**
