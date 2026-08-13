-- NERVE Email Automation - Scheduled Jobs via pg_cron
-- 
-- This migration sets up recurring jobs for email automation
-- Requires: pg_cron extension enabled on Supabase project
-- 
-- Note: These jobs are designed to gracefully skip in development/preview
-- environments where pg_cron or network functions are unavailable.

-- Enable pg_cron extension (only if available)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant permissions to postgres role to use pg_cron
DO $$
BEGIN
  GRANT USAGE ON SCHEMA cron TO postgres;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- ============================================================================
-- SCHEDULED JOBS
-- ============================================================================
-- These jobs are simple DELETE statements that work everywhere.
-- HTTP-based jobs (calling edge functions) require production configuration.

-- Job 1: Cleanup old email logs (keep last 90 days)
-- Runs every Monday at 03:00 UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_logs') THEN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
      BEGIN
        PERFORM cron.schedule(
          'cleanup_old_email_logs',
          '0 3 * * 1',
          'DELETE FROM email_logs WHERE created_at < NOW() - INTERVAL ''90 days'';'
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;
END $$;

-- Job 2: Cleanup old cart abandonment tracking (keep last 30 days)
-- Runs every Monday at 04:00 UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cart_abandonment_tracking') THEN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
      BEGIN
        PERFORM cron.schedule(
          'cleanup_old_cart_tracking',
          '0 4 * * 1',
          'DELETE FROM cart_abandonment_tracking WHERE created_at < NOW() - INTERVAL ''30 days'' AND (recovered_at IS NOT NULL OR email_sent_at IS NOT NULL);'
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- NOTES
-- ============================================================================
--
-- For production HTTP-based cron jobs (calling edge functions), see:
-- supabase/functions/process-abandoned-carts/index.ts
--
-- These can be manually configured in the Supabase dashboard under
-- Database > Cron if needed.
--
-- Cron schedule format:
-- minute (0-59) hour (0-23) day_of_month (1-31) month (1-12) day_of_week (0-6)
--
-- Examples:
-- '0 9 * * *'        = Every day at 09:00 UTC
-- '0 3 * * 1'        = Every Monday at 03:00 UTC
-- '*/15 * * * *'     = Every 15 minutes
