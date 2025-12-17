/*
  # Create Subcategories Management System - Simplified

  Creates subcategories table with auto-generated IDs in format C007a, C007b, etc.
*/

-- Create subcategories table
CREATE TABLE IF NOT EXISTS subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id text UNIQUE NOT NULL DEFAULT '',
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_subcategories_subcategory_id ON subcategories(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_active ON subcategories(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_subcategories_sort_order ON subcategories(category_id, sort_order);

-- Add subcategory_id column to shop_products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_products' AND column_name = 'subcategory_id'
  ) THEN
    ALTER TABLE shop_products ADD COLUMN subcategory_id uuid REFERENCES subcategories(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_shop_products_subcategory_id ON shop_products(subcategory_id);
  END IF;
END $$;

-- Function to generate subcategory IDs
CREATE OR REPLACE FUNCTION generate_subcategory_id(parent_cat_id uuid)
RETURNS TEXT AS $$
DECLARE
  parent_code TEXT;
  max_id TEXT;
  next_letter_code INTEGER;
BEGIN
  SELECT category_id INTO parent_code FROM categories WHERE id = parent_cat_id;

  IF parent_code IS NULL THEN
    RAISE EXCEPTION 'Parent category not found';
  END IF;

  SELECT subcategory_id INTO max_id
  FROM subcategories
  WHERE category_id = parent_cat_id
    AND subcategory_id ~ ('^' || parent_code || '[a-z]$')
  ORDER BY subcategory_id DESC
  LIMIT 1;

  IF max_id IS NULL THEN
    RETURN parent_code || 'a';
  END IF;

  next_letter_code := ASCII(RIGHT(max_id, 1)) + 1;

  IF next_letter_code > ASCII('z') THEN
    RAISE EXCEPTION 'Maximum 26 subcategories reached for category %', parent_code;
  END IF;

  RETURN parent_code || CHR(next_letter_code);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate subcategory_id
CREATE OR REPLACE FUNCTION set_subcategory_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.subcategory_id IS NULL OR NEW.subcategory_id = '' THEN
    NEW.subcategory_id := generate_subcategory_id(NEW.category_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_subcategory_id ON subcategories;
CREATE TRIGGER trigger_set_subcategory_id
  BEFORE INSERT ON subcategories
  FOR EACH ROW
  EXECUTE FUNCTION set_subcategory_id();

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_subcategories_updated_at ON subcategories;
CREATE TRIGGER update_subcategories_updated_at
  BEFORE UPDATE ON subcategories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS setup
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active subcategories" ON subcategories;
CREATE POLICY "Anyone can view active subcategories"
  ON subcategories FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage subcategories" ON subcategories;
CREATE POLICY "Admins can manage subcategories"
  ON subcategories FOR ALL
  USING (true)
  WITH CHECK (true);

-- Disable RLS for development
ALTER TABLE subcategories DISABLE ROW LEVEL SECURITY;
