/*
  # Product Modifiers and Customization System

  1. New Tables
    - `modifier_groups`
      - Stores modifier group templates (e.g., "Size", "Add-ons", "Flavors")
      - Supports two types: single_choice and multiple_choice
      - Can be used as templates or product-specific

    - `modifier_options`
      - Individual options within each modifier group
      - Includes option name, addon price, and default selection flag

    - `product_modifiers`
      - Junction table linking products to modifier groups
      - Tracks which modifiers apply to which products
      - Includes ordering and required/optional flags

  2. Features
    - Single choice modifiers (radio selection, one option only)
    - Multiple choice modifiers (checkbox selection, multiple options)
    - Quantity selector for multiple choice options
    - Min/Max selection constraints
    - Template system for reusable modifier groups
    - Default option selection for single choice
    - Addon pricing per option

  3. Security
    - RLS disabled for development/admin access
    - Proper indexes for performance
*/

-- Create modifier_groups table
CREATE TABLE IF NOT EXISTS modifier_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  modifier_type text NOT NULL CHECK (modifier_type IN ('single_choice', 'multiple_choice')),

  -- Multiple choice specific settings
  enable_quantity_selector boolean DEFAULT false,
  min_selections integer DEFAULT 0 CHECK (min_selections >= 0),
  max_selections integer CHECK (max_selections IS NULL OR max_selections >= min_selections),

  -- Template settings
  is_template boolean DEFAULT false,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create modifier_options table
CREATE TABLE IF NOT EXISTS modifier_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_group_id uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,

  option_name text NOT NULL,
  addon_price numeric(10, 2) NOT NULL DEFAULT 0 CHECK (addon_price >= 0),

  -- Single choice default selection
  is_default boolean DEFAULT false,

  -- Display order
  sort_order integer DEFAULT 0,

  -- Metadata
  created_at timestamptz DEFAULT now()
);

-- Create product_modifiers junction table
CREATE TABLE IF NOT EXISTS product_modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  modifier_group_id uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,

  -- Configuration
  is_required boolean DEFAULT false,
  sort_order integer DEFAULT 0,

  -- Metadata
  created_at timestamptz DEFAULT now(),

  -- Prevent duplicate assignments
  UNIQUE(product_id, modifier_group_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_modifier_groups_is_template ON modifier_groups(is_template);
CREATE INDEX IF NOT EXISTS idx_modifier_options_group_id ON modifier_options(modifier_group_id);
CREATE INDEX IF NOT EXISTS idx_modifier_options_sort_order ON modifier_options(modifier_group_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_product_modifiers_product_id ON product_modifiers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_modifiers_group_id ON product_modifiers(modifier_group_id);
CREATE INDEX IF NOT EXISTS idx_product_modifiers_sort_order ON product_modifiers(product_id, sort_order);

-- Disable RLS for development (admin access)
ALTER TABLE modifier_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_options DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_modifiers DISABLE ROW LEVEL SECURITY;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_modifier_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_modifier_groups_updated_at ON modifier_groups;
CREATE TRIGGER trigger_modifier_groups_updated_at
  BEFORE UPDATE ON modifier_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_modifier_groups_updated_at();

-- Function to validate single choice has only one default
CREATE OR REPLACE FUNCTION validate_single_choice_default()
RETURNS TRIGGER AS $$
DECLARE
  group_type text;
  default_count integer;
BEGIN
  -- Get the modifier group type
  SELECT modifier_type INTO group_type
  FROM modifier_groups
  WHERE id = NEW.modifier_group_id;

  -- If this is a single choice group and is_default is true
  IF group_type = 'single_choice' AND NEW.is_default = true THEN
    -- Count existing defaults for this group
    SELECT COUNT(*) INTO default_count
    FROM modifier_options
    WHERE modifier_group_id = NEW.modifier_group_id
      AND is_default = true
      AND id != COALESCE(NEW.id, gen_random_uuid());

    -- If there's already a default, set this one to false
    IF default_count > 0 THEN
      NEW.is_default = false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce single default for single choice groups
DROP TRIGGER IF EXISTS trigger_validate_single_choice_default ON modifier_options;
CREATE TRIGGER trigger_validate_single_choice_default
  BEFORE INSERT OR UPDATE ON modifier_options
  FOR EACH ROW
  EXECUTE FUNCTION validate_single_choice_default();

-- Insert some example modifier templates
INSERT INTO modifier_groups (name, description, modifier_type, is_template) VALUES
  ('Size', 'Product size options', 'single_choice', true),
  ('Ice Level', 'Ice level preference', 'single_choice', true),
  ('Sugar Level', 'Sugar level preference', 'single_choice', true),
  ('Add-ons', 'Extra toppings and add-ons', 'multiple_choice', true),
  ('Extra Toppings', 'Additional toppings', 'multiple_choice', true)
ON CONFLICT DO NOTHING;

-- Insert example options for Size template
INSERT INTO modifier_options (modifier_group_id, option_name, addon_price, is_default, sort_order)
SELECT id, 'Small', 0, true, 1 FROM modifier_groups WHERE name = 'Size' AND is_template = true
UNION ALL
SELECT id, 'Medium', 2.00, false, 2 FROM modifier_groups WHERE name = 'Size' AND is_template = true
UNION ALL
SELECT id, 'Large', 4.00, false, 3 FROM modifier_groups WHERE name = 'Size' AND is_template = true
ON CONFLICT DO NOTHING;

-- Insert example options for Ice Level template
INSERT INTO modifier_options (modifier_group_id, option_name, addon_price, is_default, sort_order)
SELECT id, 'Regular Ice', 0, true, 1 FROM modifier_groups WHERE name = 'Ice Level' AND is_template = true
UNION ALL
SELECT id, 'Less Ice', 0, false, 2 FROM modifier_groups WHERE name = 'Ice Level' AND is_template = true
UNION ALL
SELECT id, 'No Ice', 0, false, 3 FROM modifier_groups WHERE name = 'Ice Level' AND is_template = true
ON CONFLICT DO NOTHING;

-- Insert example options for Sugar Level template
INSERT INTO modifier_options (modifier_group_id, option_name, addon_price, is_default, sort_order)
SELECT id, '100%', 0, true, 1 FROM modifier_groups WHERE name = 'Sugar Level' AND is_template = true
UNION ALL
SELECT id, '75%', 0, false, 2 FROM modifier_groups WHERE name = 'Sugar Level' AND is_template = true
UNION ALL
SELECT id, '50%', 0, false, 3 FROM modifier_groups WHERE name = 'Sugar Level' AND is_template = true
UNION ALL
SELECT id, '25%', 0, false, 4 FROM modifier_groups WHERE name = 'Sugar Level' AND is_template = true
UNION ALL
SELECT id, 'No Sugar', 0, false, 5 FROM modifier_groups WHERE name = 'Sugar Level' AND is_template = true
ON CONFLICT DO NOTHING;

-- Insert example options for Add-ons template
INSERT INTO modifier_options (modifier_group_id, option_name, addon_price, sort_order)
SELECT id, 'Pearl', 1.50, 1 FROM modifier_groups WHERE name = 'Add-ons' AND is_template = true
UNION ALL
SELECT id, 'Coconut Jelly', 1.50, 2 FROM modifier_groups WHERE name = 'Add-ons' AND is_template = true
UNION ALL
SELECT id, 'Pudding', 2.00, 3 FROM modifier_groups WHERE name = 'Add-ons' AND is_template = true
UNION ALL
SELECT id, 'Red Bean', 1.50, 4 FROM modifier_groups WHERE name = 'Add-ons' AND is_template = true
UNION ALL
SELECT id, 'Grass Jelly', 1.50, 5 FROM modifier_groups WHERE name = 'Add-ons' AND is_template = true
ON CONFLICT DO NOTHING;

-- Update Add-ons template to enable quantity selector with min/max
UPDATE modifier_groups
SET enable_quantity_selector = true,
    min_selections = 0,
    max_selections = 5
WHERE name = 'Add-ons' AND is_template = true;