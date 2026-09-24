-- Migration 030: Discount codes — EGP-correct seed values
--
-- seed.sql previously used nonsense minimums (100000 / 150000 EGP) and a
-- FREESHIP fixed value of 10000. Correct values (whole EGP, not cents):
--   FREESHIP   : fixed 100 (free shipping), min 0, no expiry
--   WELCOME15  : 15% off, min purchase 1000 EGP
--   NERVE20    : 20% off, min purchase 1500 EGP
-- Upsert so re-running the migration corrects already-seeded rows.

INSERT INTO discount_codes (code, description, discount_type, discount_value, minimum_purchase, usage_limit, is_active, valid_until)
VALUES
  ('FREESHIP',   'Free shipping on all orders',  'fixed',     100,  0,    NULL, TRUE, NULL),
  ('WELCOME15',  'Welcome discount for new customers', 'percentage', 15, 1000, 1000, TRUE, '2027-12-31'),
  ('NERVE20',    'Special 20% off',              'percentage', 20, 1500,  500, TRUE, '2026-12-31')
ON CONFLICT (code) DO UPDATE SET
  description   = EXCLUDED.description,
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  minimum_purchase = EXCLUDED.minimum_purchase,
  usage_limit   = EXCLUDED.usage_limit,
  is_active     = EXCLUDED.is_active,
  valid_until   = EXCLUDED.valid_until;
