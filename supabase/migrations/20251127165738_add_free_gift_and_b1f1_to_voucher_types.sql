/*
  # Add FREE GIFT and B1F1 Voucher Types to Constraint

  1. Changes
    - Drop existing voucher_type check constraint
    - Add new constraint that includes all voucher types:
      - amount (existing)
      - percent (existing)
      - free_item (existing)
      - b1f1 (missing)
      - free_gift (new)
  
  2. Details
    - Allows both creating new FREE GIFT vouchers
    - Allows updating existing vouchers (like WONDERB1F1) to FREE GIFT type
    - Maintains backward compatibility with existing voucher types
    - No data migration needed

  3. Notes
    - This constraint was preventing FREE GIFT voucher creation/updates
    - B1F1 type was also missing from the original constraint
*/

-- Drop the existing constraint
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_voucher_type_check;

-- Add new constraint with all voucher types including free_gift and b1f1
ALTER TABLE vouchers ADD CONSTRAINT vouchers_voucher_type_check 
CHECK (voucher_type IN ('amount', 'percent', 'free_item', 'b1f1', 'free_gift'));

-- Verify the constraint is updated
COMMENT ON CONSTRAINT vouchers_voucher_type_check ON vouchers IS 
'Ensures voucher_type is one of: amount, percent, free_item, b1f1, free_gift';
