-- Migration 052: deny direct public-role access to private customer and ops data.
-- Authenticated access continues to be governed by the existing owner/admin RLS policies.

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'customers',
    'customer_addresses',
    'orders',
    'order_items',
    'admin_users',
    'refunds',
    'payment_attempts',
    'order_status_history',
    'order_return_requests',
    'support_tickets'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Deny anon access to private data', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false)',
      'Deny anon access to private data',
      table_name
    );
  END LOOP;
END;
$$;