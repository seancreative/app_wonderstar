/*
  # Egg Gacha System

  1. New Tables
    - `egg_prize_lines`
      - Core prize line table with 250 prizes per batch
      - Tracks line number (global sequential), batch number, rewards
      - Records claim status and claiming user details
    - `egg_redemptions`
      - Historical log of all prize claims
      - Analytics and audit trail

  2. Prize Distribution per Batch (250 total)
    - 100 × RM0.50 Bonus
    - 50 × RM1.00 Bonus
    - 30 × RM2.00 Bonus
    - 10 × RM5.00 Bonus
    - 5 × RM10.00 Bonus
    - 5 × RM20.00 Bonus
    - 50 × No Bonus (RM0.00)

  3. Security
    - Enable RLS on both tables
    - Users can view their own claims
    - Admins have full access
    - Service role for claim operations

  4. Indexes
    - Optimized for fast unclaimed prize selection
    - Batch queries and analytics
    - User history lookups
*/

-- Create egg_prize_lines table
CREATE TABLE IF NOT EXISTS egg_prize_lines (
  id bigserial PRIMARY KEY,
  line_number integer NOT NULL UNIQUE,
  batch_number integer NOT NULL,
  reward_label text NOT NULL,
  reward_amount numeric(10,2) NOT NULL CHECK (reward_amount >= 0),
  is_claimed boolean NOT NULL DEFAULT false,
  claimed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  claimed_by_username text,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_egg_prize_lines_unclaimed 
  ON egg_prize_lines(line_number) 
  WHERE is_claimed = false;

CREATE INDEX IF NOT EXISTS idx_egg_prize_lines_batch 
  ON egg_prize_lines(batch_number);

CREATE INDEX IF NOT EXISTS idx_egg_prize_lines_claimed_by 
  ON egg_prize_lines(claimed_by_user_id) 
  WHERE claimed_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_egg_prize_lines_claimed_at 
  ON egg_prize_lines(claimed_at DESC) 
  WHERE claimed_at IS NOT NULL;

-- Create egg_redemptions table for historical tracking
CREATE TABLE IF NOT EXISTS egg_redemptions (
  id bigserial PRIMARY KEY,
  prize_line_id bigint NOT NULL REFERENCES egg_prize_lines(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username text NOT NULL,
  reward_amount numeric(10,2) NOT NULL,
  reward_label text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for analytics and user history
CREATE INDEX IF NOT EXISTS idx_egg_redemptions_user 
  ON egg_redemptions(user_id);

CREATE INDEX IF NOT EXISTS idx_egg_redemptions_prize_line 
  ON egg_redemptions(prize_line_id);

CREATE INDEX IF NOT EXISTS idx_egg_redemptions_claimed_at 
  ON egg_redemptions(claimed_at DESC);

CREATE INDEX IF NOT EXISTS idx_egg_redemptions_amount 
  ON egg_redemptions(reward_amount);

-- Enable Row Level Security
ALTER TABLE egg_prize_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE egg_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for egg_prize_lines

-- Users can view their own claimed prizes
CREATE POLICY egg_prize_lines_users_view_own 
  ON egg_prize_lines FOR SELECT 
  TO authenticated 
  USING (claimed_by_user_id = auth.uid());

-- Admins can view all prizes
CREATE POLICY egg_prize_lines_admin_view 
  ON egg_prize_lines FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.id = auth.uid()
    )
  );

-- Service role for claim operations (backend only)
CREATE POLICY egg_prize_lines_service_all 
  ON egg_prize_lines FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- RLS Policies for egg_redemptions

-- Users can view their own redemption history
CREATE POLICY egg_redemptions_users_view_own 
  ON egg_redemptions FOR SELECT 
  TO authenticated 
  USING (user_id = auth.uid());

-- Admins can view all redemptions
CREATE POLICY egg_redemptions_admin_view 
  ON egg_redemptions FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.id = auth.uid()
    )
  );

-- Service role for inserting redemptions (backend only)
CREATE POLICY egg_redemptions_service_insert 
  ON egg_redemptions FOR INSERT 
  TO service_role 
  WITH CHECK (true);

-- Comment on tables for documentation
COMMENT ON TABLE egg_prize_lines IS 'Egg Gacha prize lines with 250 prizes per batch, randomly shuffled. Each line can only be claimed once.';
COMMENT ON TABLE egg_redemptions IS 'Historical log of all egg gacha prize claims for analytics and user history.';
