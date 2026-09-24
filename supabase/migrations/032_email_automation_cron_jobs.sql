-- Migration 032: Email automation cron jobs (pg_cron + pg_net HTTP)
--
-- Secrets are NEVER inlined. Each job reads CRON_SECRET and
-- SUPABASE_SERVICE_ROLE_KEY from the Supabase vault at execution time.
-- Jobs are idempotent: unschedule by name first, then schedule.
-- Guarded like migration 007 so databases without pg_cron/pg_net no-op safely.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  GRANT USAGE ON SCHEMA cron TO postgres;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- Hourly: back-in-stock notifications (empty body → process all products)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'cron' AND table_name = 'job') THEN
    BEGIN
      PERFORM cron.unschedule('send_back_in_stock_hourly');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    BEGIN
      PERFORM cron.schedule(
        'send_back_in_stock_hourly',
        '0 * * * *',
        $job$
        SELECT net.http_post(
          url := 'https://gfmxvvjqlhrnmidutjwx.supabase.co/functions/v1/send-back-in-stock',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || vault.get_secret('SUPABASE_SERVICE_ROLE_KEY'),
            'x-cron-secret', vault.get_secret('CRON_SECRET')
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 30000
        ) AS request_id;
        $job$
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Daily 10:00 UTC: abandoned-cart emails
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'cron' AND table_name = 'job') THEN
    BEGIN
      PERFORM cron.unschedule('process_abandoned_carts_daily');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    BEGIN
      PERFORM cron.schedule(
        'process_abandoned_carts_daily',
        '0 10 * * *',
        $job$
        SELECT net.http_post(
          url := 'https://gfmxvvjqlhrnmidutjwx.supabase.co/functions/v1/process-abandoned-carts',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || vault.get_secret('SUPABASE_SERVICE_ROLE_KEY'),
            'x-cron-secret', vault.get_secret('CRON_SECRET')
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 60000
        ) AS request_id;
        $job$
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;
