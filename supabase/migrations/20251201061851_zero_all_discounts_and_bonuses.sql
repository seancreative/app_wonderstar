/*
  # Zero All Discounts and Bonuses

  ## Overview
  Sets all shop discounts and topup bonuses to 0% across the entire system.
  This migration removes all discount and bonus incentives while maintaining
  the database structure for potential future reactivation.

  ## Changes
  1. **Membership Tiers**
     - Set all `topup_bonus_pct` to 0%
     - Set all `shop_discount_pct` to 0%
     - Affects: Bronze, Silver, Gold, Platinum, VIP tiers

  2. **Wallet Topup Packages**
     - Set all `bonus_percentage` to 0%
     - Set all `bonus_amount` to 0
     - Ensures no bonus credits are given on topups

  ## Rationale
  - Simplifies pricing and eliminates discount complexity
  - Provides clearer value proposition to customers
  - Maintains database schema for future flexibility
  - UI will automatically hide zero-value discount sections

  ## Rollback
  If discounts/bonuses need to be restored, previous values were:
  - Bronze: 0% topup, 3% shop
  - Silver: 5% topup, 5% shop
  - Gold: 8% topup, 8% shop
  - Platinum: 10% topup, 12% shop
  - VIP: 15% topup, 15% shop
*/

-- Update all membership tiers to 0% discounts and bonuses
UPDATE membership_tiers SET
  topup_bonus_pct = 0,
  shop_discount_pct = 0
WHERE name IN ('Bronze', 'Silver', 'Gold', 'Platinum', 'VIP');

-- Update all wallet topup packages to 0% bonus
UPDATE wallet_topup_packages SET
  bonus_percentage = 0,
  bonus_amount = 0;
