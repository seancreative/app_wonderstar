/*
  # Add order_id to stamps_redemptions

  1. Changes
    - Add order_id column to stamps_redemptions table to link redemptions to shop orders
    - This allows stamp redemptions to generate RM0.00 orders with QR codes
    
  2. Notes
    - Nullable to support existing redemptions without orders
    - Future redemptions will always have an order_id
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stamps_redemptions' 
    AND column_name = 'order_id'
  ) THEN
    ALTER TABLE stamps_redemptions 
    ADD COLUMN order_id uuid REFERENCES shop_orders(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_stamps_redemptions_order_id 
    ON stamps_redemptions(order_id);
  END IF;
END $$;
