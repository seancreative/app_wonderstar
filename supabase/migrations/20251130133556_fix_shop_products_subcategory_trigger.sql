/*
  # Fix Subcategory Trigger Error on shop_products

  ## Problem
  The set_subcategory_id_trigger was incorrectly applied to shop_products table.
  This trigger calls generate_subcategory_id() which references a non-existent
  sequence 'subcategory_id_seq', causing product creation to fail with error:
  "relation subcategory_id_seq does not exist"

  ## Root Cause
  - shop_products.subcategory_id is a UUID foreign key to subcategories table
  - The trigger was meant for subcategories table only, not shop_products
  - Migration 20251127033154_fix_function_search_paths_v2.sql incorrectly
    recreated the trigger on shop_products

  ## Solution
  1. Drop the incorrect trigger from shop_products
  2. Keep the trigger only on subcategories table where it belongs
  3. shop_products.subcategory_id should be manually set by CMS, not auto-generated

  ## Security
  - No RLS changes
  - No data changes
*/

-- Drop the incorrect trigger from shop_products
DROP TRIGGER IF EXISTS set_subcategory_id_trigger ON shop_products;

-- Verify the trigger still exists on subcategories (where it should be)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_set_subcategory_id'
    AND tgrelid = 'subcategories'::regclass
  ) THEN
    RAISE WARNING 'Trigger trigger_set_subcategory_id does not exist on subcategories table';
  ELSE
    RAISE NOTICE 'Trigger trigger_set_subcategory_id correctly exists on subcategories table';
  END IF;
END $$;

-- Verification message
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIXED: Removed incorrect subcategory trigger from shop_products';
  RAISE NOTICE 'shop_products.subcategory_id is now manually managed';
  RAISE NOTICE 'Product creation should now work correctly';
  RAISE NOTICE '========================================';
END $$;
