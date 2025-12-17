/*
  # Fix Subcategory IDs - Complete Solution
  
  1. Purpose
    - Create the generate_subcategory_id function if it doesn't exist
    - Update all existing subcategories with NULL subcategory_id to have auto-generated IDs
    
  2. Changes
    - Create generate_subcategory_id function
    - Update existing subcategories with proper IDs (C007a, C007b, etc.)
    - Create trigger to auto-generate IDs for new subcategories
    
  3. Security
    - No security changes, just data migration and function creation
*/

-- Function to generate subcategory IDs
CREATE OR REPLACE FUNCTION generate_subcategory_id(parent_cat_id uuid)
RETURNS TEXT AS $$
DECLARE
  parent_code TEXT;
  max_id TEXT;
  next_letter_code INTEGER;
BEGIN
  -- Get the parent category code
  SELECT category_id INTO parent_code FROM categories WHERE id = parent_cat_id;

  IF parent_code IS NULL THEN
    RAISE EXCEPTION 'Parent category not found';
  END IF;

  -- Find the highest subcategory ID for this category
  SELECT subcategory_id INTO max_id
  FROM subcategories
  WHERE category_id = parent_cat_id
    AND subcategory_id IS NOT NULL
    AND subcategory_id ~ ('^' || parent_code || '[a-z]$')
  ORDER BY subcategory_id DESC
  LIMIT 1;

  -- If no existing subcategories, start with 'a'
  IF max_id IS NULL THEN
    RETURN parent_code || 'a';
  END IF;

  -- Get the next letter
  next_letter_code := ASCII(RIGHT(max_id, 1)) + 1;

  -- Check if we've exceeded 26 subcategories
  IF next_letter_code > ASCII('z') THEN
    RAISE EXCEPTION 'Maximum 26 subcategories reached for category %', parent_code;
  END IF;

  RETURN parent_code || CHR(next_letter_code);
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-generate subcategory_id
CREATE OR REPLACE FUNCTION set_subcategory_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.subcategory_id IS NULL OR NEW.subcategory_id = '' THEN
    NEW.subcategory_id := generate_subcategory_id(NEW.category_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_set_subcategory_id ON subcategories;
CREATE TRIGGER trigger_set_subcategory_id
  BEFORE INSERT ON subcategories
  FOR EACH ROW
  EXECUTE FUNCTION set_subcategory_id();

-- Now update existing subcategories with NULL subcategory_id
DO $$
DECLARE
  sub_record RECORD;
  new_id TEXT;
BEGIN
  -- Loop through all subcategories with NULL subcategory_id, ordered by category and sort_order
  FOR sub_record IN 
    SELECT id, category_id, name, sort_order
    FROM subcategories 
    WHERE subcategory_id IS NULL
    ORDER BY category_id, sort_order
  LOOP
    -- Generate the subcategory ID
    new_id := generate_subcategory_id(sub_record.category_id);
    
    -- Update the subcategory with the new ID
    UPDATE subcategories 
    SET subcategory_id = new_id, updated_at = now()
    WHERE id = sub_record.id;
    
    RAISE NOTICE 'Updated subcategory "%" (sort_order: %) with ID: %', sub_record.name, sub_record.sort_order, new_id;
  END LOOP;
END $$;
