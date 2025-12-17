/*
  # Add Free Gift Name Field to Vouchers

  1. Changes
    - Add `free_gift_name` column to `vouchers` table
      - Used to store custom gift name when voucher_type is 'free_gift'
      - Examples: "CAKE", "BIRTHDAY TREAT", "FREE DRINK"
    
  2. Details
    - Column is optional (nullable) as only free_gift type vouchers need it
    - Text type to allow flexible naming
    - Used by CMS to create personalized free gift vouchers
    - Displayed in cart as "FREE GIFT - {free_gift_name}"

  3. Notes
    - No data migration needed as this is a new feature
    - Backward compatible with existing voucher types
    - Frontend will validate this field is required when voucher_type is 'free_gift'
*/

-- Add free_gift_name column to vouchers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vouchers' AND column_name = 'free_gift_name'
  ) THEN
    ALTER TABLE vouchers ADD COLUMN free_gift_name TEXT;
    
    COMMENT ON COLUMN vouchers.free_gift_name IS 'Custom name for free gift items (e.g., CAKE, DRINK). Used when voucher_type is free_gift.';
  END IF;
END $$;
