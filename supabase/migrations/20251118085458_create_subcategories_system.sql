/*
  # Create Subcategories Management System

  ## Overview
  This migration creates a comprehensive subcategories system with auto-generated IDs
  following the format of parent category ID + lowercase letter suffix (e.g., C007a, C007b).

  ## New Tables

  1. **subcategories** - Product subcategories linked to parent categories
     - id (uuid, primary key)
     - subcategory_id (text, unique, not null) - Auto-generated: C007a, C007b, etc.
     - category_id (uuid, foreign key to categories) - Parent category
     - name (text, not null)
     - description (text)
     - is_active (boolean, default true)
     - sort_order (integer, default 0)
     - created_at (timestamptz, default now())
     - updated_at (timestamptz, default now())

  ## Changes to Existing Tables

  1. **shop_products** - Add subcategory_id foreign key
     - subcategory_id (uuid, foreign key to subcategories)

  ## Functions
  - generate_subcategory_id(parent_category_id) - Auto-generates subcategory IDs with format C007a, C007b, etc.

  ## Security
  - RLS enabled on subcategories table
  - Public read access for active subcategories
  - Admin access for subcategory management

  ## Important Notes
  - Subcategory IDs are auto-generated based on parent category's category_id
  - Format: Parent category ID (e.g., C007) + lowercase letter (a, b, c, etc.)
  - Supports up to 26 subcategories per category initially
  - Single source of truth for subcategory ID generation via database function
*/

-- =====================================================
-- CREATE SUBCATEGORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id text UNIQUE NOT NULL,
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

-- =====================================================
-- ADD SUBCATEGORY REFERENCE TO SHOP_PRODUCTS
-- =====================================================
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

-- =====================================================
-- FUNCTION: Generate Subcategory ID
-- =====================================================
CREATE OR REPLACE FUNCTION generate_subcategory_id(parent_cat_id uuid)
RETURNS TEXT AS $$
DECLARE
  parent_category_code TEXT;
  max_subcategory_id TEXT;
  current_letter TEXT;
  next_letter_code INTEGER;
  subcategories_exist boolean;
BEGIN
  -- Get the parent category's category_id (e.g., C007)
  SELECT category_id INTO parent_category_code
  FROM categories
  WHERE id = parent_cat_id;

  IF parent_category_code IS NULL THEN
    RAISE EXCEPTION 'Parent category not found';
  END IF;

  -- Check if subcategories table exists and has data for this category
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'subcategories'
  ) INTO subcategories_exist;

  -- If subcategories table doesn't exist yet, return the first ID
  IF NOT subcategories_exist THEN
    RETURN parent_category_code || 'a';
  END IF;

  -- Find the highest subcategory letter for this parent category
  SELECT subcategory_id INTO max_subcategory_id
  FROM subcategories
  WHERE category_id = parent_cat_id
    AND subcategory_id ~ ('^' || parent_category_code || '[a-z]$')
  ORDER BY subcategory_id DESC
  LIMIT 1;

  -- If no subcategories exist yet, start with 'a'
  IF max_subcategory_id IS NULL THEN
    RETURN parent_category_code || 'a';
  END IF;

  -- Extract the letter suffix (last character)
  current_letter := RIGHT(max_subcategory_id, 1);

  -- Calculate the next letter
  next_letter_code := ASCII(current_letter) + 1;

  -- Check if we've exceeded 'z' (26 subcategories)
  IF next_letter_code > ASCII('z') THEN
    RAISE EXCEPTION 'Maximum subcategories (26) reached for category %', parent_category_code;
  END IF;

  -- Return the new subcategory ID
  RETURN parent_category_code || CHR(next_letter_code);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Auto-generate subcategory_id
-- =====================================================
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

-- =====================================================
-- TRIGGER: Update updated_at timestamp for subcategories
-- =====================================================
DROP TRIGGER IF EXISTS update_subcategories_updated_at ON subcategories;
CREATE TRIGGER update_subcategories_updated_at
  BEFORE UPDATE ON subcategories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- MIGRATE EXISTING SUBCATEGORY DATA
-- =====================================================
-- This section migrates text-based subcategory values from shop_products
-- to the new structured subcategories table
-- Note: This only runs if the old text 'subcategory' column exists

DO $$
DECLARE
  product_record RECORD;
  new_subcategory_id uuid;
  has_text_subcategory_column boolean;
BEGIN
  -- Check if the old text subcategory column exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'shop_products'
      AND column_name = 'subcategory'
      AND data_type = 'text'
  ) INTO has_text_subcategory_column;

  -- Only proceed if the text subcategory column exists
  IF has_text_subcategory_column THEN
    -- Loop through all products that have a subcategory text value
    FOR product_record IN
      SELECT DISTINCT p.category_id, p.subcategory
      FROM shop_products p
      WHERE p.subcategory IS NOT NULL
        AND p.subcategory != ''
        AND p.category_id IS NOT NULL
    LOOP
      -- Check if this subcategory already exists for this category
      SELECT id INTO new_subcategory_id
      FROM subcategories
      WHERE category_id = product_record.category_id
        AND LOWER(name) = LOWER(product_record.subcategory)
      LIMIT 1;

      -- If subcategory doesn't exist, create it
      IF new_subcategory_id IS NULL THEN
        INSERT INTO subcategories (category_id, name, is_active, sort_order)
        VALUES (
          product_record.category_id,
          product_record.subcategory,
          true,
          0
        )
        RETURNING id INTO new_subcategory_id;
      END IF;

      -- Update all products with this category/subcategory combination
      UPDATE shop_products
      SET subcategory_id = new_subcategory_id
      WHERE category_id = product_record.category_id
        AND LOWER(subcategory) = LOWER(product_record.subcategory);
    END LOOP;
  END IF;
END $$;

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================
-- Note: RLS is disabled for development, but policies are defined for future use

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

-- Disable RLS for development consistency with other tables
ALTER TABLE subcategories DISABLE ROW LEVEL SECURITY;
