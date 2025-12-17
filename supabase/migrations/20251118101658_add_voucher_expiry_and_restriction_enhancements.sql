/*
  # Add Voucher Expiry Date and Restriction Type Enhancements

  ## Overview
  This migration adds new features to the voucher and product management system:
  1. "Valid for today only" option for vouchers
  2. Special discount marking for products
  3. Subcategory-based voucher restrictions
  4. Special discount product voucher restrictions

  ## Changes to Existing Tables

  ### shop_products
  - Add special_discount boolean field to mark products eligible for special discount vouchers
  - Add index for performance optimization

  ### vouchers
  - Add valid_for_today_only boolean field for same-day redemption vouchers
  - Add eligible_subcategory_ids text array for subcategory-based restrictions
  - Update indexes for new fields

  ## New Features
  1. **Same Date Redemption**: Vouchers can be set to expire on the same day they're redeemed
  2. **Special Discount Products**: Products can be marked for special promotional vouchers
  3. **Subcategory Restrictions**: Vouchers can be restricted to specific subcategories
  4. **Special Discount Restrictions**: Vouchers can target all special discount products

  ## Security
  - No RLS changes required (RLS is disabled for development)
  - All new fields are optional with safe defaults
*/

-- =====================================================
-- ADD SPECIAL_DISCOUNT TO SHOP_PRODUCTS
-- =====================================================

-- Add special_discount column to shop_products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_products' AND column_name = 'special_discount'
  ) THEN
    ALTER TABLE shop_products
    ADD COLUMN special_discount boolean DEFAULT false NOT NULL;

    -- Create index for filtering special discount products
    CREATE INDEX IF NOT EXISTS idx_shop_products_special_discount
    ON shop_products(special_discount) WHERE special_discount = true;

    RAISE NOTICE 'Added special_discount column to shop_products table';
  ELSE
    RAISE NOTICE 'special_discount column already exists in shop_products table';
  END IF;
END $$;

-- =====================================================
-- ADD VALID_FOR_TODAY_ONLY TO VOUCHERS
-- =====================================================

-- Add valid_for_today_only column to vouchers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vouchers' AND column_name = 'valid_for_today_only'
  ) THEN
    ALTER TABLE vouchers
    ADD COLUMN valid_for_today_only boolean DEFAULT false NOT NULL;

    -- Create index for filtering today-only vouchers
    CREATE INDEX IF NOT EXISTS idx_vouchers_valid_for_today_only
    ON vouchers(valid_for_today_only) WHERE valid_for_today_only = true;

    RAISE NOTICE 'Added valid_for_today_only column to vouchers table';
  ELSE
    RAISE NOTICE 'valid_for_today_only column already exists in vouchers table';
  END IF;
END $$;

-- =====================================================
-- ADD ELIGIBLE_SUBCATEGORY_IDS TO VOUCHERS
-- =====================================================

-- Add eligible_subcategory_ids column to vouchers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vouchers' AND column_name = 'eligible_subcategory_ids'
  ) THEN
    ALTER TABLE vouchers
    ADD COLUMN eligible_subcategory_ids text[] DEFAULT '{}' NOT NULL;

    -- Create GIN index for array operations
    CREATE INDEX IF NOT EXISTS idx_vouchers_eligible_subcategory_ids
    ON vouchers USING GIN(eligible_subcategory_ids);

    RAISE NOTICE 'Added eligible_subcategory_ids column to vouchers table';
  ELSE
    RAISE NOTICE 'eligible_subcategory_ids column already exists in vouchers table';
  END IF;
END $$;

-- =====================================================
-- HELPER FUNCTION: Get Special Discount Products
-- =====================================================

-- Function to get all product IDs marked as special discount
CREATE OR REPLACE FUNCTION get_special_discount_product_ids()
RETURNS text[] AS $$
DECLARE
  product_ids text[];
BEGIN
  SELECT array_agg(product_id)
  INTO product_ids
  FROM shop_products
  WHERE special_discount = true AND is_active = true;

  RETURN COALESCE(product_ids, '{}');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- HELPER FUNCTION: Validate Today-Only Voucher
-- =====================================================

-- Function to check if a today-only voucher is still valid
CREATE OR REPLACE FUNCTION is_today_only_voucher_valid(voucher_id uuid)
RETURNS boolean AS $$
DECLARE
  voucher_record RECORD;
BEGIN
  SELECT valid_for_today_only, expires_at
  INTO voucher_record
  FROM vouchers
  WHERE id = voucher_id;

  -- If not a today-only voucher, check normal expiry
  IF NOT voucher_record.valid_for_today_only THEN
    RETURN voucher_record.expires_at IS NULL OR voucher_record.expires_at >= now();
  END IF;

  -- For today-only vouchers, check if expires_at is today
  IF voucher_record.expires_at IS NULL THEN
    RETURN false;
  END IF;

  RETURN DATE(voucher_record.expires_at) = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN shop_products.special_discount IS 'Marks product as eligible for special discount vouchers';
COMMENT ON COLUMN vouchers.valid_for_today_only IS 'When true, voucher is only valid on the date specified in expires_at';
COMMENT ON COLUMN vouchers.eligible_subcategory_ids IS 'Array of subcategory IDs this voucher can be applied to';
COMMENT ON FUNCTION get_special_discount_product_ids() IS 'Returns array of all active special discount product IDs';
COMMENT ON FUNCTION is_today_only_voucher_valid(uuid) IS 'Validates if a today-only voucher is still valid for redemption';
