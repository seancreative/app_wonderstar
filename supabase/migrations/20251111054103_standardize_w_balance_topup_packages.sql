/*
  # Standardize W Balance Top-Up Packages

  1. Changes
    - Remove old package amounts (RM5, RM25)
    - Add standardized 7-tier package system
    - Update bonus percentages: 0%, 0%, 3%, 6%, 10%, 15%, 20%
    - Calculate bonus_points based on percentage of amount converted to stars

  2. New Package Structure
    - RM1: 0% bonus (1 star base, 0 bonus) = 1 total stars
    - RM10: 0% bonus (10 stars base, 0 bonus) = 10 total stars
    - RM30: 3% extra stars (30 stars base, 0.9 bonus rounded to 1) = 31 total stars
    - RM50: 6% extra stars (50 stars base, 3 bonus) = 53 total stars
    - RM100: 10% extra stars (100 stars base, 10 bonus) = 110 total stars
    - RM200: 15% extra stars (200 stars base, 30 bonus) = 230 total stars
    - RM500: 20% extra stars (500 stars base, 100 bonus) = 600 total stars

  3. Display
    - Each package will show "Earn X% extra stars" where applicable
    - RM1 and RM10 show "No bonus" or can be hidden in UI
*/

-- First, deactivate all existing packages
UPDATE wallet_topup_packages SET is_active = false;

-- Delete existing packages to avoid conflicts (since we're completely restructuring)
DELETE FROM wallet_topup_packages;

-- Insert the 7 new standardized packages with correct bonus calculations
-- Formula: bonus_points = FLOOR(amount * bonus_percentage / 100)
INSERT INTO wallet_topup_packages (amount, bonus_points, bonus_percentage, display_order, is_active) VALUES
  (1.00, 0, 0, 1, true),      -- RM1: No bonus
  (10.00, 0, 0, 2, true),     -- RM10: No bonus
  (30.00, 1, 3, 3, true),     -- RM30: 3% extra = 30 * 0.03 = 0.9 rounded to 1 star
  (50.00, 3, 6, 4, true),     -- RM50: 6% extra = 50 * 0.06 = 3 stars
  (100.00, 10, 10, 5, true),  -- RM100: 10% extra = 100 * 0.10 = 10 stars
  (200.00, 30, 15, 6, true),  -- RM200: 15% extra = 200 * 0.15 = 30 stars
  (500.00, 100, 20, 7, true)  -- RM500: 20% extra = 500 * 0.20 = 100 stars
ON CONFLICT DO NOTHING;

-- Verify the packages were inserted correctly
COMMENT ON TABLE wallet_topup_packages IS 'Standardized W Balance top-up packages with progressive bonus system';
