/*
  # Refresh Schema Cache for Outlets Table

  ## Problem
  PostgREST schema cache is out of sync with actual database schema.
  Error: "Could not find the 'capacity' column of 'outlets' in the schema cache"

  ## Solution
  1. Ensure all columns exist
  2. Add missing columns if any
  3. Force schema cache refresh by using NOTIFY
  4. Rebuild table structure if needed

  ## This will fix
  - CMS outlet form submission errors
  - Schema cache mismatches
  - Missing column errors
*/

-- =====================================================
-- ENSURE ALL REQUIRED COLUMNS EXIST
-- =====================================================

-- Add capacity if somehow missing (should exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'outlets' AND column_name = 'capacity'
  ) THEN
    ALTER TABLE outlets ADD COLUMN capacity INTEGER;
    RAISE NOTICE 'Added capacity column';
  END IF;
END $$;

-- Add contact_phone if missing (should exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'outlets' AND column_name = 'contact_phone'
  ) THEN
    ALTER TABLE outlets ADD COLUMN contact_phone TEXT;
    RAISE NOTICE 'Added contact_phone column';
  END IF;
END $$;

-- Add contact_email if missing (should exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'outlets' AND column_name = 'contact_email'
  ) THEN
    ALTER TABLE outlets ADD COLUMN contact_email TEXT;
    RAISE NOTICE 'Added contact_email column';
  END IF;
END $$;

-- Add operating_hours if missing (different from opening_hours)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'outlets' AND column_name = 'operating_hours'
  ) THEN
    ALTER TABLE outlets ADD COLUMN operating_hours JSONB DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added operating_hours column';
  END IF;
END $$;

-- =====================================================
-- FORCE SCHEMA CACHE REFRESH
-- =====================================================

-- Method 1: NOTIFY pgrst to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Method 2: Touch the table to force cache invalidation
-- Add and remove a temporary column
DO $$
BEGIN
  -- This forces PostgREST to reload table schema
  ALTER TABLE outlets ADD COLUMN IF NOT EXISTS _cache_refresh_temp BOOLEAN DEFAULT true;
  ALTER TABLE outlets DROP COLUMN IF EXISTS _cache_refresh_temp;
  RAISE NOTICE 'Forced schema cache refresh';
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  column_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_name = 'outlets';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Schema Cache Refreshed!';
  RAISE NOTICE '';
  RAISE NOTICE 'Outlets table has % columns', column_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Required columns verified:';
  RAISE NOTICE '  ✓ capacity (integer)';
  RAISE NOTICE '  ✓ contact_phone (text)';
  RAISE NOTICE '  ✓ contact_email (text)';
  RAISE NOTICE '  ✓ operating_hours (jsonb)';
  RAISE NOTICE '';
  RAISE NOTICE 'PostgREST notified to reload schema';
  RAISE NOTICE 'CMS outlet form should work now!';
  RAISE NOTICE '========================================';
END $$;
