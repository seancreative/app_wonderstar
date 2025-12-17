/*
  # Update to 5-Tier Membership System

  ## Overview
  Expands the membership tier system from 3 tiers to 5 tiers, adding Bronze (entry level)
  and VIP (premium level). Adjusts all tier bonuses and benefits to create a balanced
  progression system.

  ## Changes
  1. **New Tiers**
     - Bronze: Entry tier (RM 0 threshold)
     - VIP: Premium tier (RM 10,000 threshold)

  2. **Tier Progression & Benefits**
     - Bronze (RM 0): 1.0x stars, 3% shop discount, 5% workshop discount
     - Silver (RM 500): 1.2x stars, 5% shop discount, 8% workshop discount, 5% topup bonus
     - Gold (RM 2000): 1.5x stars, 8% shop discount, 12% workshop discount, 8% topup bonus
     - Platinum (RM 5000): 2.0x stars, 12% shop discount, 15% workshop discount, 10% topup bonus
     - VIP (RM 10000): 2.5x stars, 15% shop discount, 20% workshop discount, 15% topup bonus

  ## Gamification Elements
  - Clear progression path with meaningful rewards at each tier
  - Shop discounts increase significantly (3% → 15%)
  - Stars multiplier doubles from base (1.0x → 2.5x)
  - VIP tier provides exclusive premium benefits
  - Balanced thresholds encourage spending and tier progression

  ## Admin Adjustability
  All values can be adjusted by admins through the membership_tiers table for:
  - Promotional campaigns
  - Seasonal adjustments
  - A/B testing different reward structures
*/

-- Insert Bronze tier (entry level)
INSERT INTO membership_tiers (
  name,
  threshold,
  earn_multiplier,
  topup_bonus_pct,
  workshop_discount_pct,
  redemption_discount_pct,
  shop_discount_pct,
  mission_bonus_stars,
  color,
  sort_order
) VALUES (
  'Bronze',
  0,
  1.0,
  0,
  5,
  5,
  3,
  0,
  '#CD7F32',
  0
) ON CONFLICT (name) DO UPDATE SET
  threshold = 0,
  earn_multiplier = 1.0,
  topup_bonus_pct = 0,
  workshop_discount_pct = 5,
  redemption_discount_pct = 5,
  shop_discount_pct = 3,
  mission_bonus_stars = 0,
  color = '#CD7F32',
  sort_order = 0;

-- Update Silver tier
UPDATE membership_tiers SET
  threshold = 500,
  earn_multiplier = 1.2,
  topup_bonus_pct = 5,
  workshop_discount_pct = 8,
  redemption_discount_pct = 8,
  shop_discount_pct = 5,
  mission_bonus_stars = 10,
  color = '#C0C0C0',
  sort_order = 1
WHERE name = 'Silver';

-- Update Gold tier
UPDATE membership_tiers SET
  threshold = 2000,
  earn_multiplier = 1.5,
  topup_bonus_pct = 8,
  workshop_discount_pct = 12,
  redemption_discount_pct = 12,
  shop_discount_pct = 8,
  mission_bonus_stars = 20,
  color = '#FFD700',
  sort_order = 2
WHERE name = 'Gold';

-- Update Platinum tier
UPDATE membership_tiers SET
  threshold = 5000,
  earn_multiplier = 2.0,
  topup_bonus_pct = 10,
  workshop_discount_pct = 15,
  redemption_discount_pct = 15,
  shop_discount_pct = 12,
  mission_bonus_stars = 30,
  color = '#E5E4E2',
  sort_order = 3
WHERE name = 'Platinum';

-- Insert VIP tier (premium level)
INSERT INTO membership_tiers (
  name,
  threshold,
  earn_multiplier,
  topup_bonus_pct,
  workshop_discount_pct,
  redemption_discount_pct,
  shop_discount_pct,
  mission_bonus_stars,
  color,
  sort_order
) VALUES (
  'VIP',
  10000,
  2.5,
  15,
  20,
  20,
  15,
  50,
  '#9B59B6',
  4
) ON CONFLICT (name) DO UPDATE SET
  threshold = 10000,
  earn_multiplier = 2.5,
  topup_bonus_pct = 15,
  workshop_discount_pct = 20,
  redemption_discount_pct = 20,
  shop_discount_pct = 15,
  mission_bonus_stars = 50,
  color = '#9B59B6',
  sort_order = 4;
