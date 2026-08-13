-- NERVE Email Automation - Scheduled Jobs via pg_cron
-- 
-- This migration sets up recurring jobs for email automation
-- Requires: pg_cron extension enabled on Supabase project
-- 
-- To enable pg_cron on your Supabase project:
-- 1. Go to Database > Extensions in Supabase dashboard
-- 2. Search for "pg_cron"
-- 3. Click "Install extension"
--
-- After running this migration, jobs will run automatically

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant permissions to postgres role to use pg_cron
GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================================================
-- SCHEDULED JOBS
-- ============================================================================

-- Job 1: Process abandoned carts every 4 hours
-- Finds carts inactive for 24+ hours and sends recovery emails
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'process_abandoned_carts',
      '0 */4 * * *', -- Run at 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
      $$
      SELECT net.http_post(
        url:='https://' || current_setting('app.settings.supabase_url') || '/functions/v1/process-abandoned-carts',
        headers:=jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
          'Content-Type', 'application/json'
        ),
        body:='{}'::jsonb,
        timeout_milliseconds:=60000
      );
      $$
    );
  END IF;
END $$;

-- Optional: Job 2: Send daily digest emails to newsletter subscribers
-- (Not enabled by default - uncomment if you want daily emails)
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
--     PERFORM cron.schedule(
--       'send_daily_newsletter',
--       '0 9 * * *', -- Run at 09:00 UTC daily
--       $$
--       SELECT net.http_post(
--         url:='https://' || current_setting('app.settings.supabase_url') || '/functions/v1/send-daily-newsletter',
--         headers:=jsonb_build_object(
--           'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
--           'Content-Type', 'application/json'
--         ),
--         body:='{}'::jsonb,
--         timeout_milliseconds:=300000
--       );
--       $$
--     );
--   END IF;
-- END $$;

-- Optional: Job 3: Cleanup old email logs (keep last 90 days)
-- (Runs weekly to save storage)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup_old_email_logs',
      '0 3 * * 1', -- Run at 03:00 UTC on Mondays
      $$
      DELETE FROM email_logs WHERE created_at < NOW() - INTERVAL '90 days';
      $$
    );
  END IF;
END $$;

-- Optional: Job 4: Cleanup old cart abandonment tracking (keep last 30 days)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup_old_cart_tracking',
      '0 4 * * 1', -- Run at 04:00 UTC on Mondays
      $$
      DELETE FROM cart_abandonment_tracking 
      WHERE created_at < NOW() - INTERVAL '30 days'
        AND (recovered_at IS NOT NULL OR email_sent_at IS NOT NULL);
      $$
    );
  END IF;
END $$;

-- ============================================================================
-- VIEW SCHEDULED JOBS (for debugging)
-- ============================================================================
-- SELECT * FROM cron.job;
-- SELECT * FROM cron.job_run_details WHERE job_name IN (
--   'process_abandoned_carts',
--   'cleanup_old_email_logs',
--   'cleanup_old_cart_tracking'
-- );

-- ============================================================================
-- NOTES ON pg_cron
-- ============================================================================
--
-- Cron schedule format (same as Linux crontab):
-- ┌───────────── minute (0 - 59)
-- │ ┌───────────── hour (0 - 23)
-- │ │ ┌───────────── day of month (1 - 31)
-- │ │ │ ┌───────────── month (1 - 12)
-- │ │ │ │ ┌───────────── day of week (0 - 6) (0 to 6 are Sunday to Saturday)
-- │ │ │ │ │
-- │ │ │ │ │
-- * * * * *
--
-- Examples:
-- '0 9 * * *'        = Every day at 09:00 UTC
-- '0 */4 * * *'      = Every 4 hours (00:00, 04:00, 08:00, 12:00, 16:00, 20:00)
-- '0 0 * * 1'        = Every Monday at 00:00 UTC (0 = Sunday, 1 = Monday)
-- '*/15 * * * *'     = Every 15 minutes
-- '0 9-17 * * 1-5'   = Every weekday (Mon-Fri) from 09:00 to 17:00, on the hour
--
-- Important: pg_cron runs in UTC timezone. Set SHOW timezone in current database.
-- All times are UTC unless explicitly configured otherwise in Supabase.
