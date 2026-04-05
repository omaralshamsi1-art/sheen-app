-- =============================================
-- SHEEN Café – Seed Data
-- =============================================

-- ─────────────────────────────────────────────
-- Menu Items
-- ─────────────────────────────────────────────
insert into menu_items (id, name, category, selling_price, estimated_cogs, packaging_cost, gross_margin) values
  -- Coffee
  ('v60',                   'V60',                   'Coffee',      20, 3.50, 0.50, 80.0),
  ('espresso',              'Espresso',              'Coffee',      15, 1.80, 0.20, 86.7),
  ('americano',             'Americano',             'Coffee',      13, 1.80, 0.30, 83.8),
  ('piccolo',               'Piccolo',               'Coffee',      17, 2.20, 0.30, 85.3),
  ('cortado',               'Cortado',               'Coffee',      17, 2.20, 0.30, 85.3),
  ('latte',                 'Latte',                 'Coffee',      19, 2.80, 0.40, 83.2),
  ('cappuccino',            'Cappuccino',            'Coffee',      19, 2.60, 0.35, 84.5),
  ('flatwhite',             'Flatwhite',             'Coffee',      19, 2.70, 0.35, 83.9),
  ('spanish_latte',         'Spanish Latte',         'Coffee',      22, 3.50, 0.40, 82.3),
  ('mocha',                 'Mocha',                 'Coffee',      22, 3.80, 0.40, 81.8),
  ('creamy_vanilla_coffee', 'Creamy Vanilla Coffee', 'Coffee',      24, 4.20, 0.40, 81.7),
  ('spanish_cortado',       'Spanish Cortado',       'Coffee',      19, 3.00, 0.35, 82.9),
  -- Cold Drinks
  ('raspberry_iced_tea',    'Raspberry Iced Tea',    'Cold Drinks', 17, 2.40, 0.45, 83.2),
  ('mango_iced_tea',        'Mango Iced Tea',        'Cold Drinks', 17, 2.30, 0.45, 83.8),
  ('hibiscus_iced_tea',     'Hibiscus Iced Tea',     'Cold Drinks', 17, 2.10, 0.45, 84.4),
  ('peach_iced_tea',        'Peach Iced Tea',        'Cold Drinks', 17, 2.30, 0.45, 83.8),
  -- Açaí
  ('acai_bowl',             'Acai Bowl',             'Açaí',        28, 7.50, 0.60, 71.1),
  ('acai_smoothie',         'Acai Smoothie',         'Açaí',        21, 5.50, 0.45, 71.7),
  -- Matcha
  ('iced_matcha',           'Iced Matcha',           'Matcha',      23, 3.80, 0.45, 81.5),
  ('matcha',                'Matcha',                'Matcha',      25, 4.00, 0.40, 82.4),
  ('creamy_vanilla_matcha', 'Creamy Vanilla Matcha', 'Matcha',      28, 5.20, 0.45, 80.5),
  ('creamy_mango_matcha',   'Creamy Mango Matcha',   'Matcha',      28, 5.80, 0.45, 78.4),
  ('matcha_blended',        'Matcha Blended',        'Matcha',      23, 4.20, 0.45, 80.7),
  -- Desserts
  ('cheesecake',            'Cheesecake',            'Desserts',    25, 6.00, 0.40, 74.4),
  ('cookies',               'Cookies',               'Desserts',    13, 2.00, 0.20, 83.1),
  ('sheen_signature',       'Sheen Signature',       'Desserts',     0, 0.00, 0.40,  0.0),
  -- Bites
  ('croissant',             'Croissant',             'Bites',       10, 2.20, 0.20, 76.0),
  ('banana_bread',          'Banana Bread',          'Bites',       10, 1.80, 0.20, 80.0);

-- ─────────────────────────────────────────────
-- Ingredients
-- ─────────────────────────────────────────────
insert into ingredients (name, category, unit, pack_size, pack_cost, cost_per_unit, notes) values
  -- Coffee
  ('Espresso Beans',      'Coffee',    'grams', '1 kg',       320.00, 0.3200, 'Single-origin Thai blend'),
  ('Filter Beans',        'Coffee',    'grams', '250 g',      280.00, 1.1200, 'Specialty V60'),
  -- Dairy
  ('Fresh Milk',          'Dairy',     'ml',    '1 L',         65.00, 0.0650, null),
  ('Oat Milk',            'Dairy',     'ml',    '1 L',        125.00, 0.1250, null),
  ('Condensed Milk',      'Dairy',     'ml',    '380 ml',      38.00, 0.1000, null),
  ('Whipping Cream',      'Dairy',     'ml',    '1 L',        180.00, 0.1800, null),
  -- Matcha
  ('Ceremonial Matcha',   'Matcha',    'grams', '100 g',      650.00, 6.5000, 'Uji region'),
  -- Fruit
  ('Açaí Purée',          'Fruit',     'grams', '400 g pack', 220.00, 0.5500, 'Frozen packs'),
  ('Banana',              'Fruit',     'piece', null,            5.00, 5.0000, null),
  ('Mixed Berries',       'Fruit',     'grams', '500 g',      180.00, 0.3600, 'Frozen'),
  ('Mango Purée',         'Fruit',     'ml',    '500 ml',     160.00, 0.3200, null),
  ('Raspberry Purée',     'Fruit',     'ml',    '500 ml',     180.00, 0.3600, null),
  ('Peach Purée',         'Fruit',     'ml',    '500 ml',     160.00, 0.3200, null),
  ('Hibiscus Tea',        'Fruit',     'grams', '250 g',      120.00, 0.4800, 'Dried flowers'),
  -- Syrup
  ('Vanilla Syrup',       'Syrup',     'ml',    '750 ml',     280.00, 0.3733, null),
  ('Caramel Syrup',       'Syrup',     'ml',    '750 ml',     280.00, 0.3733, null),
  ('Simple Syrup',        'Syrup',     'ml',    '1 L',         50.00, 0.0500, 'House-made'),
  ('Chocolate Sauce',     'Syrup',     'ml',    '750 ml',     250.00, 0.3333, null),
  -- Baking
  ('All-Purpose Flour',   'Baking',    'grams', '1 kg',        42.00, 0.0420, null),
  ('Butter',              'Baking',    'grams', '500 g',      160.00, 0.3200, null),
  ('Sugar',               'Baking',    'grams', '1 kg',        30.00, 0.0300, null),
  ('Eggs',                'Baking',    'piece', '30 tray',    135.00, 4.5000, null),
  ('Cream Cheese',        'Baking',    'grams', '250 g',       95.00, 0.3800, null),
  ('Granola',             'Baking',    'grams', '500 g',      150.00, 0.3000, 'House-made'),
  ('Honey',               'Baking',    'ml',    '500 ml',     160.00, 0.3200, 'Local raw'),
  -- Packaging
  ('Cup 12 oz + Lid',     'Packaging', 'piece', '50 pcs',     150.00, 3.0000, null),
  ('Cup 16 oz + Lid',     'Packaging', 'piece', '50 pcs',     175.00, 3.5000, null),
  ('Açaí Bowl Cup',       'Packaging', 'piece', '50 pcs',     200.00, 4.0000, null),
  ('Dessert Box',         'Packaging', 'piece', '50 pcs',     175.00, 3.5000, null),
  ('Bites Box (small)',   'Packaging', 'piece', '50 pcs',     125.00, 2.5000, null),
  ('Napkins',             'Packaging', 'piece', '500 pcs',     65.00, 0.1300, null),
  ('Paper Straw',         'Packaging', 'piece', '200 pcs',     80.00, 0.4000, null),
  -- Other
  ('Ice',                 'Other',     'grams', '5 kg bag',    25.00, 0.0050, null),
  ('Cocoa Powder',        'Other',     'grams', '250 g',       95.00, 0.3800, null);
