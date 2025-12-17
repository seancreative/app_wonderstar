/*
  # Add Bonus Percentage to Wallet Topup Packages

  1. Changes
    - Add `bonus_percentage` column to track the percentage bonus for display
    - Update existing packages with their percentage values
  
  2. Package Structure
    - RM10: 0% bonus
    - RM25: 5% bonus
    - RM50: 8% bonus
    - RM100: 12% bonus
    - RM200: 18% bonus
*/

-- Add bonus_percentage column
ALTER TABLE wallet_topup_packages 
ADD COLUMN IF NOT EXISTS bonus_percentage integer DEFAULT 0;

-- Update existing packages with percentage values
UPDATE wallet_topup_packages SET bonus_percentage = 0 WHERE amount = 10.00;
UPDATE wallet_topup_packages SET bonus_percentage = 5 WHERE amount = 25.00;
UPDATE wallet_topup_packages SET bonus_percentage = 8 WHERE amount = 50.00;
UPDATE wallet_topup_packages SET bonus_percentage = 12 WHERE amount = 100.00;
UPDATE wallet_topup_packages SET bonus_percentage = 18 WHERE amount = 200.00;
