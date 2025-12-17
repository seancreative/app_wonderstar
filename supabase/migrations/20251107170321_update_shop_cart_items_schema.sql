/*
  # Update shop_cart_items Table Schema

  1. Schema Changes
    - Rename `price_snapshot` to `unit_price` for consistency with code
    - Add `metadata` column to store product info (product_name, category, variants, addons)
    - Keep existing columns for backward compatibility
    - Update RLS policies if needed

  2. Notes
    - This migration ensures the table schema matches the application code expectations
    - Existing data will be preserved
*/

-- Add unit_price column (copy from price_snapshot for existing data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_cart_items' AND column_name = 'unit_price'
  ) THEN
    ALTER TABLE shop_cart_items ADD COLUMN unit_price numeric(10,2);
    -- Copy existing price_snapshot values to unit_price
    UPDATE shop_cart_items SET unit_price = price_snapshot WHERE price_snapshot IS NOT NULL;
  END IF;
END $$;

-- Add metadata column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_cart_items' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE shop_cart_items ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE shop_cart_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view own cart items" ON shop_cart_items;
DROP POLICY IF EXISTS "Users can insert own cart items" ON shop_cart_items;
DROP POLICY IF EXISTS "Users can update own cart items" ON shop_cart_items;
DROP POLICY IF EXISTS "Users can delete own cart items" ON shop_cart_items;

-- Create policies for authenticated users
CREATE POLICY "Users can view own cart items"
  ON shop_cart_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cart items"
  ON shop_cart_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cart items"
  ON shop_cart_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own cart items"
  ON shop_cart_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shop_cart_items_user_id ON shop_cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_cart_items_product_id ON shop_cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_shop_cart_items_outlet_id ON shop_cart_items(outlet_id);
