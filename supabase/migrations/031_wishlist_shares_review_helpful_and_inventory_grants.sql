-- Migration 031: Wishlist shares, review helpful votes, storage bucket,
-- and product_inventory column-level grants for anon.
--
-- 1) wishlist_shares: shareable wishlist snapshot (code/items/message/expiry)
-- 2) review_helpful_votes: one vote per (review, voter); SECURITY DEFINER RPC
--    returns the updated helpful count
-- 3) review-photos storage bucket + policies (per 002 storage pattern)
-- 4) product_inventory: revoke broad SELECT from anon, grant column-level
--    (product_id, size, in_stock) so product_availability (security_invoker)
--    keeps working while stock_quantity stays hidden from anon

-- ---------------------------------------------------------------------------
-- 1. WISHLIST SHARES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wishlist_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code TEXT UNIQUE NOT NULL,
  wishlist_id UUID REFERENCES wishlists(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  message TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE wishlist_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create wishlist share" ON wishlist_shares;
CREATE POLICY "Anyone can create wishlist share" ON wishlist_shares FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read wishlist share" ON wishlist_shares;
CREATE POLICY "Anyone can read wishlist share" ON wishlist_shares FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS wishlist_shares_code_idx ON wishlist_shares(share_code);

-- ---------------------------------------------------------------------------
-- 2. REVIEW HELPFUL VOTES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_helpful_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL, -- auth user id or stable client-generated id
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(review_id, voter_id)
);
ALTER TABLE review_helpful_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can select helpful votes" ON review_helpful_votes;
CREATE POLICY "Public can select helpful votes" ON review_helpful_votes FOR SELECT
  USING (true);

DROP FUNCTION IF EXISTS vote_review_helpful(UUID, TEXT);
CREATE OR REPLACE FUNCTION vote_review_helpful(p_review_id UUID, p_voter_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_review_id IS NULL OR p_voter_id IS NULL OR length(trim(p_voter_id)) = 0 THEN
    RAISE EXCEPTION 'review_id and voter_id are required' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO review_helpful_votes (review_id, voter_id)
  VALUES (p_review_id, trim(p_voter_id))
  ON CONFLICT (review_id, voter_id) DO NOTHING;

  SELECT COUNT(*) INTO v_count
    FROM review_helpful_votes
   WHERE review_id = p_review_id;

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION vote_review_helpful(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vote_review_helpful(UUID, TEXT) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. STORAGE: review-photos bucket + policies
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-photos',
  'review-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can view review photos" ON storage.objects;
CREATE POLICY "Public can view review photos" ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'review-photos');

DROP POLICY IF EXISTS "Authenticated can upload review photos" ON storage.objects;
CREATE POLICY "Authenticated can upload review photos" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'review-photos');

DROP POLICY IF EXISTS "Users can delete own review photos" ON storage.objects;
CREATE POLICY "Users can delete own review photos" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'review-photos' AND owner = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. product_inventory: column-level grants for anon
--    (replaces broad table SELECT from 022; view access preserved)
-- ---------------------------------------------------------------------------
REVOKE ALL ON product_inventory FROM anon;
GRANT SELECT (product_id, size, in_stock) ON product_inventory TO anon;
-- authenticated/admin keep full table access for cart/order flows that join
-- stock_quantity when authorized; re-assert service_role too.
GRANT SELECT ON product_inventory TO authenticated, service_role;
GRANT SELECT ON product_availability TO anon, authenticated, service_role;
