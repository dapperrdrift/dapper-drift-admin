BEGIN;

INSERT INTO public.categories (id, name, slug, created_at)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Men Shirts', 'mens-shirts', now()),
  ('10000000-0000-0000-0000-000000000002', 'Women Dresses', 'womens-dresses', now()),
  ('10000000-0000-0000-0000-000000000003', 'Denim', 'denim', now()),
  ('10000000-0000-0000-0000-000000000004', 'Outerwear', 'outerwear', now()),
  ('10000000-0000-0000-0000-000000000005', 'Activewear', 'activewear', now()),
  ('10000000-0000-0000-0000-000000000006', 'Ethnic Wear', 'ethnic-wear', now()),
  ('10000000-0000-0000-0000-000000000007', 'Loungewear', 'loungewear', now()),
  ('10000000-0000-0000-0000-000000000008', 'Co-ords', 'co-ords', now())
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name;

INSERT INTO public.products (
  id,
  name,
  description,
  category_id,
  base_price,
  images,
  is_active,
  created_at,
  updated_at
)
VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    'Midnight Oxford Shirt',
    'Structured oxford weave shirt with clean collar and slim fit silhouette.',
    (SELECT id FROM public.categories WHERE slug = 'mens-shirts'),
    1899.00,
    ARRAY['https://picsum.photos/seed/dd-001a/1200/1600', 'https://picsum.photos/seed/dd-001b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'Coastal Linen Shirt',
    'Breathable linen blend shirt designed for warm weather layering.',
    (SELECT id FROM public.categories WHERE slug = 'mens-shirts'),
    2099.00,
    ARRAY['https://picsum.photos/seed/dd-002a/1200/1600', 'https://picsum.photos/seed/dd-002b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    'Grid Flannel Shirt',
    'Brushed cotton flannel with soft hand-feel and everyday check pattern.',
    (SELECT id FROM public.categories WHERE slug = 'mens-shirts'),
    2299.00,
    ARRAY['https://picsum.photos/seed/dd-003a/1200/1600', 'https://picsum.photos/seed/dd-003b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    'Velvet Slip Dress',
    'Evening slip dress with soft sheen and fluid drape for occasion styling.',
    (SELECT id FROM public.categories WHERE slug = 'womens-dresses'),
    2899.00,
    ARRAY['https://picsum.photos/seed/dd-004a/1200/1600', 'https://picsum.photos/seed/dd-004b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000005',
    'Floral Wrap Dress',
    'Lightweight wrap dress with tie waist and all-day comfort fit.',
    (SELECT id FROM public.categories WHERE slug = 'womens-dresses'),
    2599.00,
    ARRAY['https://picsum.photos/seed/dd-005a/1200/1600', 'https://picsum.photos/seed/dd-005b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000006',
    'Satin Midi Dress',
    'Bias-cut satin midi with elegant movement and minimal detailing.',
    (SELECT id FROM public.categories WHERE slug = 'womens-dresses'),
    3199.00,
    ARRAY['https://picsum.photos/seed/dd-006a/1200/1600', 'https://picsum.photos/seed/dd-006b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000007',
    'Indigo Straight Jeans',
    'Classic straight-leg denim with medium rise and structured stretch.',
    (SELECT id FROM public.categories WHERE slug = 'denim'),
    2399.00,
    ARRAY['https://picsum.photos/seed/dd-007a/1200/1600', 'https://picsum.photos/seed/dd-007b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000008',
    'Washed Wide Leg Jeans',
    'Wide-leg denim silhouette with vintage wash and relaxed drape.',
    (SELECT id FROM public.categories WHERE slug = 'denim'),
    2599.00,
    ARRAY['https://picsum.photos/seed/dd-008a/1200/1600', 'https://picsum.photos/seed/dd-008b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000009',
    'Black Skinny Jeans',
    'High-stretch black denim with close fit from waist to ankle.',
    (SELECT id FROM public.categories WHERE slug = 'denim'),
    2199.00,
    ARRAY['https://picsum.photos/seed/dd-009a/1200/1600', 'https://picsum.photos/seed/dd-009b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000010',
    'Utility Bomber Jacket',
    'Lightweight bomber with utility pockets and ribbed trims.',
    (SELECT id FROM public.categories WHERE slug = 'outerwear'),
    3499.00,
    ARRAY['https://picsum.photos/seed/dd-010a/1200/1600', 'https://picsum.photos/seed/dd-010b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000011',
    'Quilted Puffer Jacket',
    'Warm quilted puffer with insulated fill and stand collar.',
    (SELECT id FROM public.categories WHERE slug = 'outerwear'),
    4299.00,
    ARRAY['https://picsum.photos/seed/dd-011a/1200/1600', 'https://picsum.photos/seed/dd-011b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000012',
    'Classic Trench Coat',
    'Double-breasted trench with storm flap and adjustable waist belt.',
    (SELECT id FROM public.categories WHERE slug = 'outerwear'),
    4799.00,
    ARRAY['https://picsum.photos/seed/dd-012a/1200/1600', 'https://picsum.photos/seed/dd-012b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000013',
    'Motion Training Tee',
    'Sweat-wicking stretch tee for gym and high-intensity movement.',
    (SELECT id FROM public.categories WHERE slug = 'activewear'),
    1499.00,
    ARRAY['https://picsum.photos/seed/dd-013a/1200/1600', 'https://picsum.photos/seed/dd-013b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000014',
    'Pace Jogger Pants',
    'Tapered joggers with four-way stretch and zipper utility pockets.',
    (SELECT id FROM public.categories WHERE slug = 'activewear'),
    1999.00,
    ARRAY['https://picsum.photos/seed/dd-014a/1200/1600', 'https://picsum.photos/seed/dd-014b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000015',
    'Flex Sports Bra',
    'Medium-impact sports bra with sculpted support and soft banding.',
    (SELECT id FROM public.categories WHERE slug = 'activewear'),
    1699.00,
    ARRAY['https://picsum.photos/seed/dd-015a/1200/1600', 'https://picsum.photos/seed/dd-015b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000016',
    'Ivory Kurta Set',
    'Two-piece kurta set with subtle embroidery and straight pants.',
    (SELECT id FROM public.categories WHERE slug = 'ethnic-wear'),
    2799.00,
    ARRAY['https://picsum.photos/seed/dd-016a/1200/1600', 'https://picsum.photos/seed/dd-016b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000017',
    'Festive Anarkali',
    'Flowing anarkali with embellished yoke suited for celebrations.',
    (SELECT id FROM public.categories WHERE slug = 'ethnic-wear'),
    3599.00,
    ARRAY['https://picsum.photos/seed/dd-017a/1200/1600', 'https://picsum.photos/seed/dd-017b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000018',
    'Handblock Cotton Saree',
    'Soft cotton saree featuring handblock-inspired print and tassel edge.',
    (SELECT id FROM public.categories WHERE slug = 'ethnic-wear'),
    2999.00,
    ARRAY['https://picsum.photos/seed/dd-018a/1200/1600', 'https://picsum.photos/seed/dd-018b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000019',
    'Cloud Knit Hoodie',
    'Brushed knit hoodie built for comfort-first everyday wear.',
    (SELECT id FROM public.categories WHERE slug = 'loungewear'),
    1899.00,
    ARRAY['https://picsum.photos/seed/dd-019a/1200/1600', 'https://picsum.photos/seed/dd-019b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000020',
    'Ribbed Lounge Set',
    'Matching rib-knit lounge top and bottom with soft stretch texture.',
    (SELECT id FROM public.categories WHERE slug = 'loungewear'),
    2499.00,
    ARRAY['https://picsum.photos/seed/dd-020a/1200/1600', 'https://picsum.photos/seed/dd-020b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000021',
    'Soft Modal Pajama Set',
    'Breathable modal sleep set with relaxed fit and contrast piping.',
    (SELECT id FROM public.categories WHERE slug = 'loungewear'),
    2199.00,
    ARRAY['https://picsum.photos/seed/dd-021a/1200/1600', 'https://picsum.photos/seed/dd-021b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000022',
    'Sage Co-ord Blazer',
    'Relaxed tailored blazer designed as part of a matching co-ord set.',
    (SELECT id FROM public.categories WHERE slug = 'co-ords'),
    3299.00,
    ARRAY['https://picsum.photos/seed/dd-022a/1200/1600', 'https://picsum.photos/seed/dd-022b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000023',
    'Sand Co-ord Cargo Set',
    'Co-ord cargo set with utility details and relaxed ankle taper.',
    (SELECT id FROM public.categories WHERE slug = 'co-ords'),
    3099.00,
    ARRAY['https://picsum.photos/seed/dd-023a/1200/1600', 'https://picsum.photos/seed/dd-023b/1200/1600'],
    true,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000024',
    'Noir Evening Co-ord',
    'Dressy co-ord pairing with fluid drape and clean evening finish.',
    (SELECT id FROM public.categories WHERE slug = 'co-ords'),
    3499.00,
    ARRAY['https://picsum.photos/seed/dd-024a/1200/1600', 'https://picsum.photos/seed/dd-024b/1200/1600'],
    true,
    now(),
    now()
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category_id = EXCLUDED.category_id,
  base_price = EXCLUDED.base_price,
  images = EXCLUDED.images,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.variants (
  id,
  product_id,
  size,
  color,
  sku,
  price_override,
  stock_quantity,
  low_stock_threshold,
  created_at
)
VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'M', 'Black', 'DD-MSH-001-BLK-M', 1899.00, 34, 5, now()),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'L', 'Navy', 'DD-MSH-001-NVY-L', 1949.00, 28, 5, now()),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'M', 'Sky Blue', 'DD-MSH-002-SKY-M', 2099.00, 26, 5, now()),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'L', 'White', 'DD-MSH-002-WHT-L', 2149.00, 22, 5, now()),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', 'M', 'Maroon', 'DD-MSH-003-MRN-M', 2299.00, 19, 5, now()),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000003', 'L', 'Olive', 'DD-MSH-003-OLV-L', 2349.00, 17, 5, now()),
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000004', 'S', 'Wine', 'DD-WDR-004-WIN-S', 2899.00, 16, 4, now()),
  ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000004', 'M', 'Emerald', 'DD-WDR-004-EMR-M', 2949.00, 13, 4, now()),
  ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000005', 'S', 'Rose', 'DD-WDR-005-RSE-S', 2599.00, 21, 4, now()),
  ('30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000005', 'M', 'Ivory', 'DD-WDR-005-IVY-M', 2649.00, 18, 4, now()),
  ('30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000006', 'S', 'Champagne', 'DD-WDR-006-CHP-S', 3199.00, 12, 4, now()),
  ('30000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000006', 'M', 'Black', 'DD-WDR-006-BLK-M', 3249.00, 10, 4, now()),
  ('30000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000007', '30', 'Indigo', 'DD-DNM-007-IND-30', 2399.00, 31, 6, now()),
  ('30000000-0000-0000-0000-000000000014', '20000000-0000-0000-0000-000000000007', '32', 'Indigo', 'DD-DNM-007-IND-32', 2449.00, 27, 6, now()),
  ('30000000-0000-0000-0000-000000000015', '20000000-0000-0000-0000-000000000008', '28', 'Washed Blue', 'DD-DNM-008-WBL-28', 2599.00, 24, 6, now()),
  ('30000000-0000-0000-0000-000000000016', '20000000-0000-0000-0000-000000000008', '30', 'Washed Blue', 'DD-DNM-008-WBL-30', 2649.00, 20, 6, now()),
  ('30000000-0000-0000-0000-000000000017', '20000000-0000-0000-0000-000000000009', '30', 'Black', 'DD-DNM-009-BLK-30', 2199.00, 26, 6, now()),
  ('30000000-0000-0000-0000-000000000018', '20000000-0000-0000-0000-000000000009', '32', 'Black', 'DD-DNM-009-BLK-32', 2249.00, 23, 6, now()),
  ('30000000-0000-0000-0000-000000000019', '20000000-0000-0000-0000-000000000010', 'M', 'Olive', 'DD-OUT-010-OLV-M', 3499.00, 14, 4, now()),
  ('30000000-0000-0000-0000-000000000020', '20000000-0000-0000-0000-000000000010', 'L', 'Black', 'DD-OUT-010-BLK-L', 3549.00, 12, 4, now()),
  ('30000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000011', 'M', 'Charcoal', 'DD-OUT-011-CHR-M', 4299.00, 11, 4, now()),
  ('30000000-0000-0000-0000-000000000022', '20000000-0000-0000-0000-000000000011', 'L', 'Navy', 'DD-OUT-011-NVY-L', 4349.00, 9, 4, now()),
  ('30000000-0000-0000-0000-000000000023', '20000000-0000-0000-0000-000000000012', 'M', 'Beige', 'DD-OUT-012-BEG-M', 4799.00, 8, 4, now()),
  ('30000000-0000-0000-0000-000000000024', '20000000-0000-0000-0000-000000000012', 'L', 'Khaki', 'DD-OUT-012-KHK-L', 4849.00, 7, 4, now()),
  ('30000000-0000-0000-0000-000000000025', '20000000-0000-0000-0000-000000000013', 'M', 'Cobalt', 'DD-ACT-013-CBL-M', 1499.00, 36, 7, now()),
  ('30000000-0000-0000-0000-000000000026', '20000000-0000-0000-0000-000000000013', 'L', 'Graphite', 'DD-ACT-013-GRP-L', 1549.00, 30, 7, now()),
  ('30000000-0000-0000-0000-000000000027', '20000000-0000-0000-0000-000000000014', 'M', 'Black', 'DD-ACT-014-BLK-M', 1999.00, 33, 7, now()),
  ('30000000-0000-0000-0000-000000000028', '20000000-0000-0000-0000-000000000014', 'L', 'Navy', 'DD-ACT-014-NVY-L', 2049.00, 29, 7, now()),
  ('30000000-0000-0000-0000-000000000029', '20000000-0000-0000-0000-000000000015', 'S', 'Black', 'DD-ACT-015-BLK-S', 1699.00, 25, 7, now()),
  ('30000000-0000-0000-0000-000000000030', '20000000-0000-0000-0000-000000000015', 'M', 'Berry', 'DD-ACT-015-BRY-M', 1749.00, 22, 7, now()),
  ('30000000-0000-0000-0000-000000000031', '20000000-0000-0000-0000-000000000016', 'M', 'Ivory', 'DD-ETH-016-IVY-M', 2799.00, 20, 4, now()),
  ('30000000-0000-0000-0000-000000000032', '20000000-0000-0000-0000-000000000016', 'L', 'Mint', 'DD-ETH-016-MNT-L', 2849.00, 17, 4, now()),
  ('30000000-0000-0000-0000-000000000033', '20000000-0000-0000-0000-000000000017', 'M', 'Ruby', 'DD-ETH-017-RBY-M', 3599.00, 14, 4, now()),
  ('30000000-0000-0000-0000-000000000034', '20000000-0000-0000-0000-000000000017', 'L', 'Teal', 'DD-ETH-017-TEL-L', 3649.00, 12, 4, now()),
  ('30000000-0000-0000-0000-000000000035', '20000000-0000-0000-0000-000000000018', 'Free Size', 'Indigo', 'DD-ETH-018-IND-FS', 2999.00, 16, 4, now()),
  ('30000000-0000-0000-0000-000000000036', '20000000-0000-0000-0000-000000000018', 'Free Size', 'Maroon', 'DD-ETH-018-MRN-FS', 3049.00, 13, 4, now()),
  ('30000000-0000-0000-0000-000000000037', '20000000-0000-0000-0000-000000000019', 'M', 'Grey', 'DD-LNG-019-GRY-M', 1899.00, 32, 6, now()),
  ('30000000-0000-0000-0000-000000000038', '20000000-0000-0000-0000-000000000019', 'L', 'Cream', 'DD-LNG-019-CRM-L', 1949.00, 28, 6, now()),
  ('30000000-0000-0000-0000-000000000039', '20000000-0000-0000-0000-000000000020', 'M', 'Taupe', 'DD-LNG-020-TPE-M', 2499.00, 24, 6, now()),
  ('30000000-0000-0000-0000-000000000040', '20000000-0000-0000-0000-000000000020', 'L', 'Mauve', 'DD-LNG-020-MAV-L', 2549.00, 19, 6, now()),
  ('30000000-0000-0000-0000-000000000041', '20000000-0000-0000-0000-000000000021', 'M', 'Blue Stripe', 'DD-LNG-021-BST-M', 2199.00, 22, 6, now()),
  ('30000000-0000-0000-0000-000000000042', '20000000-0000-0000-0000-000000000021', 'L', 'Grey Stripe', 'DD-LNG-021-GST-L', 2249.00, 18, 6, now()),
  ('30000000-0000-0000-0000-000000000043', '20000000-0000-0000-0000-000000000022', 'S', 'Sage', 'DD-CRD-022-SAG-S', 3299.00, 16, 5, now()),
  ('30000000-0000-0000-0000-000000000044', '20000000-0000-0000-0000-000000000022', 'M', 'Sage', 'DD-CRD-022-SAG-M', 3349.00, 14, 5, now()),
  ('30000000-0000-0000-0000-000000000045', '20000000-0000-0000-0000-000000000023', 'S', 'Sand', 'DD-CRD-023-SND-S', 3099.00, 15, 5, now()),
  ('30000000-0000-0000-0000-000000000046', '20000000-0000-0000-0000-000000000023', 'M', 'Olive', 'DD-CRD-023-OLV-M', 3149.00, 12, 5, now()),
  ('30000000-0000-0000-0000-000000000047', '20000000-0000-0000-0000-000000000024', 'S', 'Black', 'DD-CRD-024-BLK-S', 3499.00, 11, 5, now()),
  ('30000000-0000-0000-0000-000000000048', '20000000-0000-0000-0000-000000000024', 'M', 'Black', 'DD-CRD-024-BLK-M', 3549.00, 9, 5, now())
ON CONFLICT (sku) DO UPDATE
SET
  product_id = EXCLUDED.product_id,
  size = EXCLUDED.size,
  color = EXCLUDED.color,
  price_override = EXCLUDED.price_override,
  stock_quantity = EXCLUDED.stock_quantity,
  low_stock_threshold = EXCLUDED.low_stock_threshold;

COMMIT;