# Store operations and recovery

## Deploy the reliability fixes

1. Back up the production database and verify the backup can be restored in a
   separate project. Preserve schema, data, storage objects and Auth configuration.
2. Run CI, including the isolated database job. Review migrations 054–057.
3. Apply migrations before deploying the new edge functions and frontend.
4. Deploy `create-order`, `verify-guest-order`, `process-order-notifications` and
   other changed functions, respecting `supabase/config.toml` JWT settings.
5. Set edge-function secrets `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `STORE_URL`,
   and a strong `CRON_SECRET` through Supabase settings. Set Vault entries named
   `SUPABASE_URL` (project URL) and `CRON_SECRET` (same worker secret). Never store
   their values in Git or logs.
6. Confirm pg_cron/pg_net are enabled and the `order_notifications_minutely` job
   runs. The worker returns 401 without its configured secret. Test a guest and
   signed-in order in a staging project before production rollout.

## Notifications

Guest tracking and one outbox job are inserted in the same database transaction
as the order. Checkout attempts immediate delivery; the minute worker recovers
failed sends. Claims use a five-minute lease and capped exponential backoff.
Provider idempotency reduces duplicates after a lost acknowledgement; delivery is
at least once, not guaranteed exactly once beyond the provider's retention window.
Do not exceed the lease with slow network requests.

Admins can inspect up to 100 pending jobs at `/admin/notifications`. Alert on jobs
with repeated failures or on any undelivered job older than ten minutes. Monitor
`cron.job_run_details`, worker HTTP errors and Resend delivery/bounce events using
your existing monitoring provider. External alert destinations must be configured
by the operator. There is no claim that production alerts are already enabled.

After fixing provider credentials, jobs retry automatically. A service-role operator
can set `available_at=now()` for a failed job after its lease has expired. Never
reset a live lease or delete orders to resend a confirmation. Initial deployment
does not enqueue historical orders automatically; reconcile any previously missing
confirmations before explicitly backfilling to avoid sending old receipts.

## Fulfillment and returns

Update orders through the admin status flow and provide the courier tracking
number and HTTPS tracking URL. Guest tracking shows the actual status and shipment
link. Carrier-specific label purchase, live courier APIs and SMS require a chosen
provider and credentials; they are not configured by these changes.

Approve return requests after reviewing eligibility, then complete them after the
returned goods are received. Completion changes the order to refunded and restocks
inventory atomically; failures leave the request unchanged. This is an order-level
return model. Record COD cash repayment separately: a status update does not move
money. Partial returns and exchanges need a separate item-level fulfillment design.

## Recovery

Prefer forward repair migrations over rolling back schema underneath running code.
For an incident, pause writes/deployment, retain logs without exporting credentials,
restore the verified backup into a separate project, apply the intended migrations,
and verify counts, inventory, Auth, order history and storage before switching
traffic. Reconcile orders accepted after the backup and pending email jobs before
resuming workers. Do not replay receipts or restock orders blindly.

The six-digit order-number space is finite. The sequence skips existing numbers
and never cycles; monitor its remaining capacity and plan a coordinated format
migration before exhaustion (tracking validation currently accepts six digits).
