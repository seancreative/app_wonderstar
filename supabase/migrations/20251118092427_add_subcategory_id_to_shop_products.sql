/*
  # Add subcategory_id to shop_products
  
  1. Purpose
    - Add subcategory_id column to shop_products table to link products to subcategories
    
  2. Changes
    - Add subcategory_id column as foreign key to subcategories table
    - Add index for performance
    
  3. Security
    - No security changes
*/

-- Add subcategory_id column to shop_products if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_products' AND column_name = 'subcategory_id'
  ) THEN
    ALTER TABLE shop_products 
    ADD COLUMN subcategory_id uuid REFERENCES subcategories(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_shop_products_subcategory_id 
    ON shop_products(subcategory_id);
    
    RAISE NOTICE 'Added subcategory_id column to shop_products table';
  ELSE
    RAISE NOTICE 'subcategory_id column already exists in shop_products table';
  END IF;
END $$;
