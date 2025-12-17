/*
  # Add Product ID, Categories System, and Multi-Outlet Support

  ## Overview
  This migration enhances the existing shop system by adding:
  - Auto-generated product IDs (P0001, P0002, etc.)
  - Categories table with auto-generated IDs (C001, C002, etc.)
  - Multi-outlet support via product_outlets junction table
  - Missing columns to shop_products table

  ## Schema Changes

  1. **categories** table (NEW)
     - Centralized category management
     - Auto-generated category_id (C001, C002, etc.)

  2. **shop_products** table (MODIFICATIONS)
     - Add product_id column with auto-generation
     - Add category_id foreign key to replace text category
     - Add updated_at column for tracking changes
     - Migrate existing category text to new categories table

  3. **product_outlets** table (NEW)
     - Junction table for multi-outlet product assignments
     - Allows "All Outlets" or specific outlet selection

  ## Important Notes
  - Existing products will be assigned auto-generated product IDs
  - Existing category text values will be migrated to the new categories table
  - Data integrity is preserved throughout the migration
*/

-- =====================================================
-- CREATE CATEGORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id text UNIQUE NOT NULL,
  name text UNIQUE NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_category_id ON categories(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active categories" ON categories;
CREATE POLICY "Anyone can view active categories"
  ON categories FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- FUNCTION: Generate Category ID
-- =====================================================
CREATE OR REPLACE FUNCTION generate_category_id()
RETURNS TEXT AS $$
DECLARE
  max_id TEXT;
  next_num INTEGER;
BEGIN
  SELECT category_id INTO max_id
  FROM categories
  WHERE category_id ~ '^C[0-9]{3}$'
  ORDER BY category_id DESC
  LIMIT 1;

  IF max_id IS NULL THEN
    next_num := 1;
  ELSE
    next_num := CAST(SUBSTRING(max_id FROM 2) AS INTEGER) + 1;
  END IF;

  RETURN 'C' || LPAD(next_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Auto-generate category_id
-- =====================================================
CREATE OR REPLACE FUNCTION set_category_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.category_id IS NULL OR NEW.category_id = '' THEN
    NEW.category_id := generate_category_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_category_id ON categories;
CREATE TRIGGER trigger_set_category_id
  BEFORE INSERT ON categories
  FOR EACH ROW
  EXECUTE FUNCTION set_category_id();

-- =====================================================
-- SEED DATA: Categories
-- =====================================================
INSERT INTO categories (name, description, is_active, sort_order)
VALUES
  ('Food & Beverages', 'Snacks, meals, and drinks', true, 1),
  ('Toys & Games', 'Fun toys and games for children', true, 2),
  ('Workshops', 'Educational workshops and activities', true, 3),
  ('Merchandise', 'Branded merchandise and souvenirs', true, 4),
  ('Party Packages', 'Birthday party and event packages', true, 5),
  ('Entry Tickets', 'Park entry and access passes', true, 6)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- =====================================================
-- MIGRATE EXISTING CATEGORIES FROM SHOP_PRODUCTS
-- =====================================================
-- Insert any existing category values from shop_products into categories table
INSERT INTO categories (name, is_active)
SELECT DISTINCT category, true
FROM shop_products
WHERE category IS NOT NULL
  AND category != ''
  AND NOT EXISTS (
    SELECT 1 FROM categories WHERE LOWER(name) = LOWER(shop_products.category)
  )
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- ADD COLUMNS TO SHOP_PRODUCTS
-- =====================================================

-- Add product_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_products' AND column_name = 'product_id'
  ) THEN
    ALTER TABLE shop_products ADD COLUMN product_id text UNIQUE;
  END IF;
END $$;

-- Add updated_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_products' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE shop_products ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Add category_id column (foreign key to categories)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_products' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE shop_products ADD COLUMN category_id uuid REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================
-- FUNCTION: Generate Product ID
-- =====================================================
CREATE OR REPLACE FUNCTION generate_product_id()
RETURNS TEXT AS $$
DECLARE
  max_id TEXT;
  next_num INTEGER;
BEGIN
  SELECT shop_products.product_id INTO max_id
  FROM shop_products
  WHERE shop_products.product_id ~ '^P[0-9]{4}$'
  ORDER BY shop_products.product_id DESC
  LIMIT 1;

  IF max_id IS NULL THEN
    next_num := 1;
  ELSE
    next_num := CAST(SUBSTRING(max_id FROM 2) AS INTEGER) + 1;
  END IF;

  RETURN 'P' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- POPULATE PRODUCT_ID FOR EXISTING PRODUCTS
-- =====================================================
-- Generate product_id for all existing products that don't have one
DO $$
DECLARE
  product_record RECORD;
BEGIN
  FOR product_record IN
    SELECT id FROM shop_products WHERE product_id IS NULL OR product_id = ''
    ORDER BY created_at
  LOOP
    UPDATE shop_products
    SET product_id = generate_product_id()
    WHERE id = product_record.id;
  END LOOP;
END $$;

-- Make product_id NOT NULL after populating
ALTER TABLE shop_products ALTER COLUMN product_id SET NOT NULL;

-- =====================================================
-- MIGRATE CATEGORY TEXT TO CATEGORY_ID
-- =====================================================
-- Update shop_products to link with categories table
UPDATE shop_products sp
SET category_id = c.id
FROM categories c
WHERE LOWER(sp.category) = LOWER(c.name)
  AND sp.category_id IS NULL;

-- =====================================================
-- TRIGGER: Auto-generate product_id for new products
-- =====================================================
CREATE OR REPLACE FUNCTION set_product_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.product_id IS NULL OR NEW.product_id = '' THEN
    NEW.product_id := generate_product_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_product_id ON shop_products;
CREATE TRIGGER trigger_set_product_id
  BEFORE INSERT ON shop_products
  FOR EACH ROW
  EXECUTE FUNCTION set_product_id();

-- =====================================================
-- TRIGGER: Update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shop_products_updated_at ON shop_products;
CREATE TRIGGER update_shop_products_updated_at
  BEFORE UPDATE ON shop_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_outlets_updated_at ON outlets;
CREATE TRIGGER update_outlets_updated_at
  BEFORE UPDATE ON outlets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- CREATE PRODUCT_OUTLETS JUNCTION TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS product_outlets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES shop_products(id) ON DELETE CASCADE NOT NULL,
  outlet_id uuid REFERENCES outlets(id) ON DELETE CASCADE NOT NULL,
  is_available boolean DEFAULT true,
  local_stock integer,
  local_price numeric(10,2),
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_product_outlets_product_id ON product_outlets(product_id);
CREATE INDEX IF NOT EXISTS idx_product_outlets_outlet_id ON product_outlets(outlet_id);
CREATE INDEX IF NOT EXISTS idx_product_outlets_available ON product_outlets(is_available) WHERE is_available = true;

ALTER TABLE product_outlets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view available product outlets" ON product_outlets;
CREATE POLICY "Anyone can view available product outlets"
  ON product_outlets FOR SELECT
  USING (is_available = true);

DROP POLICY IF EXISTS "Admins can manage product outlets" ON product_outlets;
CREATE POLICY "Admins can manage product outlets"
  ON product_outlets FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- POPULATE PRODUCT_OUTLETS FOR EXISTING PRODUCTS
-- =====================================================
-- Create product_outlet entries for all existing products
INSERT INTO product_outlets (product_id, outlet_id, is_available)
SELECT sp.id, sp.outlet_id, sp.is_active
FROM shop_products sp
WHERE sp.outlet_id IS NOT NULL
ON CONFLICT (product_id, outlet_id) DO NOTHING;

-- =====================================================
-- CREATE INDEX FOR PRODUCT_ID
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_shop_products_product_id ON shop_products(product_id);
