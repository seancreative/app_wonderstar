/*
  # Add restriction_type column to vouchers table

  1. Changes
    - Add `restriction_type` column to vouchers table with possible values:
      - 'special_discount': For special RM5 discount on products with special_discount flag
      - 'by_category': For category-based discounts
      - 'by_product': For specific product discounts
      - 'by_subcategory': For subcategory-based discounts
      - NULL: For unrestricted vouchers
    
  2. Data Migration
    - Set existing DISCOUNT5 voucher to 'special_discount' type
    - Other vouchers default to 'by_product' if they have eligible_product_ids
    - Other vouchers default to 'by_category' if they have eligible_category_ids
*/

-- Add restriction_type column
ALTER TABLE vouchers 
ADD COLUMN IF NOT EXISTS restriction_type TEXT;

-- Add comment for documentation
COMMENT ON COLUMN vouchers.restriction_type IS 'Voucher restriction type: special_discount, by_category, by_product, by_subcategory, or NULL for unrestricted';

-- Update DISCOUNT5 to special_discount type
UPDATE vouchers 
SET restriction_type = 'special_discount'
WHERE code = 'DISCOUNT5';

-- Update other vouchers based on their eligible fields
UPDATE vouchers
SET restriction_type = 'by_product'
WHERE restriction_type IS NULL
  AND eligible_product_ids IS NOT NULL 
  AND array_length(eligible_product_ids, 1) > 0
  AND code != 'DISCOUNT5';

UPDATE vouchers
SET restriction_type = 'by_category'
WHERE restriction_type IS NULL
  AND eligible_category_ids IS NOT NULL 
  AND array_length(eligible_category_ids, 1) > 0;

UPDATE vouchers
SET restriction_type = 'by_subcategory'
WHERE restriction_type IS NULL
  AND eligible_subcategory_ids IS NOT NULL 
  AND array_length(eligible_subcategory_ids, 1) > 0;
