# Store operations and recovery

## Deploy the reliability fixes

1. Back up the production database and verify the backup can be restored in a
   separate project. Preserve schema, data, storage objects and Auth configuration.
2. Run CI, including the isolated database job. Review migrations 054–061.
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

Customers can request selected original items and quantities, or same-product size
exchanges, from account order details. Verified guest tracking links expose the
same request flow. Returns use seven days from delivery; size exchanges use thirty.
Only one request can be active per order; completed/rejected requests allow another
request for the remaining original quantities. Before migrating existing data,
reconcile any orders with more than one pending/approved request: migration 058
intentionally rejects conflicting active requests rather than discarding them.

Complete a return after receiving its selected goods. Completion restocks only
those quantities and creates a COD repayment obligation. A partial return leaves
the order delivered; all returned original units can move it to refunded. Shipping
is not refunded for item-level requests. Discounted refunds use cumulative integer
allocation so repeated partial returns do not create rounding drift.

Size exchanges atomically restock the returned size and reserve the replacement
size. If replacement stock is unavailable, completion fails without changing stock
or request status. Record the replacement shipment on the Returns page; customers
can follow it from order details or the verified guest link. Each original unit
can be processed once; issues with an already-exchanged replacement require support.

The COD refunds page shows obligations, recorded repayments, receipt references
and remaining balances. Record money **already paid** to the customer; this action
does not transfer money. Reusing a receipt reference with the same obligation and
amount is safe after a lost response; overpayment and conflicting references fail.
Direct full-order COD refunds also create an obligation. Review an active return
through the Returns page rather than separately changing its order status. Historical refunded orders are
not automatically backfilled: reconcile actual repayments before creating old obligations.

## Automated validation and monitoring

CI runs on main, pull requests and fix branches. It starts disposable Supabase,
requires SQL assertions and concurrent checkout tests, tests a private backup in a
separate database, builds the sitemap against the local API, then exercises guest
and account checkout through local edge functions. Core browser checks use demo
mode; API-mocked admin/catalog tests run with a separate fixture-only server via
`playwright.mock.config.ts`. The desktop suites cover Chromium, Firefox and WebKit; dedicated mobile Chromium
checks exercise shopping, the filter drawer, accessibility and policy flows. A skipped credential-dependent case is not a live validation.

For a staging project, configure the protected GitHub `staging` environment with
`STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`,
`STAGING_SUPABASE_SERVICE_ROLE_KEY`, `STAGING_ADMIN_TEST_EMAIL`,
`STAGING_ADMIN_TEST_PASSWORD`, and the `STAGING_PROJECT_REF` variable. Deploy the
migrations/functions there before dispatching Staging validation. The smoke script
refuses remote writes unless the URL matches that explicit staging reference. It
creates and cleans its own fixtures; use a separate staging catalog and admin.

Production deployment requires successful push CI for the exact revision, checks
connection/hosted secret names, and deploys that revision without seeding catalog
products. Configure `SENTRY_DSN` for the existing alert integration. The worker
reports overdue confirmations, repeated delivery failures and aggregate outstanding
COD refunds. The Operations monitor workflow also checks the worker every ten
minutes, so a missing/broken minute job can be detected externally. Set the
production GitHub variable `OPS_WORKER_URL` to the HTTPS function URL and its
`CRON_SECRET` secret to the same securely configured worker secret. Missing settings
fail explicitly. Choose Sentry notification destinations and GitHub failure
notifications in their settings; no alert destination is assumed to be active.

## Recovery

Prefer forward repair migrations over rolling back schema underneath running code.
For an incident, pause writes/deployment, retain logs without exporting credentials,
restore the verified backup into a separate project, apply the intended migrations,
and verify counts, inventory, Auth, order history and storage before switching
traffic. Reconcile orders accepted after the backup and pending email jobs before
resuming workers. Do not replay receipts or restock orders blindly.

Order numbers now grow beyond six digits using the bigint sequence. Existing
numbers remain valid, as do tracking/resend links. New lookups accept 6–19 digits;
the sequence does not cycle. This removes the former six-digit capacity limit.

## Remaining external prerequisites

Hosted deployment and staging verification require project access and secure
settings. Live courier label purchase, status webhooks and SMS still require a
chosen provider, supported API contract and credentials. Manual shipment recording
works independently. Production backup/PITR enablement and storage/Auth restoration
must be verified in the actual hosted project; the automated local restore drill
does not prove production recovery readiness.
