/*
  # Add Balance Snapshot to Shop Orders

  1. Changes
    - Add `w_balance_after` column to shop_orders table
      - Stores the customer's W balance after this order was completed
      - Allows historical tracking of wallet state at time of purchase

    - Add `bonus_balance_after` column to shop_orders table
      - Stores the customer's bonus balance after this order was completed
      - Tracks promotional credit state at time of purchase

  2. Purpose
    - Enable accurate historical balance display in CMS
    - Provide audit trail for customer wallet transactions
    - Support customer service with point-in-time balance information

  3. Notes
    - Existing orders will have NULL values (can be backfilled later if needed)
    - New orders will capture balance snapshot on completion
    - Balance is captured AFTER the order transaction is processed
*/

-- Add balance snapshot columns to shop_orders
DO $$
BEGIN
  -- Add w_balance_after column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'w_balance_after'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN w_balance_after decimal(10,2);
    RAISE NOTICE 'Added w_balance_after column to shop_orders table';
  ELSE
    RAISE NOTICE 'w_balance_after column already exists in shop_orders table';
  END IF;

  -- Add bonus_balance_after column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'bonus_balance_after'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN bonus_balance_after decimal(10,2);
    RAISE NOTICE 'Added bonus_balance_after column to shop_orders table';
  ELSE
    RAISE NOTICE 'bonus_balance_after column already exists in shop_orders table';
  END IF;
END $$;

COMMENT ON COLUMN shop_orders.w_balance_after IS 'Customer W balance snapshot after this order was completed';
COMMENT ON COLUMN shop_orders.bonus_balance_after IS 'Customer bonus balance snapshot after this order was completed';
