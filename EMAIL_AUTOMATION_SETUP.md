# Email Automation Implementation Guide

## Overview

The NERVE email automation system is now fully implemented with server-side sending, database tracking, and scheduled jobs for cart abandonment and back-in-stock notifications.

## What's Been Implemented

### 1. Database Schema (Migration 006)
- **newsletter_subscribers** - Tracks newsletter signups
- **email_logs** - Logs all sent emails for analytics and debugging
- **back_in_stock_requests** - Stores customer requests for out-of-stock product notifications
- **cart_abandonment_tracking** - Tracks inactive carts for recovery emails

RLS policies ensure data privacy and proper access control.

### 2. Edge Functions

#### `send-email` (Main Email Service)
- **Purpose**: Secure server-side email sending via Resend API
- **Route**: `/functions/v1/send-email`
- **Method**: POST
- **Features**:
  - Rate limiting (50 emails/min per IP)
  - Comprehensive input validation
  - Automatic email logging to database
  - Request size validation
  - CORS enabled

**Request Body**:
```json
{
  "to": "customer@example.com",
  "subject": "Your Order Confirmation",
  "html": "<html>...</html>",
  "type": "order_confirmation",
  "metadata": { "order_id": "...", "total": 1250 }
}
```

#### `process-abandoned-carts` (Scheduled Job)
- **Purpose**: Detect and email abandoned carts every 4 hours
- **Trigger**: Scheduled via pg_cron (0 */4 * * *)
- **Process**:
  1. Finds carts inactive for 24+ hours
  2. Generates recovery email with 10% discount code
  3. Sends via `send-email` Edge Function
  4. Marks cart abandonment as emailed
  5. Logs metrics

#### `send-back-in-stock` (On-Demand)
- **Purpose**: Send back-in-stock notifications when inventory changes
- **Trigger**: Called when product inventory is restocked
- **Process**:
  1. Finds all customers who requested notifications
  2. Sends personalized back-in-stock email
  3. Marks notification as sent
  4. Deactivates the request

### 3. Frontend Service (Updated)
- **File**: `src/lib/emailAutomation.ts`
- **New Methods**:
  - `sendCartAbandonmentEmail()` - Triggers cart recovery email
  - `subscribeToNewsletter()` - Adds to newsletter_subscribers table + sends welcome
  - `requestBackInStockNotification()` - Records back-in-stock request
  - `trackCartActivity()` - Updates cart abandonment tracker
  - `markCartAsRecovered()` - Marks cart as purchased (prevents duplicate emails)

### 4. Scheduled Jobs (Migration 007)
Requires `pg_cron` extension enabled on Supabase:

1. **process_abandoned_carts** - Every 4 hours
   - Finds 24+ hour abandoned carts
   - Sends recovery emails
   - Cleans up sent records

2. **cleanup_old_email_logs** - Weekly (Monday 3 AM UTC)
   - Deletes email logs older than 90 days
   - Saves database storage

3. **cleanup_old_cart_tracking** - Weekly (Monday 4 AM UTC)
   - Deletes old cart abandonment records
   - Keeps last 30 days

## Setup Instructions

### Step 1: Run Migrations

```bash
# Deploy migration 006 (email automation tables)
supabase migration up

# Deploy migration 007 (pg_cron scheduled jobs)
supabase migration up
```

### Step 2: Enable pg_cron Extension

1. Go to **Database > Extensions** in Supabase dashboard
2. Search for `pg_cron`
3. Click **Install extension**
4. Wait for installation to complete

### Step 3: Deploy Edge Functions

```bash
# Deploy send-email function
supabase functions deploy send-email --no-verify

# Deploy cart abandonment processor
supabase functions deploy process-abandoned-carts --no-verify

# Deploy back-in-stock notifier
supabase functions deploy send-back-in-stock --no-verify
```

### Step 4: Set Environment Variables

In Vercel/your deployment platform, add:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

In Supabase Edge Function secrets:
```bash
supabase secrets set RESEND_API_KEY=re_xxxxx
supabase secrets set RESEND_FROM_EMAIL="NERVE <orders@yourdomain.com>"
supabase secrets set STORE_URL="https://nerve-store.com"
```

### Step 5: Verify Scheduled Jobs

Check that cron jobs are registered:

```sql
SELECT * FROM cron.job;
```

Expected output:
- `process_abandoned_carts` - 0 */4 * * *
- `cleanup_old_email_logs` - 0 3 * * 1
- `cleanup_old_cart_tracking` - 0 4 * * 1

## Usage Examples

### Track Cart Activity (from Cart Context/Hook)
```typescript
import { emailAutomation, useCartAbandonmentTracking } from './lib/emailAutomation'

// When cart changes
useEffect(() => {
  if (cart.length > 0 && email) {
    emailAutomation.trackCartActivity(
      email,
      cart,
      cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    )
  }
}, [cart, email])
```

### Subscribe to Newsletter
```typescript
const { subscribeToNewsletter } = emailAutomation

const handleSubscribe = async (email: string, firstName?: string) => {
  const success = await subscribeToNewsletter({
    email,
    firstName
  })
  
  if (success) {
    toast.success('Welcome to our newsletter!')
  }
}
```

### Request Back-in-Stock Notification
```typescript
const handleBackInStockRequest = async () => {
  const success = await emailAutomation.requestBackInStockNotification(
    productId,
    userEmail,
    selectedSize
  )
  
  if (success) {
    toast.success('We\'ll notify you when it\'s back in stock!')
  }
}
```

### Mark Cart as Recovered (on order placement)
```typescript
// In checkout/order completion
await emailAutomation.markCartAsRecovered(customerEmail)
```

## Database Schema

### newsletter_subscribers
```sql
id (UUID)
email (TEXT, UNIQUE)
first_name (TEXT)
is_active (BOOLEAN)
subscribed_at (TIMESTAMPTZ)
unsubscribed_at (TIMESTAMPTZ)
created_at (TIMESTAMPTZ)
updated_at (TIMESTAMPTZ)
```

### email_logs
```sql
id (UUID)
recipient_email (TEXT)
email_type (TEXT) -- 'welcome', 'cart_abandonment', 'back_in_stock', etc.
subject (TEXT)
sent_at (TIMESTAMPTZ)
opened_at (TIMESTAMPTZ)  -- for future email tracking
clicked_at (TIMESTAMPTZ) -- for future click tracking
status (TEXT) -- 'pending', 'sent', 'failed', 'bounced'
error_message (TEXT)
metadata (JSONB) -- custom data
created_at (TIMESTAMPTZ)
```

### back_in_stock_requests
```sql
id (UUID)
product_id (TEXT, FK)
customer_email (TEXT)
size (TEXT) -- optional
requested_at (TIMESTAMPTZ)
notified_at (TIMESTAMPTZ)
is_active (BOOLEAN)
```

### cart_abandonment_tracking
```sql
id (UUID)
customer_email (TEXT)
cart_items (JSONB) -- stored cart contents
cart_value (INTEGER) -- in EGP cents
last_activity_at (TIMESTAMPTZ)
email_sent_at (TIMESTAMPTZ)
recovered_at (TIMESTAMPTZ)
created_at (TIMESTAMPTZ)
updated_at (TIMESTAMPTZ)
```

## Email Types

The system tracks and sends the following email types:

1. **welcome** - New newsletter subscriber
2. **cart_abandonment** - 24+ hour inactive cart
3. **back_in_stock** - Product restocked
4. **order_confirmation** - Order placed (via existing order system)
5. **order_shipped** - Tracking number sent
6. **order_delivered** - Delivery confirmation

## Analytics & Reporting

### View Email Send Statistics
```sql
SELECT 
  email_type,
  COUNT(*) as count,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM email_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY email_type;
```

### View Newsletter Subscribers
```sql
SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active = true;
```

### View Pending Back-in-Stock Requests
```sql
SELECT 
  bisr.product_id,
  p.name,
  bisr.size,
  COUNT(bisr.id) as subscribers
FROM back_in_stock_requests bisr
JOIN products p ON bisr.product_id = p.id
WHERE bisr.is_active = true AND bisr.notified_at IS NULL
GROUP BY bisr.product_id, p.name, bisr.size;
```

### View Recent Abandoned Carts
```sql
SELECT 
  customer_email,
  cart_value,
  last_activity_at,
  email_sent_at
FROM cart_abandonment_tracking
WHERE recovered_at IS NULL
ORDER BY last_activity_at DESC
LIMIT 20;
```

## Troubleshooting

### Emails not sending?
1. Check RESEND_API_KEY is set in Supabase secrets
2. Verify email_logs table for failed entries
3. Check Edge Function logs: Supabase > Edge Functions > send-email
4. Verify Resend account is active and not rate limited

### Cron jobs not running?
1. Verify pg_cron extension is installed: `SELECT * FROM cron.job;`
2. Check cron job logs: `SELECT * FROM cron.job_run_details;`
3. Ensure STORE_URL secret is set
4. Check Edge Function logs for process-abandoned-carts

### Cart abandonment emails not being sent?
1. Verify cart_abandonment_tracking has entries
2. Check email_logs for attempts
3. Ensure carts are inactive for 24+ hours (test with manual SQL)
4. Check process-abandoned-carts Edge Function logs

## Future Enhancements

- [ ] Email open tracking (via pixel tracking in Resend)
- [ ] Click tracking on emails
- [ ] A/B testing for email subject lines
- [ ] Unsubscribe management UI
- [ ] Email preference center
- [ ] SMS notifications as alternative
- [ ] AI-powered personalization
- [ ] Dynamic content based on purchase history
- [ ] Win-back campaigns for inactive customers
- [ ] Referral email campaigns

## Cost Considerations

- **Resend API**: ~$0.0005 per email (first 1000/month free for Resend trial)
- **Supabase Edge Functions**: Included in Pro plan
- **Database Storage**: Email logs add ~500 bytes per email
- **Bandwidth**: Minimal (just API calls)

For 10,000 emails/month:
- Resend: ~$5
- Supabase: Included
- Total: ~$5

## Support

For issues or questions:
1. Check Edge Function logs in Supabase dashboard
2. Review email_logs table for error details
3. Check cron.job_run_details for scheduled job failures
4. Inspect network tab for client-side email submission errors
