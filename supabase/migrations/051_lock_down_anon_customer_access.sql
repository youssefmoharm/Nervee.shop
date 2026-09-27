-- Migration 051: fail closed for unauthenticated customer profile access.
-- The public anon role must never read or write customer profiles.

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.customers FROM anon;

DROP POLICY IF EXISTS "Deny anon access to customer profiles" ON public.customers;
CREATE POLICY "Deny anon access to customer profiles"
  ON public.customers
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);