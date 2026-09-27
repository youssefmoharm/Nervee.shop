-- Migration 053: deny direct public-role access to customer state and tokens.

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'carts',
    'cart_items',
    'wishlists',
    'wishlist_items',
    'guest_orders',
    'ai_context_cache',
    'rate_limit_requests',
    'unsubscribe_tokens',
    'email_opt_outs',
    'cart_abandonment_tracking'
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