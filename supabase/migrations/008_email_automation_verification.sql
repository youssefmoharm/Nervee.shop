-- NERVE Email Automation - Verification & Testing Queries
--
-- NOTE: This file is documentation only. Every query below is commented out
-- because this is a verification/reference script, NOT schema DDL. Running it
-- through `supabase db push` used to fail because some SELECTs reference
-- pg_cron internals (e.g. cron.job_run_details.job_id) whose column names vary
-- by pg_cron version. None of it changes the schema, so it must be a no-op
-- migration. Paste the queries you need into the Supabase SQL Editor manually.

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- 1. Verify tables exist
-- SELECT
--   table_name,
--   (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
-- FROM information_schema.tables AS t
-- WHERE table_schema = 'public'
-- AND table_name IN ('newsletter_subscribers', 'email_logs', 'back_in_stock_requests', 'cart_abandonment_tracking')
-- ORDER BY table_name;
--
-- Expected output: 4 tables (newsletter_subscribers, email_logs, back_in_stock_requests, cart_abandonment_tracking)

-- ============================================================================

-- 2. Verify RLS is enabled on all tables
-- SELECT
--   tablename,
--   (SELECT rowsecurity FROM pg_tables WHERE tablename = t.tablename) as rls_enabled
-- FROM pg_tables t
-- WHERE schemaname = 'public'
-- AND tablename IN ('newsletter_subscribers', 'email_logs', 'back_in_stock_requests', 'cart_abandonment_tracking')
-- ORDER BY tablename;
--
-- Expected output: 4 rows, all with rls_enabled = true

-- ============================================================================

-- 3. Verify indexes exist
-- SELECT
--   tablename,
--   indexname
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- AND tablename IN ('newsletter_subscribers', 'email_logs', 'back_in_stock_requests', 'cart_abandonment_tracking')
-- ORDER BY tablename, indexname;
--
-- Expected output: Multiple indexes per table for performance

-- ============================================================================

-- 4. Verify functions exist
-- SELECT
--   routine_name,
--   routine_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
-- AND routine_name IN ('log_email_send', 'mark_back_in_stock_notified', 'find_abandoned_carts_for_email', 'mark_cart_abandonment_email_sent', 'mark_cart_abandonment_recovered', 'find_back_in_stock_notifications')
-- ORDER BY routine_name;
--
-- Expected output: 6 functions

-- ============================================================================

-- 5. Verify pg_cron is installed
-- SELECT
--   extname,
--   extversion
-- FROM pg_extension
-- WHERE extname = 'pg_cron';
--
-- Expected output: 1 row (pg_cron, version number)
-- If no output: pg_cron not installed - enable it in Supabase dashboard

-- ============================================================================

-- 6. Verify scheduled jobs (if pg_cron is installed)
-- SELECT
--   jobname,
--   schedule,
--   command
-- FROM cron.job
-- WHERE jobname IN ('process_abandoned_carts', 'cleanup_old_email_logs', 'cleanup_old_cart_tracking')
-- ORDER BY jobname;
--
-- Expected output: 3 scheduled jobs
-- Note: Will error if pg_cron not installed

-- ============================================================================

-- 7. Check recent scheduled job runs
-- NOTE: column names on cron.job_run_details differ by pg_cron version
-- (job_id/job_name on newer, jobid on older). Adapt to yours.
-- SELECT
--   job_id,
--   job_name,
--   start_time,
--   end_time,
--   status,
--   return_message
-- FROM cron.job_run_details
-- WHERE job_name IN ('process_abandoned_carts', 'cleanup_old_email_logs', 'cleanup_old_cart_tracking')
-- ORDER BY start_time DESC
-- LIMIT 10;
--
-- Expected output: Job run history
-- Note: Will be empty until jobs run for the first time

-- ============================================================================
-- TEST DATA & MANUAL TESTING
-- NOTE: These inserts are for local/manual verification only. They are
-- commented out because they reference placeholder product IDs and ON CONFLICT
-- targets that do not exist in a clean database, which would break
-- `supabase db push` (CI/Preview). Uncomment and adjust for manual testing.
-- ============================================================================

-- 8. Insert test newsletter subscriber
-- INSERT INTO newsletter_subscribers (email, first_name, is_active)
-- VALUES ('test-newsletter@example.com', 'John', true)
-- ON CONFLICT (email) DO UPDATE SET is_active = true;

-- 9. Insert test back-in-stock request
-- INSERT INTO back_in_stock_requests (product_id, customer_email, size, is_active)
-- VALUES ('product-001', 'test-backstock@example.com', 'M', true)
-- ON CONFLICT (product_id, customer_email, size) DO UPDATE SET is_active = true;

-- 10. Insert test cart abandonment
-- INSERT INTO cart_abandonment_tracking (customer_email, cart_items, cart_value, last_activity_at)
-- VALUES (
--   'test-cart@example.com',
--   '[
--     {
--       "id": "product-001",
--       "name": "Classic T-Shirt",
--       "size": "M",
--       "color": "Black",
--       "quantity": 2,
--       "price": 500,
--       "image": "https://example.com/shirt.jpg"
--     }
--   ]'::jsonb,
--   1000,
--   NOW() - INTERVAL '25 hours'  -- More than 24 hours ago for abandonment detection
-- )
-- ON CONFLICT (customer_email) DO UPDATE SET
--   last_activity_at = NOW() - INTERVAL '25 hours',
--   email_sent_at = NULL;  -- Reset to allow re-sending

-- ============================================================================

-- 11. Query test data
-- SELECT 'Newsletter' as type, COUNT(*) as count FROM newsletter_subscribers
-- UNION ALL
-- SELECT 'Email Logs', COUNT(*) FROM email_logs
-- UNION ALL
-- SELECT 'Back-in-Stock Requests', COUNT(*) FROM back_in_stock_requests
-- UNION ALL
-- SELECT 'Cart Abandonments', COUNT(*) FROM cart_abandonment_tracking;

-- ============================================================================
-- ANALYTICS QUERIES
-- ============================================================================

-- 12. Email send statistics (last 30 days)
-- SELECT
--   email_type,
--   COUNT(*) as total,
--   SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
--   SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
--   ROUND(100.0 * SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
-- FROM email_logs
-- WHERE created_at > NOW() - INTERVAL '30 days'
-- GROUP BY email_type
-- ORDER BY total DESC;

-- ============================================================================

-- 13. Recent email logs with errors
-- SELECT
--   recipient_email,
--   email_type,
--   subject,
--   status,
--   error_message,
--   sent_at
-- FROM email_logs
-- WHERE status IN ('failed', 'bounced')
-- ORDER BY sent_at DESC
-- LIMIT 20;

-- ============================================================================

-- 14. Active newsletter subscribers
-- SELECT
--   COUNT(*) as total_subscribers,
--   COUNT(DISTINCT DATE(subscribed_at)) as days_active
-- FROM newsletter_subscribers
-- WHERE is_active = true;

-- ============================================================================

-- 15. Abandoned carts awaiting recovery
-- SELECT
--   customer_email,
--   json_array_length(cart_items) as item_count,
--   cart_value / 100.0 as cart_value_egp,
--   AGE(NOW(), last_activity_at) as time_since_activity,
--   email_sent_at,
--   recovered_at
-- FROM cart_abandonment_tracking
-- WHERE recovered_at IS NULL
-- ORDER BY last_activity_at DESC;

-- ============================================================================

-- 16. Pending back-in-stock notifications
-- SELECT
--   bisr.product_id,
--   p.name as product_name,
--   bisr.size,
--   COUNT(bisr.id) as customer_count,
--   MIN(bisr.requested_at) as oldest_request
-- FROM back_in_stock_requests bisr
-- LEFT JOIN products p ON bisr.product_id = p.id
-- WHERE bisr.is_active = true AND bisr.notified_at IS NULL
-- GROUP BY bisr.product_id, p.name, bisr.size
-- ORDER BY customer_count DESC;

-- ============================================================================

-- 17. Email delivery performance (by hour of day)
-- SELECT
--   DATE_TRUNC('hour', sent_at) as hour,
--   COUNT(*) as total,
--   SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as delivered
-- FROM email_logs
-- WHERE created_at > NOW() - INTERVAL '7 days'
-- GROUP BY DATE_TRUNC('hour', sent_at)
-- ORDER BY hour DESC;

-- ============================================================================
-- CLEANUP QUERIES (use with caution!)
-- ============================================================================

-- 18. Delete old test data
-- DELETE FROM newsletter_subscribers WHERE email LIKE 'test-%@example.com';
-- DELETE FROM email_logs WHERE created_at < NOW() - INTERVAL '90 days';
-- DELETE FROM cart_abandonment_tracking WHERE created_at < NOW() - INTERVAL '30 days';

-- ============================================================================
-- MANUAL EDGE FUNCTION TESTING
-- ============================================================================

-- To test the send-email Edge Function manually, use:
--
-- curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/send-email \
--   -H "Authorization: Bearer YOUR_ANON_KEY" \
--   -H "Content-Type: application/json" \
--   -d '{
--     "to": "test@example.com",
--     "subject": "Test Email from NERVE",
--     "html": "<h1>Hello!</h1><p>This is a test email from NERVE automation system.</p>",
--     "type": "test",
--     "metadata": { "test": true }
--   }'
--
-- Expected response:
-- {
--   "success": true,
--   "message": "Email sent successfully",
--   "to": "test@example.com",
--   "type": "test"
-- }

-- ============================================================================
-- DEBUGGING
-- ============================================================================

-- 19. Check Edge Function logs
-- Go to: Supabase Dashboard > Edge Functions > Logs
-- View logs for: send-email, process-abandoned-carts, send-back-in-stock

-- 20. Check environment secrets are set
-- Go to: Supabase Dashboard > Settings > Secrets
-- Verify these are present:
-- - RESEND_API_KEY
-- - RESEND_FROM_EMAIL
-- - STORE_URL

-- ============================================================================
-- PERFORMANCE MONITORING
-- ============================================================================

-- 21. Check table sizes
-- SELECT
--   tablename,
--   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('newsletter_subscribers', 'email_logs', 'back_in_stock_requests', 'cart_abandonment_tracking')
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================

-- 22. Check active queries
-- SELECT pid, usename, application_name, state, query FROM pg_stat_activity
-- WHERE state != 'idle'
-- ORDER BY query_start DESC;

-- ============================================================================
-- TROUBLESHOOTING CHECKLIST
-- ============================================================================

-- Run these in order to diagnose issues:
-- 1. Tables exist?            -> Query #1 above
-- 2. RLS enabled?             -> Query #2 above
-- 3. Functions exist?         -> Query #4 above
-- 4. pg_cron installed?       -> Query #5 above
-- 5. Cron jobs registered?    -> Query #6 above
-- 6. Any test data?           -> Query #11 above
-- 7. Recent email attempts?   -> Query #13 above (check for error messages)
-- 8. Edge Function errors?    -> Check Edge Function logs in Supabase dashboard
-- 9. Secrets set?             -> Check Settings > Secrets in Supabase dashboard
