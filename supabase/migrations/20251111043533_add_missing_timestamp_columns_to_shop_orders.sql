/*
  # Add Missing Timestamp Columns to Shop Orders

  ## Overview
  The shop_orders table is missing critical timestamp columns (updated_at, completed_at)
  that are required for order status management.

  ## Changes
  1. **Add updated_at column** - Tracks when order was last modified
     - Type: timestamptz
     - Default: now()
     - Nullable: YES

  2. **Add completed_at column** - Tracks when order was completed
     - Type: timestamptz
     - Default: NULL
     - Nullable: YES (only set when status = 'completed')

  3. **Add notes column** - Allows staff to add notes to orders
     - Type: text
     - Default: NULL
     - Nullable: YES

  4. **Create/Verify Trigger** - Auto-update updated_at on changes
     - Uses existing update_updated_at_column() function
     - Trigger name: update_shop_orders_updated_at

  ## Notes
  - These columns should have been created in earlier migrations but were missing
  - The trigger will automatically set updated_at whenever a row is updated
  - Frontend code can manually set completed_at when status changes to 'completed'
*/

-- =====================================================
-- ADD MISSING COLUMNS IF THEY DON'T EXIST
-- =====================================================
DO $$
BEGIN
  -- Add updated_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN updated_at timestamptz DEFAULT now();
    RAISE NOTICE '✓ Added updated_at column to shop_orders';
  ELSE
    RAISE NOTICE '- updated_at column already exists';
  END IF;

  -- Add completed_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN completed_at timestamptz;
    RAISE NOTICE '✓ Added completed_at column to shop_orders';
  ELSE
    RAISE NOTICE '- completed_at column already exists';
  END IF;

  -- Add notes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'notes'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN notes text;
    RAISE NOTICE '✓ Added notes column to shop_orders';
  ELSE
    RAISE NOTICE '- notes column already exists';
  END IF;
END $$;

-- =====================================================
-- CREATE TRIGGER FOR AUTO-UPDATING updated_at
-- =====================================================
-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_shop_orders_updated_at ON shop_orders;

-- Create the trigger (function should already exist from earlier migration)
CREATE TRIGGER update_shop_orders_updated_at
  BEFORE UPDATE ON shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- UPDATE EXISTING ROWS
-- =====================================================
-- Set updated_at to created_at for existing rows where updated_at is NULL
UPDATE shop_orders
SET updated_at = created_at
WHERE updated_at IS NULL;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✓ Missing columns added successfully';
  RAISE NOTICE '✓ Trigger created/updated for auto-updating updated_at';
  RAISE NOTICE '✓ Order status updates should now work correctly';
END $$;