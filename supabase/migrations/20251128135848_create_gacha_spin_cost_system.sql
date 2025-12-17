/*
  # Gacha Spin Cost System - 500 Stars Per Spin with Free First Spin

  1. New Tables
    - `gacha_spin_history`
      - Tracks all spin attempts with complete audit trail
      - Records user, timestamp, cost (0 for free, 500 for paid)
      - Links to prize line and records reward details
    
    - `user_gacha_stats`
      - Per-user statistics and state tracking
      - Tracks total spins, free spins remaining
      - Tracks total stars spent and rewards earned
      - First and last spin timestamps

  2. Changes
    - Add `total_stars` column to users table for star balance
    - Initialize all new users with 1 free gacha spin
    - Set spin cost to 500 stars (configurable via CMS later)

  3. Security
    - Enable RLS on all new tables
    - Users can view their own records only
    - Admins have full access
    - Service role for backend operations

  4. Indexes
    - Optimized for user history lookups
    - Analytics queries on spin timestamps
    - Fast eligibility checks
*/

-- Add total_stars column to users table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'total_stars'
  ) THEN
    ALTER TABLE users ADD COLUMN total_stars integer DEFAULT 0 NOT NULL CHECK (total_stars >= 0);
    CREATE INDEX IF NOT EXISTS idx_users_total_stars ON users(total_stars);
    COMMENT ON COLUMN users.total_stars IS 'User star balance for rewards and gacha spins';
    RAISE NOTICE 'Added total_stars column to users table';
  ELSE
    RAISE NOTICE 'total_stars column already exists in users table';
  END IF;
END $$;

-- Create user_gacha_stats table
CREATE TABLE IF NOT EXISTS user_gacha_stats (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_spins integer DEFAULT 0 NOT NULL CHECK (total_spins >= 0),
  free_spins_remaining integer DEFAULT 1 NOT NULL CHECK (free_spins_remaining >= 0),
  total_stars_spent integer DEFAULT 0 NOT NULL CHECK (total_stars_spent >= 0),
  total_rewards_earned numeric(10,2) DEFAULT 0 NOT NULL CHECK (total_rewards_earned >= 0),
  first_spin_at timestamptz,
  last_spin_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for user_gacha_stats
CREATE INDEX IF NOT EXISTS idx_user_gacha_stats_user_id ON user_gacha_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_gacha_stats_free_spins ON user_gacha_stats(user_id, free_spins_remaining) WHERE free_spins_remaining > 0;
CREATE INDEX IF NOT EXISTS idx_user_gacha_stats_last_spin ON user_gacha_stats(last_spin_at DESC);

-- Create gacha_spin_history table
CREATE TABLE IF NOT EXISTS gacha_spin_history (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  username text NOT NULL,
  prize_line_id bigint REFERENCES egg_prize_lines(id) ON DELETE SET NULL,
  stars_cost integer NOT NULL CHECK (stars_cost IN (0, 500)),
  was_free_spin boolean NOT NULL DEFAULT false,
  reward_amount numeric(10,2) NOT NULL DEFAULT 0,
  reward_label text NOT NULL,
  user_stars_before integer NOT NULL,
  user_stars_after integer NOT NULL,
  spin_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for gacha_spin_history
CREATE INDEX IF NOT EXISTS idx_gacha_spin_history_user_id ON gacha_spin_history(user_id);
CREATE INDEX IF NOT EXISTS idx_gacha_spin_history_spin_at ON gacha_spin_history(spin_at DESC);
CREATE INDEX IF NOT EXISTS idx_gacha_spin_history_prize_line ON gacha_spin_history(prize_line_id);
CREATE INDEX IF NOT EXISTS idx_gacha_spin_history_free_spins ON gacha_spin_history(user_id) WHERE was_free_spin = true;

-- Enable Row Level Security
ALTER TABLE user_gacha_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE gacha_spin_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_gacha_stats
CREATE POLICY user_gacha_stats_users_view_own 
  ON user_gacha_stats FOR SELECT 
  TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY user_gacha_stats_admin_view 
  ON user_gacha_stats FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY user_gacha_stats_service_all 
  ON user_gacha_stats FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- RLS Policies for gacha_spin_history
CREATE POLICY gacha_spin_history_users_view_own 
  ON gacha_spin_history FOR SELECT 
  TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY gacha_spin_history_admin_view 
  ON gacha_spin_history FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY gacha_spin_history_service_insert 
  ON gacha_spin_history FOR INSERT 
  TO service_role 
  WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE user_gacha_stats IS 'Per-user gacha statistics including free spins remaining and total rewards earned';
COMMENT ON TABLE gacha_spin_history IS 'Complete audit trail of all gacha spin attempts with costs and rewards';
COMMENT ON COLUMN user_gacha_stats.free_spins_remaining IS 'Number of free spins available (new users get 1, resets never)';
COMMENT ON COLUMN gacha_spin_history.stars_cost IS 'Stars deducted for this spin: 0 for free spins, 500 for paid spins';
COMMENT ON COLUMN gacha_spin_history.was_free_spin IS 'True if this spin used a free spin token, false if paid with stars';
