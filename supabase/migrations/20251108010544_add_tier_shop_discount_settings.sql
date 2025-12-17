/*
  # Add Shop Discount Settings to Membership Tiers

  ## Overview
  This migration adds shop discount percentage to the membership_tiers table, allowing
  each tier to have a configurable discount rate for shop purchases.

  ## Changes
  1. **membership_tiers Table Updates**
     - Add `shop_discount_pct` column (integer) - Percentage discount for shop purchases
     - Set default values:
       - Silver: 5%
       - Gold: 8%
       - Platinum: 15%

  ## Admin Adjustability
  The `shop_discount_pct` column can be updated by admins to change discount rates
  for each tier without code changes. This provides flexibility for:
  - Promotional periods
  - Tier benefit adjustments
  - A/B testing different discount rates

  ## Important Notes
  - Discounts apply to the subtotal before payment
  - Discounts are calculated and displayed in checkout
  - Historical orders retain their applied discount amount
*/

-- Add shop_discount_pct column to membership_tiers table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'membership_tiers' AND column_name = 'shop_discount_pct'
  ) THEN
    ALTER TABLE membership_tiers ADD COLUMN shop_discount_pct integer DEFAULT 0 CHECK (shop_discount_pct >= 0 AND shop_discount_pct <= 100);
  END IF;
END $$;

-- Update existing tiers with default shop discount percentages
UPDATE membership_tiers SET shop_discount_pct = 5 WHERE name = 'Silver';
UPDATE membership_tiers SET shop_discount_pct = 8 WHERE name = 'Gold';
UPDATE membership_tiers SET shop_discount_pct = 15 WHERE name = 'Platinum';

-- Add tier_discount_amount column to shop_orders to track applied discounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'tier_discount_amount'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN tier_discount_amount numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Add tier_discount_pct column to shop_orders to track discount percentage used
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'tier_discount_pct'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN tier_discount_pct integer DEFAULT 0;
  END IF;
END $$;

-- Add stamps_earned column to shop_orders to track stamps from this order
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'stamps_earned'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN stamps_earned integer DEFAULT 0;
  END IF;
END $$;
