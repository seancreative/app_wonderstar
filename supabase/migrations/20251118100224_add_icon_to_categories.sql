/*
  # Add Icon Field to Categories Table

  ## Overview
  This migration adds an icon field to the categories table to support
  customizable category icons in the shop interface.

  ## Changes
  1. Add `icon` column to categories table
  2. Set default icons for existing categories based on their names
  3. Allow NULL for icon field (optional)

  ## Default Icons
  - Entry Tickets/Tickets → 🎫
  - Workshops → 🎨
  - Food & Beverages/F&B → 🍔
  - Toys & Games → 🎁
  - Merchandise → 🎁
  - Party Packages → 🎉
  - Others → 🎁

  ## Notes
  - Icon field stores emoji or icon identifier (text)
  - Admins can customize icons through CMS
  - Default icons provide good UX out of the box
*/

-- Add icon column to categories table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'icon'
  ) THEN
    ALTER TABLE categories ADD COLUMN icon text;
  END IF;
END $$;

-- Set default icons for existing categories
UPDATE categories SET icon = '🎫' WHERE LOWER(name) LIKE '%ticket%' AND icon IS NULL;
UPDATE categories SET icon = '🎨' WHERE LOWER(name) LIKE '%workshop%' AND icon IS NULL;
UPDATE categories SET icon = '🍔' WHERE LOWER(name) LIKE '%food%' OR LOWER(name) LIKE '%beverage%' OR LOWER(name) = 'f&b' AND icon IS NULL;
UPDATE categories SET icon = '🎁' WHERE LOWER(name) LIKE '%toy%' OR LOWER(name) LIKE '%game%' AND icon IS NULL;
UPDATE categories SET icon = '🎁' WHERE LOWER(name) LIKE '%merch%' AND icon IS NULL;
UPDATE categories SET icon = '🎉' WHERE LOWER(name) LIKE '%party%' OR LOWER(name) LIKE '%package%' AND icon IS NULL;
UPDATE categories SET icon = '🎁' WHERE LOWER(name) LIKE '%other%' AND icon IS NULL;

-- Set default icon for any categories without an icon
UPDATE categories SET icon = '🎁' WHERE icon IS NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_categories_icon ON categories(icon);
