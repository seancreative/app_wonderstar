/*
  # Add Product Application Method to Vouchers

  ## Overview
  Adds a new field to control how product-level vouchers apply discounts:
  - 'total_once': Apply discount once to total (e.g., RM5 off total)
  - 'per_product': Apply discount to each applicable product (e.g., RM5 × 5 products = RM25)

  ## Changes
  1. New Column
    - `product_application_method` in vouchers table
      - Type: text with CHECK constraint
      - Values: 'total_once' or 'per_product'
      - Default: 'total_once' (backward compatible)
      - Only relevant when application_scope = 'product_level'

  2. Security
    - No RLS changes needed (inherits existing policies)

  ## Notes
  - Backward compatible: Existing vouchers default to 'total_once'
  - Only applies to product-level vouchers
  - Order-total vouchers ignore this field
*/

-- =====================================================
-- ADD PRODUCT APPLICATION METHOD COLUMN
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vouchers' AND column_name = 'product_application_method'
  ) THEN
    ALTER TABLE vouchers 
    ADD COLUMN product_application_method text DEFAULT 'total_once' 
    CHECK (product_application_method IN ('total_once', 'per_product'));
    
    RAISE NOTICE 'Added product_application_method column to vouchers';
  ELSE
    RAISE NOTICE 'product_application_method column already exists';
  END IF;
END $$;

-- =====================================================
-- UPDATE EXISTING PRODUCT-LEVEL VOUCHERS
-- =====================================================

-- Set existing product-level vouchers to use 'total_once' method (current behavior)
UPDATE vouchers
SET product_application_method = 'total_once'
WHERE application_scope = 'product_level'
  AND product_application_method IS NULL;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  product_voucher_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO product_voucher_count
  FROM vouchers
  WHERE application_scope = 'product_level';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Product Application Method Added!';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Added product_application_method column';
  RAISE NOTICE '✓ Default value: total_once';
  RAISE NOTICE '✓ Updated % existing product-level vouchers', product_voucher_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Application Methods:';
  RAISE NOTICE '  • total_once: Apply discount once to total';
  RAISE NOTICE '  • per_product: Apply discount to each product';
  RAISE NOTICE '========================================';
END $$;
