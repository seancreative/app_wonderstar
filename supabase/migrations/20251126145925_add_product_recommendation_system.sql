/*
  # Add Product Recommendation System

  ## Overview
  This migration adds the ability to pin products as "Recommended" at the top of their
  category pages with custom sort ordering.

  ## Changes

  1. **New Columns to shop_products**
     - `is_recommended` (boolean) - Marks product as recommended/pinned
     - `recommended_sort_order` (integer) - Custom sort order for recommended products within category

  2. **Indexes**
     - Composite index on (category_id, is_recommended, recommended_sort_order) for optimized queries

  3. **Notes**
     - Recommended products will appear first in their category
     - Sort order allows fine-grained control over recommended product positioning
     - Lower sort_order numbers appear first
*/

-- Add recommendation columns to shop_products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_products' AND column_name = 'is_recommended'
  ) THEN
    ALTER TABLE shop_products
    ADD COLUMN is_recommended boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_products' AND column_name = 'recommended_sort_order'
  ) THEN
    ALTER TABLE shop_products
    ADD COLUMN recommended_sort_order integer DEFAULT 0;
  END IF;
END $$;

-- Create composite index for optimized querying of recommended products
CREATE INDEX IF NOT EXISTS idx_shop_products_category_recommended
  ON shop_products(category_id, is_recommended DESC, recommended_sort_order ASC);

-- Create index for recommended products only
CREATE INDEX IF NOT EXISTS idx_shop_products_recommended
  ON shop_products(is_recommended)
  WHERE is_recommended = true;

-- Add comment to columns
COMMENT ON COLUMN shop_products.is_recommended IS 'Marks product as recommended/pinned to top of category';
COMMENT ON COLUMN shop_products.recommended_sort_order IS 'Sort order for recommended products (lower numbers appear first)';