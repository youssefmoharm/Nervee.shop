-- NERVE Email Automation - Scheduled Jobs
-- This migration gracefully handles pg_cron if available
-- Jobs are optional - system works without them

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  GRANT USAGE ON SCHEMA cron TO postgres;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- Cleanup old email logs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'cron' AND table_name = 'job') THEN
      BEGIN
        PERFORM cron.schedule('cleanup_old_email_logs', '0 3 * * 1', 'DELETE FROM email_logs WHERE created_at < NOW() - INTERVAL ''90 days'';');
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;
END $$;

-- Cleanup old cart tracking
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'cron' AND table_name = 'job') THEN
      BEGIN
        PERFORM cron.schedule('cleanup_old_cart_tracking', '0 4 * * 1', 'DELETE FROM cart_abandonment_tracking WHERE created_at < NOW() - INTERVAL ''30 days'';');
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;
END $$;
