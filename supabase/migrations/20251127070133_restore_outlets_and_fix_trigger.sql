/*
  # Restore Outlets and Fix Trigger Issue

  ## Problem
  - Both outlets have is_active = false (should be true)
  - Both outlets have status = 'open' (should be 'active')
  - update_updated_at_column() trigger tries to set non-existent column

  ## Solution
  1. Drop problematic trigger
  2. Add updated_at column if missing
  3. Restore outlets to active state
  4. Recreate trigger correctly
*/

-- =====================================================
-- DROP PROBLEMATIC TRIGGER
-- =====================================================

DROP TRIGGER IF EXISTS update_outlets_updated_at ON outlets;

-- =====================================================
-- ADD updated_at COLUMN IF MISSING
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'outlets' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE outlets ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Added updated_at column to outlets';
  END IF;
END $$;

-- =====================================================
-- RESTORE OUTLETS TO ACTIVE STATE
-- =====================================================

-- Fix WONDERPARK MELAKA
UPDATE outlets 
SET 
  status = 'active',
  is_active = true
WHERE id = '1ff3dbea-50f4-45a7-9e91-d3ff78a23dab';

-- Fix WONDERPARK KUALA TERENGGANU
UPDATE outlets 
SET 
  status = 'active',
  is_active = true
WHERE id = '9c312ece-0d91-4456-817e-3ba7fbc1fd20';

-- =====================================================
-- RECREATE TRIGGER (NOW SAFE)
-- =====================================================

CREATE TRIGGER update_outlets_updated_at
  BEFORE UPDATE ON outlets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  outlet_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO outlet_count
  FROM outlets
  WHERE is_active = true;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Outlets Restored!';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Added updated_at column';
  RAISE NOTICE '✓ Fixed trigger';
  RAISE NOTICE '✓ Restored % active outlets', outlet_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Outlets:';
  RAISE NOTICE '  • WONDERPARK MELAKA (active)';
  RAISE NOTICE '  • WONDERPARK KUALA TERENGGANU (active)';
  RAISE NOTICE '';
  RAISE NOTICE 'Both outlets now visible to customers!';
  RAISE NOTICE '========================================';
END $$;
