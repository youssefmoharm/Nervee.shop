# 📋 Email Automation - Deployment Checklist

Complete this checklist to deploy the email automation system.

---

## Phase 1: Pre-Deployment (5 min)

- [ ] Read `EMAIL_AUTOMATION_README.md` (quick overview)
- [ ] Review `EMAIL_AUTOMATION_SETUP.md` (understand steps)
- [ ] Ensure you have Supabase project access
- [ ] Ensure you have Resend account (resend.com)
- [ ] Get Resend API key from https://resend.com/api-keys

---

## Phase 2: Database Setup (3 min)

### Deploy Migrations
```bash
cd nerve
supabase migration up  # Deploys 006, 007, 008
```

- [ ] Migration 006 complete (tables created)
- [ ] Migration 007 complete (cron setup)
- [ ] Migration 008 complete (verification queries)
- [ ] No migration errors in logs

### Verify Tables Exist
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('newsletter_subscribers', 'email_logs', 'back_in_stock_requests', 'cart_abandonment_tracking');
```

- [ ] 4 tables visible in query result
- [ ] All tables have RLS enabled

---

## Phase 3: pg_cron Extension (2 min)

### Enable pg_cron
1. Go to Supabase Dashboard > Database > Extensions
2. Search for "pg_cron"
3. Click "Install extension"
4. Wait for green checkmark

- [ ] pg_cron extension installed
- [ ] Query `SELECT * FROM cron.job;` returns no errors

---

## Phase 4: Deploy Edge Functions (3 min)

### Deploy Each Function
```bash
supabase functions deploy send-email --no-verify
supabase functions deploy process-abandoned-carts --no-verify
supabase functions deploy send-back-in-stock --no-verify
```

### Verify in Dashboard
Go to Supabase Dashboard > Edge Functions

- [ ] send-email deployed successfully
- [ ] process-abandoned-carts deployed successfully
- [ ] send-back-in-stock deployed successfully
- [ ] No errors in function logs

---

## Phase 5: Set Environment Secrets (2 min)

### Set Secrets
```bash
supabase secrets set RESEND_API_KEY=re_YOUR_KEY_HERE
supabase secrets set RESEND_FROM_EMAIL="NERVE <orders@yourdomain.com>"
supabase secrets set STORE_URL="https://nerveey.shop"
```

### Verify Secrets
```bash
supabase secrets list
```

- [ ] RESEND_API_KEY visible (value hidden)
- [ ] RESEND_FROM_EMAIL visible
- [ ] STORE_URL visible
- [ ] All secrets successfully set

---

## Phase 6: Test Email Sending (2 min)

### Manual Test via curl
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/send-email \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test from NERVE",
    "html": "<h1>Hello!</h1><p>Email automation works!</p>",
    "type": "test"
  }'
```

- [ ] Curl command executes (check for success response)
- [ ] Email appears in email_logs table
- [ ] Status is "sent" (not "failed")
- [ ] Test email received in inbox

---

## Phase 7: Verify Cron Jobs (2 min)

### Check Registered Jobs
```sql
SELECT jobname, schedule, command FROM cron.job 
WHERE jobname IN ('process_abandoned_carts', 'cleanup_old_email_logs', 'cleanup_old_cart_tracking');
```

- [ ] 3 jobs visible
- [ ] process_abandoned_carts: "0 */4 * * *"
- [ ] cleanup_old_email_logs: "0 3 * * 1"
- [ ] cleanup_old_cart_tracking: "0 4 * * 1"

---

## Phase 8: Run Verification Suite (3 min)

From migration 008, run these verification queries:

```sql
-- 1. Check tables exist
-- Expected: 4 tables

-- 2. Verify RLS enabled
-- Expected: 4 rows, all rls_enabled = true

-- 3. Verify functions exist
-- Expected: 6 functions

-- 4. Verify pg_cron installed
-- Expected: 1 row with pg_cron

-- 5. Check scheduled jobs
-- Expected: 3 jobs
```

- [ ] All verification queries pass
- [ ] No errors or missing objects
- [ ] Database structure is complete

---

## Phase 9: Update Frontend Service (1 min)

### File Already Updated
The file `src/lib/emailAutomation.ts` has been completely rewritten:

- [ ] Review updated service file
- [ ] Verify no TypeScript errors
- [ ] Check new methods are available:
  - [ ] `subscribeToNewsletter()`
  - [ ] `trackCartActivity()`
  - [ ] `requestBackInStockNotification()`
  - [ ] `markCartAsRecovered()`

---

## Phase 10: Integration Planning (5 min)

Review `EMAIL_AUTOMATION_INTEGRATION.md` for code examples:

- [ ] Newsletter component integration (copy code)
- [ ] Cart context integration (copy code)
- [ ] Product detail back-in-stock (copy code)
- [ ] Checkout cart recovery (copy code)
- [ ] Admin dashboard (optional)

---

## Phase 11: Component Updates (30 min)

### Update Components One by One

#### Newsletter.tsx
```typescript
import { emailAutomation } from '../lib/emailAutomation'
// Add newsletter subscription logic
```

- [ ] Newsletter component updated
- [ ] Uses emailAutomation service
- [ ] No TypeScript errors
- [ ] Test signup manually

#### CartContext.tsx
```typescript
// Add cart activity tracking
emailAutomation.trackCartActivity(email, items, cartValue)
```

- [ ] Cart context updated
- [ ] Tracks activity on changes
- [ ] No TypeScript errors
- [ ] Test adding items to cart

#### ProductDetail.tsx
```typescript
// Add back-in-stock button
handleBackInStockRequest()
```

- [ ] Back-in-stock button added
- [ ] Button shows when out of stock
- [ ] No TypeScript errors
- [ ] Test requesting notification

#### Checkout Flow
```typescript
// Mark cart as recovered
await emailAutomation.markCartAsRecovered(orderEmail)
```

- [ ] Recovery marking added
- [ ] Called after order placement
- [ ] No TypeScript errors
- [ ] Test checkout flow

---

## Phase 12: Testing & Validation (10 min)

### Manual Testing

#### Test 1: Newsletter Signup
1. Go to Newsletter section
2. Enter email
3. Click Subscribe
4. Check email inbox for welcome

- [ ] Newsletter signup works
- [ ] Welcome email received
- [ ] Entry in newsletter_subscribers table
- [ ] Entry in email_logs table

#### Test 2: Cart Abandonment (24-hour wait)
1. Add items to cart
2. Wait 24+ hours (or manually update timestamp)
3. Check if abandonment email sent

- [ ] Cart tracked in cart_abandonment_tracking
- [ ] Email sent after 24 hours
- [ ] Entry in email_logs
- [ ] Email received (with COMEBACK10 code)

#### Test 3: Back-in-Stock
1. Add request for out-of-stock product
2. Manually trigger send-back-in-stock function
3. Check email

- [ ] Request saved in back_in_stock_requests
- [ ] Email sent
- [ ] Request marked as notified
- [ ] Email received

#### Test 4: Admin Dashboard
1. View email analytics
2. Check email_logs table
3. Review statistics

- [ ] Dashboard displays metrics
- [ ] Email counts are correct
- [ ] Success rates calculated
- [ ] Recent failures shown

---

## Phase 13: Production Hardening (5 min)

### Security Review
- [ ] All secrets are set
- [ ] RLS policies verified
- [ ] Rate limiting tested
- [ ] Input validation working

### Monitoring Setup
- [ ] Email_logs table monitored
- [ ] Cron job logs checked
- [ ] Edge Function logs reviewed
- [ ] Error alerts configured (optional)

### Documentation
- [ ] Team updated on new system
- [ ] Integration guide shared
- [ ] Support contacts assigned
- [ ] Runbook created

---

## Phase 14: Launch & Monitoring (Ongoing)

### Launch Steps
- [ ] Announce to team
- [ ] Enable newsletter signup prominently
- [ ] Monitor first 24 hours
- [ ] Check email delivery

### Daily Monitoring
- [ ] Check email_logs for errors
- [ ] Verify cron jobs running
- [ ] Monitor success rate
- [ ] Check failure messages

### Weekly Review
- [ ] Generate email statistics report
- [ ] Review campaign performance
- [ ] Check for patterns
- [ ] Optimize send times

---

## Post-Launch Optimization (Optional)

- [ ] A/B test email subjects
- [ ] Customize email templates
- [ ] Adjust cron schedules based on volume
- [ ] Add email preference center
- [ ] Implement unsubscribe page
- [ ] Add SMS notifications
- [ ] Build detailed analytics dashboard

---

## Rollback Plan (If Needed)

If something breaks:

1. **Check Error Logs**
   - Supabase Edge Functions logs
   - email_logs table
   - cron.job_run_details

2. **Common Issues**
   - Email not sending → Check RESEND_API_KEY
   - Cron not running → Check pg_cron installed
   - Cart not tracking → Check CartContext integration
   - Newsletter signup fails → Check table permissions

3. **Rollback Steps**
   ```bash
   # Disable cron jobs temporarily
   SELECT cron.unschedule('process_abandoned_carts');
   
   # Keep data intact, pause sends
   # Don't delete tables!
   
   # Debug and fix
   # Re-enable when ready
   ```

---

## Success Criteria

After deployment, verify:

- ✅ Newsletter signups working
- ✅ Cart tracking happening
- ✅ Abandonment emails sent (after 24h)
- ✅ Back-in-stock notifications working
- ✅ All emails in logs table
- ✅ Cron jobs running on schedule
- ✅ No errors in logs
- ✅ Admin can view analytics

---

## Timeline Summary

| Phase | Time | Action |
|-------|------|--------|
| Pre-Deployment | 5 min | Review & prepare |
| Database | 3 min | Run migrations |
| pg_cron | 2 min | Enable extension |
| Edge Functions | 3 min | Deploy 3 functions |
| Secrets | 2 min | Set environment variables |
| Email Test | 2 min | Send test email |
| Verify | 3 min | Run verification queries |
| Frontend | 1 min | Review service updates |
| Planning | 5 min | Review integration guide |
| Components | 30 min | Update React components |
| Testing | 10 min | Manual feature tests |
| Production | 5 min | Security review |
| **Total** | **~75 min** | **Full deployment** |

---

## Support Resources

| Issue | Resource |
|-------|----------|
| Setup help | EMAIL_AUTOMATION_SETUP.md |
| Code examples | EMAIL_AUTOMATION_INTEGRATION.md |
| Quick ref | EMAIL_AUTOMATION_SUMMARY.md |
| Architecture | EMAIL_AUTOMATION_README.md |
| Testing | Migration 008 queries |
| Errors | Check email_logs table |

---

## Database Backup & Restore

Supabase hosts your Postgres database, but you own the data. Do NOT rely on
the hosted region alone — configure at least one off-site copy.

### Recommended setup (weekly, automated)
1. Enable the built-in daily backups in Supabase Dashboard
   (Project Settings > Database > Backups). Keeps 7 daily + weekly snapshots.
2. Add a scheduled off-site export (cron / GitHub Action) that runs weekly and
   stores the dump somewhere outside Supabase (S3, GitHub releases, or private
   storage):
   ```bash
   # Requires SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF (GitHub secrets)
   supabase db dump --project-ref $SUPABASE_PROJECT_REF -f supabase-backup.sql
   ```
3. Test a restore at least quarterly on a throwaway project:
   ```bash
   supabase db push --db-url <scratch-db-url> --include-all
   ```
4. For the edge functions' secrets (RESEND_API_KEY, STORE_URL, etc.), keep a
   password-managed copy — they are not part of the DB dump.

### RPO / RTO targets
- **RPO (max data loss):** 24 h (daily backup) — tighten to hourly if order
  volume grows.
- **RTO (max downtime):** 2–4 h from the off-site dump.

### Known pitfalls
- `supabase db dump` does NOT back up storage buckets (product images).
  Re-upload those from originals or snapshot the `storage.objects` rows.
- Secrets and env vars live in the Dashboard / GitHub, not the database.

---

## Sign-Off

When complete, checkmark these:

- [ ] All phases completed
- [ ] Tests passing
- [ ] Team trained
- [ ] Documentation shared
- [ ] Monitoring configured
- [ ] Go-live approved

---

**🚀 You're Ready to Launch!**

Follow this checklist top-to-bottom and you'll have a fully functional email automation system in ~75 minutes.

Start with Phase 1 now! 📧✨
