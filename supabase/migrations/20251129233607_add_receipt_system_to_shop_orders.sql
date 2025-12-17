/*
  # Add Receipt System to Shop Orders

  1. New Columns
    - `receipt_number` (TEXT)
      - Unique receipt number in format RYYMMDD-#### (e.g., R251130-1923)
      - Generated when receipt is first created
      
    - `receipt_data` (JSONB)
      - Complete receipt information stored permanently
      - Includes company, customer, outlet, items, pricing details
      - Frozen snapshot at time of receipt generation
      
    - `receipt_generated_at` (TIMESTAMPTZ)
      - Timestamp when receipt was first generated
      - NULL for orders without generated receipts

  2. Purpose
    - Enable official e-receipt system for customers and CMS
    - Store permanent record of transaction details
    - Ensure data accuracy even if products/prices change
    - Legal compliance for business records
    - Professional receipt display and printing

  3. Receipt Number Format
    - R = Receipt prefix
    - YYMMDD = Date (2-digit year, month, day)
    - #### = 4 random digits (1000-9999)
    - Example: R251130-1923

  4. Notes
    - Existing orders will have NULL receipt fields
    - Receipts generated on-demand when first viewed (lazy generation)
    - Once generated, receipt_data is permanent and never changes
    - Receipt accessible from CMS Orders and customer MyQR page
*/

-- Add receipt system columns to shop_orders
DO $$
BEGIN
  -- Add receipt_number column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'receipt_number'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN receipt_number text UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_shop_orders_receipt_number ON shop_orders(receipt_number);
    RAISE NOTICE 'Added receipt_number column to shop_orders table';
  ELSE
    RAISE NOTICE 'receipt_number column already exists in shop_orders table';
  END IF;

  -- Add receipt_data column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'receipt_data'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN receipt_data jsonb;
    RAISE NOTICE 'Added receipt_data column to shop_orders table';
  ELSE
    RAISE NOTICE 'receipt_data column already exists in shop_orders table';
  END IF;

  -- Add receipt_generated_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'receipt_generated_at'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN receipt_generated_at timestamptz;
    RAISE NOTICE 'Added receipt_generated_at column to shop_orders table';
  ELSE
    RAISE NOTICE 'receipt_generated_at column already exists in shop_orders table';
  END IF;
END $$;

COMMENT ON COLUMN shop_orders.receipt_number IS 'Unique receipt number in format RYYMMDD-#### (e.g., R251130-1923)';
COMMENT ON COLUMN shop_orders.receipt_data IS 'Complete receipt information stored permanently as JSONB snapshot';
COMMENT ON COLUMN shop_orders.receipt_generated_at IS 'Timestamp when receipt was first generated (NULL if not yet generated)';
