-- PERF-06: btree indexes for the catalog's hot filter/sort paths.
-- products only had GIN (search) + slug/name indexes, so every catalog query
-- (shop listing, category pages, new arrivals, best sellers) sequential-scanned.

-- Default catalog listing: active products, newest first.
CREATE INDEX IF NOT EXISTS products_active_created_idx
  ON products (is_active, created_at DESC);

-- Category filter (every category tile / ?category= URL).
CREATE INDEX IF NOT EXISTS products_active_category_idx
  ON products (is_active, category);

-- Price sort + price-range slider.
CREATE INDEX IF NOT EXISTS products_active_price_idx
  ON products (is_active, price);

-- Best-seller rail on the homepage / sort=best-selling.
CREATE INDEX IF NOT EXISTS products_best_seller_idx
  ON products (is_best_seller)
  WHERE is_best_seller;

-- Collection landing pages.
CREATE INDEX IF NOT EXISTS products_collection_idx
  ON products (collection_id)
  WHERE collection_id IS NOT NULL;

ANALYZE products;
