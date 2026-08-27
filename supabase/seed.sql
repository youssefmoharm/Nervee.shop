-- NERVE E-Commerce Seed Data — DEVELOPMENT SEED (idempotent)
-- Run this AFTER schema.sql to populate the database with initial data.
-- All inserts are idempotent (ON CONFLICT DO NOTHING) so it can be re-run
-- safely on every deploy.
--
-- IMAGE ASSETS: All product/collection image URLs below currently use
-- picsum.photos as GENERATED PLACEHOLDERS for development. They are NOT
-- production NERVE photography. Before launch, replace every image URL with
-- real product images hosted in Supabase Storage (bucket: product-images) or
-- your CDN. The frontend already handles missing images via
-- ProductCard onError fallback to /placeholder-product.jpg (public/placeholder-product.jpg).
-- Do NOT ship picsum URLs to production.

-- ============================================================================
-- SEED COLLECTIONS
-- ============================================================================
INSERT INTO collections (id, name, tagline, description, image) VALUES
('core-essentials', 'CORE ESSENTIALS', 'EVERYDAY PIECES', 
 'The foundation of the NERVE closet — heavyweight cotton staples designed to be lived in, worn out, and reached for first.',
 'https://picsum.photos/seed/nerve-core-essentials/1400/1750'),
('nerve-archive', 'NERVE ARCHIVE', 'LIMITED EDITIONS', 
 'Small-batch releases that don''t come back. Numbered pieces for the ones who were there first.',
 'https://picsum.photos/seed/nerve-archive-edit/1400/1750'),
('street-form', 'STREET FORM', 'BUILT FOR MOVEMENT', 
 'Technical fabrics and articulated cuts built for the pace of the city — engineered comfort with a sharp silhouette.',
 'https://picsum.photos/seed/nerve-street-form/1400/1750')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SEED PRODUCTS
-- ============================================================================

-- p-001: NERVE CORE TEE
INSERT INTO products VALUES
('p-001', 'nerve-core-tee', 'NERVE CORE TEE', 'T-Shirts', 'core-essentials',
 1250, NULL, 'EGP', 'NEW', TRUE, TRUE,
 'The tee that started it all. Heavyweight 240gsm cotton, boxy body, dropped shoulder. Built to hold its shape wash after wash.',
 '100% heavyweight combed cotton, 240gsm',
 '["Machine wash cold, inside out", "Do not bleach", "Tumble dry low", "Iron on reverse"]'::jsonb,
 NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_colors (product_id, name, hex, image, hover_image, sort_order) VALUES
('p-001', 'Navy', '#061735', 'https://picsum.photos/seed/core-tee-navy/900/1125', 'https://picsum.photos/seed/core-tee-navy-b/900/1125', 0),
('p-001', 'White', '#FFFFFF', 'https://picsum.photos/seed/core-tee-white/900/1125', 'https://picsum.photos/seed/core-tee-white-b/900/1125', 1),
('p-001', 'Gray', '#A7A7A7', 'https://picsum.photos/seed/core-tee-gray/900/1125', 'https://picsum.photos/seed/core-tee-gray-b/900/1125', 2)
ON CONFLICT (product_id, name) DO NOTHING;

INSERT INTO product_inventory (product_id, size, in_stock, stock_quantity) VALUES
('p-001', 'XS', TRUE, 15), ('p-001', 'S', TRUE, 25), ('p-001', 'M', TRUE, 30),
('p-001', 'L', TRUE, 25), ('p-001', 'XL', TRUE, 20), ('p-001', 'XXL', FALSE, 0)
ON CONFLICT (product_id, size) DO NOTHING;

-- p-002: NERVE OVERSIZED TEE
INSERT INTO products VALUES
('p-002', 'nerve-oversized-tee', 'NERVE OVERSIZED TEE', 'T-Shirts', 'street-form',
 1250, NULL, 'EGP', 'NEW', FALSE, TRUE,
 'A drop-shoulder oversized fit with an extended hem. Garment-washed for a broken-in feel from the first wear.',
 '100% cotton jersey, garment-dyed',
 '["Machine wash cold", "Do not iron print", "Hang dry recommended"]'::jsonb,
 'Runs oversized — size down for a closer fit.', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_colors (product_id, name, hex, image, hover_image, sort_order) VALUES
('p-002', 'Black', '#000000', 'https://picsum.photos/seed/oversized-tee-black/900/1125', 'https://picsum.photos/seed/oversized-tee-black-b/900/1125', 0),
('p-002', 'Navy', '#061735', 'https://picsum.photos/seed/oversized-tee-navy/900/1125', 'https://picsum.photos/seed/oversized-tee-navy-b/900/1125', 1)
ON CONFLICT (product_id, name) DO NOTHING;

INSERT INTO product_inventory (product_id, size, in_stock, stock_quantity) VALUES
('p-002', 'XS', TRUE, 12), ('p-002', 'S', TRUE, 22), ('p-002', 'M', TRUE, 28),
('p-002', 'L', TRUE, 22), ('p-002', 'XL', TRUE, 18), ('p-002', 'XXL', TRUE, 10)
ON CONFLICT (product_id, size) DO NOTHING;

-- p-003: CORE ZIP HOODIE
INSERT INTO products VALUES
('p-003', 'core-zip-hoodie', 'CORE ZIP HOODIE', 'Hoodies', 'core-essentials',
 2450, 2900, 'EGP', 'SALE', TRUE, TRUE,
 'Full-zip hoodie in brushed-back fleece with a lined hood and ribbed cuffs. Metal NERVE zip pull, embroidered wordmark on chest.',
 '80% cotton, 20% polyester fleece, 380gsm',
 '["Machine wash cold", "Zip up before washing", "Do not tumble dry"]'::jsonb,
 NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_colors (product_id, name, hex, image, hover_image, sort_order) VALUES
('p-003', 'Navy', '#061735', 'https://picsum.photos/seed/zip-hoodie-navy/900/1125', 'https://picsum.photos/seed/zip-hoodie-navy-b/900/1125', 0),
('p-003', 'Gray', '#A7A7A7', 'https://picsum.photos/seed/zip-hoodie-gray/900/1125', 'https://picsum.photos/seed/zip-hoodie-gray-b/900/1125', 1)
ON CONFLICT (product_id, name) DO NOTHING;

INSERT INTO product_inventory (product_id, size, in_stock, stock_quantity) VALUES
('p-003', 'XS', FALSE, 0), ('p-003', 'S', TRUE, 8), ('p-003', 'M', TRUE, 15),
('p-003', 'L', TRUE, 12), ('p-003', 'XL', TRUE, 10), ('p-003', 'XXL', TRUE, 5)
ON CONFLICT (product_id, size) DO NOTHING;

-- p-004: NERVE TRACK PANTS
INSERT INTO products VALUES
('p-004', 'nerve-track-pants', 'NERVE TRACK PANTS', 'Pants', 'street-form',
 1850, NULL, 'EGP', NULL, FALSE, TRUE,
 'Tapered track pants in a brushed technical weave with articulated knees for movement. Side zip pockets, elastic drawcord waist.',
 '92% polyester, 8% elastane, brushed technical weave',
 '["Machine wash cold", "Do not bleach", "Low iron if needed"]'::jsonb,
 NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_colors (product_id, name, hex, image, hover_image, sort_order) VALUES
('p-004', 'Black', '#000000', 'https://picsum.photos/seed/track-pants-black/900/1125', 'https://picsum.photos/seed/track-pants-black-b/900/1125', 0),
('p-004', 'Navy', '#061735', 'https://picsum.photos/seed/track-pants-navy/900/1125', 'https://picsum.photos/seed/track-pants-navy-b/900/1125', 1)
ON CONFLICT (product_id, name) DO NOTHING;

INSERT INTO product_inventory (product_id, size, in_stock, stock_quantity) VALUES
('p-004', 'XS', FALSE, 0), ('p-004', 'S', TRUE, 18), ('p-004', 'M', TRUE, 25),
('p-004', 'L', TRUE, 20), ('p-004', 'XL', TRUE, 15), ('p-004', 'XXL', FALSE, 0)
ON CONFLICT (product_id, size) DO NOTHING;

-- p-005: ARCHIVE DENIM
INSERT INTO products VALUES
('p-005', 'archive-denim', 'ARCHIVE DENIM', 'Denim', 'nerve-archive',
 2650, NULL, 'EGP', 'LIMITED', FALSE, TRUE,
 'Numbered archive release. Straight-leg selvedge denim, 14oz rigid cotton that breaks in to your shape. Each pair individually numbered on the inner waistband.',
 '100% rigid selvedge cotton denim, 14oz',
 '["Wash sparingly, cold water", "Hang dry", "Avoid dryer to preserve shrink-to-fit"]'::jsonb,
 NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_colors (product_id, name, hex, image, hover_image, sort_order) VALUES
('p-005', 'Raw Indigo', '#1c2b4a', 'https://picsum.photos/seed/archive-denim-indigo/900/1125', 'https://picsum.photos/seed/archive-denim-indigo-b/900/1125', 0),
('p-005', 'Washed Black', '#0d0d0d', 'https://picsum.photos/seed/archive-denim-black/900/1125', 'https://picsum.photos/seed/archive-denim-black-b/900/1125', 1)
ON CONFLICT (product_id, name) DO NOTHING;

INSERT INTO product_inventory (product_id, size, in_stock, stock_quantity) VALUES
('p-005', 'XS', FALSE, 0), ('p-005', 'S', FALSE, 0), ('p-005', 'M', TRUE, 8),
('p-005', 'L', TRUE, 10), ('p-005', 'XL', TRUE, 8), ('p-005', 'XXL', TRUE, 5)
ON CONFLICT (product_id, size) DO NOTHING;

-- p-006: EVERYDAY CAP
INSERT INTO products VALUES
('p-006', 'everyday-cap', 'EVERYDAY CAP', 'Caps', 'core-essentials',
 850, NULL, 'EGP', 'NEW', FALSE, TRUE,
 'Six-panel unstructured cap in washed cotton twill with a curved brim and embroidered NERVE checkerboard tab at the back.',
 '100% washed cotton twill',
 '["Spot clean only", "Do not machine wash"]'::jsonb,
 NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_colors (product_id, name, hex, image, hover_image, sort_order) VALUES
('p-006', 'Navy', '#061735', 'https://picsum.photos/seed/cap-navy/900/1125', 'https://picsum.photos/seed/cap-navy-b/900/1125', 0),
('p-006', 'White', '#FFFFFF', 'https://picsum.photos/seed/cap-white/900/1125', 'https://picsum.photos/seed/cap-white-b/900/1125', 1)
ON CONFLICT (product_id, name) DO NOTHING;

INSERT INTO product_inventory (product_id, size, in_stock, stock_quantity) VALUES
('p-006', 'S', TRUE, 20), ('p-006', 'M', TRUE, 30), ('p-006', 'L', TRUE, 25)
ON CONFLICT (product_id, size) DO NOTHING;

-- p-007: SIGNATURE JACKET
INSERT INTO products VALUES
('p-007', 'signature-jacket', 'SIGNATURE JACKET', 'Jackets', 'nerve-archive',
 3450, NULL, 'EGP', 'LIMITED', TRUE, TRUE,
 'The NERVE signature coach jacket. Water-resistant shell, checkerboard-lined interior, snap-button front and embroidered chest wordmark.',
 'Shell: 100% nylon, water-resistant finish. Lining: 100% cotton checkerboard jacquard.',
 '["Wipe clean", "Dry clean for deep clean", "Do not tumble dry"]'::jsonb,
 NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_colors (product_id, name, hex, image, hover_image, sort_order) VALUES
('p-007', 'Navy', '#061735', 'https://picsum.photos/seed/sig-jacket-navy/900/1125', 'https://picsum.photos/seed/sig-jacket-navy-b/900/1125', 0)
ON CONFLICT (product_id, name) DO NOTHING;

INSERT INTO product_inventory (product_id, size, in_stock, stock_quantity) VALUES
('p-007', 'XS', FALSE, 0), ('p-007', 'S', TRUE, 5), ('p-007', 'M', TRUE, 8),
('p-007', 'L', TRUE, 6), ('p-007', 'XL', TRUE, 4), ('p-007', 'XXL', FALSE, 0)
ON CONFLICT (product_id, size) DO NOTHING;

-- p-008: NERVE ESSENTIALS TEE
INSERT INTO products VALUES
('p-008', 'nerve-essentials-tee', 'NERVE ESSENTIALS TEE', 'T-Shirts', 'core-essentials',
 1050, NULL, 'EGP', 'BEST SELLER', TRUE, TRUE,
 'A slim, everyday tee in mid-weight cotton with a clean crew neck. The one you buy in every color.',
 '100% combed cotton, 180gsm',
 '["Machine wash cold", "Tumble dry low"]'::jsonb,
 NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_colors (product_id, name, hex, image, hover_image, sort_order) VALUES
('p-008', 'White', '#FFFFFF', 'https://picsum.photos/seed/ess-tee-white/900/1125', 'https://picsum.photos/seed/ess-tee-white-b/900/1125', 0),
('p-008', 'Black', '#000000', 'https://picsum.photos/seed/ess-tee-black/900/1125', 'https://picsum.photos/seed/ess-tee-black-b/900/1125', 1),
('p-008', 'Navy', '#061735', 'https://picsum.photos/seed/ess-tee-navy/900/1125', 'https://picsum.photos/seed/ess-tee-navy-b/900/1125', 2)
ON CONFLICT (product_id, name) DO NOTHING;

INSERT INTO product_inventory (product_id, size, in_stock, stock_quantity) VALUES
('p-008', 'XS', TRUE, 20), ('p-008', 'S', TRUE, 35), ('p-008', 'M', TRUE, 40),
('p-008', 'L', TRUE, 35), ('p-008', 'XL', TRUE, 25), ('p-008', 'XXL', TRUE, 15)
ON CONFLICT (product_id, size) DO NOTHING;

-- p-009: STREET FORM SHELL
INSERT INTO products VALUES
('p-009', 'street-form-jacket', 'STREET FORM SHELL', 'Jackets', 'street-form',
 2950, NULL, 'EGP', NULL, FALSE, TRUE,
 'Lightweight technical shell built for motion — articulated sleeves, taped seams, packable hood.',
 '100% recycled polyester ripstop, DWR coating',
 '["Machine wash cold, gentle cycle", "Do not iron", "Reproof as needed"]'::jsonb,
 NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_colors (product_id, name, hex, image, hover_image, sort_order) VALUES
('p-009', 'Black', '#000000', 'https://picsum.photos/seed/shell-black/900/1125', 'https://picsum.photos/seed/shell-black-b/900/1125', 0),
('p-009', 'Silver', '#A7A7A7', 'https://picsum.photos/seed/shell-silver/900/1125', 'https://picsum.photos/seed/shell-silver-b/900/1125', 1)
ON CONFLICT (product_id, name) DO NOTHING;

INSERT INTO product_inventory (product_id, size, in_stock, stock_quantity) VALUES
('p-009', 'XS', FALSE, 0), ('p-009', 'S', TRUE, 10), ('p-009', 'M', TRUE, 15),
('p-009', 'L', TRUE, 12), ('p-009', 'XL', TRUE, 10), ('p-009', 'XXL', TRUE, 6)
ON CONFLICT (product_id, size) DO NOTHING;

-- p-010: CORE CREW TOP
INSERT INTO products VALUES
('p-010', 'core-crew-top', 'CORE CREW TOP', 'Tops', 'core-essentials',
 1650, NULL, 'EGP', 'RESTOCKED', FALSE, TRUE,
 'A midweight crewneck in a looped-back cotton terry. Ribbed collar, cuffs and hem for a fit that holds.',
 '100% cotton loopback terry',
 '["Machine wash cold", "Tumble dry low"]'::jsonb,
 NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_colors (product_id, name, hex, image, hover_image, sort_order) VALUES
('p-010', 'Gray', '#A7A7A7', 'https://picsum.photos/seed/crew-top-gray/900/1125', 'https://picsum.photos/seed/crew-top-gray-b/900/1125', 0),
('p-010', 'Navy', '#061735', 'https://picsum.photos/seed/crew-top-navy/900/1125', 'https://picsum.photos/seed/crew-top-navy-b/900/1125', 1)
ON CONFLICT (product_id, name) DO NOTHING;

INSERT INTO product_inventory (product_id, size, in_stock, stock_quantity) VALUES
('p-010', 'XS', TRUE, 10), ('p-010', 'S', TRUE, 18), ('p-010', 'M', TRUE, 22),
('p-010', 'L', TRUE, 18), ('p-010', 'XL', TRUE, 14), ('p-010', 'XXL', TRUE, 8)
ON CONFLICT (product_id, size) DO NOTHING;

-- p-011: NERVE UTILITY BELT
INSERT INTO products VALUES
('p-011', 'motion-accessory-belt', 'NERVE UTILITY BELT', 'Accessories', 'street-form',
 750, NULL, 'EGP', NULL, FALSE, TRUE,
 'Woven technical webbing belt with a matte metal NERVE buckle. Adjustable, one size fits most within range.',
 'Nylon webbing, matte alloy hardware',
 '["Wipe clean with damp cloth"]'::jsonb,
 NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_colors (product_id, name, hex, image, hover_image, sort_order) VALUES
('p-011', 'Black', '#000000', 'https://picsum.photos/seed/belt-black/900/1125', 'https://picsum.photos/seed/belt-black-b/900/1125', 0)
ON CONFLICT (product_id, name) DO NOTHING;

INSERT INTO product_inventory (product_id, size, in_stock, stock_quantity) VALUES
('p-011', 'S', TRUE, 15), ('p-011', 'M', TRUE, 25), ('p-011', 'L', TRUE, 20)
ON CONFLICT (product_id, size) DO NOTHING;

-- p-012: ARCHIVE TRUCKER
INSERT INTO products VALUES
('p-012', 'archive-denim-jacket', 'ARCHIVE TRUCKER', 'Jackets', 'nerve-archive',
 2850, NULL, 'EGP', 'LIMITED', FALSE, TRUE,
 'Cropped trucker cut from the same 14oz selvedge as the Archive Denim. Numbered edition, checkerboard-jacquard inner collar.',
 '100% rigid selvedge cotton denim, 14oz',
 '["Wash sparingly, cold water", "Hang dry"]'::jsonb,
 NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_colors (product_id, name, hex, image, hover_image, sort_order) VALUES
('p-012', 'Raw Indigo', '#1c2b4a', 'https://picsum.photos/seed/trucker-indigo/900/1125', 'https://picsum.photos/seed/trucker-indigo-b/900/1125', 0)
ON CONFLICT (product_id, name) DO NOTHING;

INSERT INTO product_inventory (product_id, size, in_stock, stock_quantity) VALUES
('p-012', 'XS', FALSE, 0), ('p-012', 'S', TRUE, 4), ('p-012', 'M', TRUE, 6),
('p-012', 'L', TRUE, 5), ('p-012', 'XL', TRUE, 4), ('p-012', 'XXL', FALSE, 0)
ON CONFLICT (product_id, size) DO NOTHING;

-- ============================================================================
-- SEED DISCOUNT CODES
-- ============================================================================
INSERT INTO discount_codes (code, description, discount_type, discount_value, minimum_purchase, usage_limit, is_active, valid_until) VALUES
('WELCOME15', 'Welcome discount for new customers', 'percentage', 15, 100000, 1000, TRUE, '2027-12-31'),
('NERVE20', 'Special 20% off', 'percentage', 20, 150000, 500, TRUE, '2026-12-31'),
('FREESHIP', 'Free shipping on all orders', 'fixed', 10000, 0, NULL, TRUE, NULL)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✓ Seed data loaded successfully';
  RAISE NOTICE '  - % collections', (SELECT COUNT(*) FROM collections);
  RAISE NOTICE '  - % products', (SELECT COUNT(*) FROM products);
  RAISE NOTICE '  - % product colors', (SELECT COUNT(*) FROM product_colors);
  RAISE NOTICE '  - % inventory records', (SELECT COUNT(*) FROM product_inventory);
  RAISE NOTICE '  - % discount codes', (SELECT COUNT(*) FROM discount_codes);
END $$;