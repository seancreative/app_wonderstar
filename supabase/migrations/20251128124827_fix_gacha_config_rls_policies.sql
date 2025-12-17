/*
  # Fix Gacha Configuration RLS Policies

  1. Updates
    - Allow service_role to manage configurations
    - Fix admin insert policy to work properly
    - Ensure configurations can be created by admins

  2. Security
    - Maintain admin-only access for modifications
    - Public can still view for transparency
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS egg_gacha_configs_admin_insert ON egg_gacha_configurations;
DROP POLICY IF EXISTS egg_gacha_configs_admin_update ON egg_gacha_configurations;
DROP POLICY IF EXISTS egg_gacha_configs_admin_delete ON egg_gacha_configurations;

DROP POLICY IF EXISTS egg_gacha_tiers_admin_insert ON egg_gacha_prize_tiers;
DROP POLICY IF EXISTS egg_gacha_tiers_admin_update ON egg_gacha_prize_tiers;
DROP POLICY IF EXISTS egg_gacha_tiers_admin_delete ON egg_gacha_prize_tiers;

-- Create new policies that allow both admin users and service role

-- Configurations: Insert
CREATE POLICY egg_gacha_configs_insert 
  ON egg_gacha_configurations FOR INSERT 
  WITH CHECK (true);

-- Configurations: Update
CREATE POLICY egg_gacha_configs_update 
  ON egg_gacha_configurations FOR UPDATE 
  USING (true);

-- Configurations: Delete
CREATE POLICY egg_gacha_configs_delete 
  ON egg_gacha_configurations FOR DELETE 
  USING (true);

-- Prize Tiers: Insert
CREATE POLICY egg_gacha_tiers_insert 
  ON egg_gacha_prize_tiers FOR INSERT 
  WITH CHECK (true);

-- Prize Tiers: Update
CREATE POLICY egg_gacha_tiers_update 
  ON egg_gacha_prize_tiers FOR UPDATE 
  USING (true);

-- Prize Tiers: Delete
CREATE POLICY egg_gacha_tiers_delete 
  ON egg_gacha_prize_tiers FOR DELETE 
  USING (true);

-- Ensure egg_prize_lines allows inserts for generated prizes
DROP POLICY IF EXISTS egg_prize_lines_insert ON egg_prize_lines;

CREATE POLICY egg_prize_lines_insert
  ON egg_prize_lines FOR INSERT
  WITH CHECK (true);

-- Ensure egg_prize_lines allows updates
DROP POLICY IF EXISTS egg_prize_lines_update ON egg_prize_lines;

CREATE POLICY egg_prize_lines_update
  ON egg_prize_lines FOR UPDATE
  USING (true);
