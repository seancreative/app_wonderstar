/*
  # Add Gacha Configuration System

  1. New Tables
    - `egg_gacha_configurations`
      - Stores prize setup templates for dynamic generation
      - Tracks active configuration, admin who created it
      - Allows multiple configurations for different campaigns
    
    - `egg_gacha_prize_tiers`
      - Defines prize tiers within each configuration
      - Links to parent configuration
      - Specifies amount and count for each tier

  2. Updates to Existing Tables
    - `egg_prize_lines`
      - Add `config_id` to track which configuration was used
      - Add revocation tracking fields
    
    - `egg_redemptions`
      - Add revocation tracking fields

  3. Security
    - Enable RLS on new tables
    - Only admins can manage configurations
    - Public can view active configuration details

  4. Indexes
    - Optimized for configuration lookups
    - Active configuration queries
    - Tier ordering
*/

-- Create egg_gacha_configurations table
CREATE TABLE IF NOT EXISTS egg_gacha_configurations (
  id bigserial PRIMARY KEY,
  config_name text NOT NULL,
  total_lines integer NOT NULL CHECK (total_lines > 0),
  is_active boolean NOT NULL DEFAULT false,
  created_by_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create egg_gacha_prize_tiers table
CREATE TABLE IF NOT EXISTS egg_gacha_prize_tiers (
  id bigserial PRIMARY KEY,
  config_id bigint NOT NULL REFERENCES egg_gacha_configurations(id) ON DELETE CASCADE,
  tier_order integer NOT NULL CHECK (tier_order > 0),
  prize_amount numeric(10,2) NOT NULL CHECK (prize_amount >= 0),
  prize_count integer NOT NULL CHECK (prize_count > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add new columns to egg_prize_lines (if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'egg_prize_lines' AND column_name = 'config_id'
  ) THEN
    ALTER TABLE egg_prize_lines ADD COLUMN config_id bigint REFERENCES egg_gacha_configurations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'egg_prize_lines' AND column_name = 'is_revoked'
  ) THEN
    ALTER TABLE egg_prize_lines ADD COLUMN is_revoked boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'egg_prize_lines' AND column_name = 'revoked_at'
  ) THEN
    ALTER TABLE egg_prize_lines ADD COLUMN revoked_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'egg_prize_lines' AND column_name = 'revoked_by_admin_id'
  ) THEN
    ALTER TABLE egg_prize_lines ADD COLUMN revoked_by_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'egg_prize_lines' AND column_name = 'revoke_reason'
  ) THEN
    ALTER TABLE egg_prize_lines ADD COLUMN revoke_reason text;
  END IF;
END $$;

-- Add new columns to egg_redemptions (if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'egg_redemptions' AND column_name = 'revoked_at'
  ) THEN
    ALTER TABLE egg_redemptions ADD COLUMN revoked_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'egg_redemptions' AND column_name = 'revoked_by_admin_id'
  ) THEN
    ALTER TABLE egg_redemptions ADD COLUMN revoked_by_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'egg_redemptions' AND column_name = 'revoke_reason'
  ) THEN
    ALTER TABLE egg_redemptions ADD COLUMN revoke_reason text;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_egg_gacha_configs_active 
  ON egg_gacha_configurations(is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_egg_gacha_configs_created_by 
  ON egg_gacha_configurations(created_by_admin_id);

CREATE INDEX IF NOT EXISTS idx_egg_gacha_tiers_config 
  ON egg_gacha_prize_tiers(config_id);

CREATE INDEX IF NOT EXISTS idx_egg_gacha_tiers_order 
  ON egg_gacha_prize_tiers(config_id, tier_order);

CREATE INDEX IF NOT EXISTS idx_egg_prize_lines_config 
  ON egg_prize_lines(config_id);

CREATE INDEX IF NOT EXISTS idx_egg_prize_lines_revoked 
  ON egg_prize_lines(is_revoked) 
  WHERE is_revoked = true;

-- Enable Row Level Security
ALTER TABLE egg_gacha_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE egg_gacha_prize_tiers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for egg_gacha_configurations

-- Anyone can view configurations (for transparency)
CREATE POLICY egg_gacha_configs_public_view 
  ON egg_gacha_configurations FOR SELECT 
  TO authenticated 
  USING (true);

-- Only admins can insert configurations
CREATE POLICY egg_gacha_configs_admin_insert 
  ON egg_gacha_configurations FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.id = auth.uid()
    )
  );

-- Only admins can update configurations
CREATE POLICY egg_gacha_configs_admin_update 
  ON egg_gacha_configurations FOR UPDATE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.id = auth.uid()
    )
  );

-- Only admins can delete configurations
CREATE POLICY egg_gacha_configs_admin_delete 
  ON egg_gacha_configurations FOR DELETE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.id = auth.uid()
    )
  );

-- RLS Policies for egg_gacha_prize_tiers

-- Anyone can view prize tiers (for transparency)
CREATE POLICY egg_gacha_tiers_public_view 
  ON egg_gacha_prize_tiers FOR SELECT 
  TO authenticated 
  USING (true);

-- Only admins can insert tiers
CREATE POLICY egg_gacha_tiers_admin_insert 
  ON egg_gacha_prize_tiers FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.id = auth.uid()
    )
  );

-- Only admins can update tiers
CREATE POLICY egg_gacha_tiers_admin_update 
  ON egg_gacha_prize_tiers FOR UPDATE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.id = auth.uid()
    )
  );

-- Only admins can delete tiers
CREATE POLICY egg_gacha_tiers_admin_delete 
  ON egg_gacha_prize_tiers FOR DELETE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.id = auth.uid()
    )
  );

-- Create function to ensure only one active configuration
CREATE OR REPLACE FUNCTION ensure_single_active_configuration()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this config to active, deactivate all others
  IF NEW.is_active = true THEN
    UPDATE egg_gacha_configurations
    SET is_active = false
    WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_ensure_single_active_config ON egg_gacha_configurations;
CREATE TRIGGER trigger_ensure_single_active_config
  BEFORE INSERT OR UPDATE ON egg_gacha_configurations
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_configuration();

-- Create function to revoke prize (transaction-safe)
CREATE OR REPLACE FUNCTION revoke_prize_transaction(
  p_prize_line_id bigint,
  p_admin_id uuid,
  p_reason text
) RETURNS json AS $$
DECLARE
  v_user_id uuid;
  v_amount numeric;
  v_username text;
  v_current_bonus numeric;
  v_result json;
BEGIN
  -- Get prize details
  SELECT claimed_by_user_id, reward_amount, claimed_by_username
  INTO v_user_id, v_amount, v_username
  FROM egg_prize_lines
  WHERE id = p_prize_line_id AND is_claimed = true AND is_revoked = false;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Prize not found or already revoked'
    );
  END IF;
  
  -- Get current user bonus balance
  SELECT bonus_balance INTO v_current_bonus
  FROM users
  WHERE id = v_user_id;
  
  -- Check if user has sufficient balance
  IF v_current_bonus < v_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User has insufficient bonus balance'
    );
  END IF;
  
  -- Update prize line
  UPDATE egg_prize_lines
  SET is_revoked = true,
      revoked_at = now(),
      revoked_by_admin_id = p_admin_id,
      revoke_reason = p_reason,
      updated_at = now()
  WHERE id = p_prize_line_id;
  
  -- Update redemption
  UPDATE egg_redemptions
  SET revoked_at = now(),
      revoked_by_admin_id = p_admin_id,
      revoke_reason = p_reason
  WHERE prize_line_id = p_prize_line_id;
  
  -- Deduct bonus from user
  UPDATE users
  SET bonus_balance = bonus_balance - v_amount
  WHERE id = v_user_id;
  
  -- Log transaction
  INSERT INTO bonus_transactions (
    user_id, amount, transaction_type,
    description, reference_id, created_at
  ) VALUES (
    v_user_id, -v_amount, 'revoke',
    'Prize revoked: ' || p_reason, p_prize_line_id::text, now()
  );
  
  -- Return success with details
  RETURN json_build_object(
    'success', true,
    'prize_line_id', p_prize_line_id,
    'user_id', v_user_id,
    'username', v_username,
    'amount_deducted', v_amount,
    'revoked_at', now()
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on tables for documentation
COMMENT ON TABLE egg_gacha_configurations IS 'Stores gacha prize configuration templates that define how prizes are distributed when generating new batches';
COMMENT ON TABLE egg_gacha_prize_tiers IS 'Defines the prize tiers (amount and count) for each gacha configuration';
COMMENT ON FUNCTION revoke_prize_transaction IS 'Safely revokes a prize, deducts bonus from user, and logs the transaction. Returns JSON with success status and details.';
