/*
  # Add confirmed_at Column to Shop Orders

  ## Overview
  Add confirmed_at timestamp to track when payment is confirmed and QR code is generated.

  ## Changes
  1. **Add confirmed_at column**
     - Type: timestamptz
     - Default: NULL
     - Nullable: YES (only set when payment is confirmed)

  ## Purpose
  - Track exact time when order payment was confirmed
  - Distinguish between pending orders (no QR) and confirmed orders (with QR)
  - Critical for payment flow: QR code generated only after payment success
*/

-- Add confirmed_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'confirmed_at'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN confirmed_at timestamptz;
    RAISE NOTICE '✓ Added confirmed_at column to shop_orders';
  ELSE
    RAISE NOTICE '- confirmed_at column already exists';
  END IF;
END $$;

-- Update existing confirmed orders to have confirmed_at set
UPDATE shop_orders
SET confirmed_at = updated_at
WHERE status = 'confirmed' AND confirmed_at IS NULL;