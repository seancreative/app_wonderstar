/*
  # Backfill Cart Items with Missing Category Metadata

  ## Summary
  This migration updates existing cart items that are missing `category_id` and `subcategory_id`
  in their metadata field. This is critical for category-based and subcategory-based vouchers to
  work correctly.

  ## Problem
  - Some cart items were added before category tracking was implemented
  - Cart items missing category_id cannot be matched with category-based vouchers
  - Results in vouchers being applied but no discount calculated

  ## Solution
  - Backfill metadata.category_id from shop_products table
  - Backfill metadata.subcategory_id from shop_products table
  - Only update items where these fields are missing or null

  ## Impact
  - Fixes voucher discount calculation for existing cart items
  - Ensures all cart items have complete metadata for voucher eligibility checks
*/

-- Update existing cart items with missing category_id in metadata
UPDATE shop_cart_items sci
SET metadata = jsonb_set(
  COALESCE(sci.metadata, '{}'::jsonb),
  '{category_id}',
  to_jsonb(sp.category_id),
  true
)
FROM shop_products sp
WHERE sci.product_id = sp.id
  AND sp.category_id IS NOT NULL
  AND (
    sci.metadata IS NULL
    OR sci.metadata->>'category_id' IS NULL
    OR sci.metadata->>'category_id' = ''
  );

-- Update existing cart items with missing subcategory_id in metadata
UPDATE shop_cart_items sci
SET metadata = jsonb_set(
  COALESCE(sci.metadata, '{}'::jsonb),
  '{subcategory_id}',
  to_jsonb(sp.subcategory_id),
  true
)
FROM shop_products sp
WHERE sci.product_id = sp.id
  AND sp.subcategory_id IS NOT NULL
  AND (
    sci.metadata IS NULL
    OR sci.metadata->>'subcategory_id' IS NULL
    OR sci.metadata->>'subcategory_id' = ''
  );

-- Add helpful comments
COMMENT ON COLUMN shop_cart_items.metadata IS 'JSONB metadata including product_name, category_id, subcategory_id, and selected_modifiers. category_id and subcategory_id are critical for voucher eligibility checks.';
