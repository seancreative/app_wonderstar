/*
  # Add Topup Package Fields for CMS Management

  1. Changes
    - Add `base_stars` column (stars equal to amount, e.g., RM30 = 30 stars)
    - Add `extra_stars` column (bonus stars on top of base)
    - Add `bonus_amount` column (cash bonus added to Bonus balance)
    - Add `is_recommended` column (flag to highlight package)
    - Rename `bonus_points` to align with new structure if needed

  2. Data Migration
    - Calculate base_stars from amount (1 star per RM)
    - Map existing bonus_points to extra_stars
    - Initialize bonus_amount based on known structure
*/

-- Add new columns
ALTER TABLE wallet_topup_packages 
ADD COLUMN IF NOT EXISTS base_stars integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_stars integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_amount decimal(10,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS is_recommended boolean DEFAULT false;

-- Update existing data: base_stars equals the amount (1 star per RM)
UPDATE wallet_topup_packages 
SET base_stars = FLOOR(amount)::integer
WHERE base_stars = 0;

-- Update extra_stars from existing bonus_points (if they represent extra stars)
UPDATE wallet_topup_packages 
SET extra_stars = COALESCE(bonus_points, 0)
WHERE extra_stars = 0;

-- Clear and repopulate with the exact structure requested
DELETE FROM wallet_topup_packages;

INSERT INTO wallet_topup_packages 
  (amount, base_stars, extra_stars, bonus_amount, is_recommended, display_order, is_active) 
VALUES
  (1, 1, 0, 0.00, false, 1, true),
  (10, 10, 0, 0.00, false, 2, true),
  (30, 30, 3, 2.00, false, 3, true),
  (50, 50, 5, 5.00, true, 4, true),
  (100, 100, 15, 12.00, false, 5, true),
  (200, 200, 30, 30.00, false, 6, true),
  (500, 500, 100, 60.00, false, 7, true);

-- Create index for faster queries on active and recommended packages
CREATE INDEX IF NOT EXISTS idx_wallet_topup_packages_recommended 
ON wallet_topup_packages(is_recommended, is_active, display_order);
