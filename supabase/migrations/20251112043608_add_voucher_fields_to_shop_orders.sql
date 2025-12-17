/*
  # Add Voucher Fields to Shop Orders

  ## Overview
  Adds voucher tracking columns to shop_orders table to properly track which
  vouchers were used in orders.

  ## Changes
  1. **shop_orders table**
     - Add `voucher_id` (uuid) - References the voucher template used
     - Add `voucher_code` (text) - Stores the voucher code for easy reference
     - Add `user_voucher_id` (uuid) - References the specific user_voucher used

  ## Purpose
  - Track voucher usage in orders
  - Enable proper redemption counting in CMS
  - Support voucher analytics and reporting
*/

-- Add voucher tracking columns to shop_orders
DO $$
BEGIN
  -- Add voucher_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'voucher_id'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN voucher_id uuid REFERENCES vouchers(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_shop_orders_voucher_id ON shop_orders(voucher_id);
  END IF;

  -- Add voucher_code column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'voucher_code'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN voucher_code text;
  END IF;

  -- Add user_voucher_id column to track which specific user voucher was used
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'user_voucher_id'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN user_voucher_id uuid REFERENCES user_vouchers(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_shop_orders_user_voucher_id ON shop_orders(user_voucher_id);
  END IF;
END $$;

COMMENT ON COLUMN shop_orders.voucher_id IS 'Reference to the voucher template that was used';
COMMENT ON COLUMN shop_orders.voucher_code IS 'Voucher code used for easy reference and display';
COMMENT ON COLUMN shop_orders.user_voucher_id IS 'Reference to the specific user_voucher instance that was consumed';
