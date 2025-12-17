/*
  # Add Outlet Restrictions to Vouchers

  ## Overview
  This migration adds outlet-specific restriction capabilities to the voucher system,
  allowing vouchers to be limited to specific outlets or available at all outlets.

  ## Changes

  1. **vouchers table enhancements**
     - Add `outlet_restriction_type` - Controls whether voucher applies to all outlets or specific ones
     - Add `applicable_outlet_ids` - Array of outlet UUIDs where voucher is valid

  ## Business Rules
  - Default behavior: All existing vouchers apply to all outlets (backward compatible)
  - When `outlet_restriction_type` = 'all_outlets': voucher works everywhere
  - When `outlet_restriction_type` = 'specific_outlets': only works at outlets in `applicable_outlet_ids`
  - Empty `applicable_outlet_ids` with 'specific_outlets' type is invalid (validation in app)

  ## Security
  - Maintains existing RLS policies
  - No changes to access control
*/

-- =====================================================
-- ADD OUTLET RESTRICTION FIELDS TO VOUCHERS
-- =====================================================

-- Add outlet_restriction_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vouchers' AND column_name = 'outlet_restriction_type'
  ) THEN
    ALTER TABLE vouchers ADD COLUMN outlet_restriction_type text DEFAULT 'all_outlets' CHECK (outlet_restriction_type IN ('all_outlets', 'specific_outlets'));

    -- Add helpful comment
    COMMENT ON COLUMN vouchers.outlet_restriction_type IS 'Controls outlet applicability: all_outlets (default) or specific_outlets';
  END IF;
END $$;

-- Add applicable_outlet_ids column (array of outlet UUIDs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vouchers' AND column_name = 'applicable_outlet_ids'
  ) THEN
    ALTER TABLE vouchers ADD COLUMN applicable_outlet_ids uuid[] DEFAULT '{}';

    -- Add helpful comment
    COMMENT ON COLUMN vouchers.applicable_outlet_ids IS 'Array of outlet UUIDs where this voucher is valid. Empty when outlet_restriction_type is all_outlets';
  END IF;
END $$;

-- =====================================================
-- CREATE INDEX FOR PERFORMANCE
-- =====================================================

-- Index for outlet restriction queries
CREATE INDEX IF NOT EXISTS idx_vouchers_outlet_restriction_type
  ON vouchers(outlet_restriction_type);

-- GIN index for outlet IDs array searches
CREATE INDEX IF NOT EXISTS idx_vouchers_applicable_outlet_ids
  ON vouchers USING GIN (applicable_outlet_ids);

-- =====================================================
-- SET DEFAULTS FOR EXISTING VOUCHERS
-- =====================================================

-- Ensure all existing vouchers default to 'all_outlets' mode
UPDATE vouchers
SET
  outlet_restriction_type = 'all_outlets',
  applicable_outlet_ids = '{}'
WHERE outlet_restriction_type IS NULL OR applicable_outlet_ids IS NULL;

-- =====================================================
-- VALIDATION NOTES
-- =====================================================

/*
  Application-level validation should ensure:
  1. When outlet_restriction_type = 'specific_outlets':
     - applicable_outlet_ids must not be empty
     - all outlet UUIDs must exist in outlets table

  2. When outlet_restriction_type = 'all_outlets':
     - applicable_outlet_ids should be empty array

  3. Frontend should fetch outlets from database dynamically
     - Never hardcode outlet lists
     - Always sync with outlets table
*/
