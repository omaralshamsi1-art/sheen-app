ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description text DEFAULT NULL;

-- Add bean descriptions
UPDATE menu_items SET description = 'Espresso Roast | Region: Oromia, West | Variety: Heirloom | Process: Natural | Altitude: 2,215 MASL | Tasting Notes: Stone Fruit, White Grapes, Dried Strawberry, Bright Acidity, Medium Body' WHERE id = 'ethiopia_guji_hambela_250g';

UPDATE menu_items SET description = 'Filter Roast | Region: Risaralda | Producer: Julio Madrid | Variety: Caturra | Process: Culturing Barrel | Altitude: 1,400 MASL | Tasting Notes: Chocolate, Tobacco, Vanilla, Licorice' WHERE id = 'colombia_tobacco_250g';

UPDATE menu_items SET description = 'Espresso Roast | Region: Santos | Variety: Red Catuai | Process: Natural | Altitude: 1,150 MASL | Tasting Notes: Roasted Hazelnut, Sugar Cane, Walnut, Low Acidity, Creamy Body' WHERE id = 'brazil_250g';
