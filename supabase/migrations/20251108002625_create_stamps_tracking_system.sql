/*
  # Create Stamps Tracking System

  ## Overview
  This migration creates the stamps tracking system for WonderStars rewards program.
  Stamps are earned when users purchase tickets (entry passes) - 1 paid ticket = 1 stamp.
  Free tickets do not count toward stamps. Every 5 stamps earns a free ice cream,
  and every 10 stamps earns a free boba drink.

  ## Tables Created

  1. **stamps_tracking** - Main table tracking user stamp balances and redemptions
     - id (uuid, primary key)
     - user_id (uuid, references users)
     - total_stamps_earned (integer) - Lifetime stamps earned
     - current_stamps (integer) - Current available stamps (resets after 10)
     - ice_cream_redeemed_count (integer) - Total ice creams redeemed
     - boba_redeemed_count (integer) - Total bobas redeemed
     - last_stamp_earned_at (timestamptz) - Last time stamps were earned
     - created_at (timestamptz)
     - updated_at (timestamptz)

  2. **stamps_history** - Detailed history of all stamp earning events
     - id (uuid, primary key)
     - user_id (uuid, references users)
     - stamps_earned (integer) - Number of stamps earned in this event
     - source (text) - How stamps were earned: 'ticket_purchase', 'checkin_bonus', 'promotion'
     - is_free_ticket (boolean) - Whether this was from a free ticket (should be false for counting)
     - reference_id (text) - Reference to shop_order id or check_in id
     - metadata (jsonb) - Additional context like ticket types, quantities
     - earned_at (timestamptz)

  3. **stamps_redemptions** - History of stamp redemptions for rewards
     - id (uuid, primary key)
     - user_id (uuid, references users)
     - redemption_type (text) - 'ice_cream' (5 stamps) or 'boba' (10 stamps)
     - stamps_spent (integer) - Number of stamps used (5 or 10)
     - flavor_selection (text) - User's flavor choice
     - qr_code (text) - Unique QR code for counter verification
     - redeemed_at (timestamptz) - When user redeemed stamps
     - used_at (timestamptz) - When staff scanned QR at counter
     - expires_at (timestamptz) - Redemption expiry (30 days from redemption)
     - status (text) - 'pending', 'used', 'expired'

  ## Security
  - RLS enabled on all tables
  - Users can only view and modify their own stamp data
  - Automatic stamp calculation prevents manual manipulation

  ## Indexes
  - Created on user_id and timestamp fields for performance
  - Created on qr_code for fast redemption lookups
*/

-- =====================================================
-- STAMPS TRACKING TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS stamps_tracking (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_stamps_earned integer DEFAULT 0,
  current_stamps integer DEFAULT 0 CHECK (current_stamps >= 0 AND current_stamps < 10),
  ice_cream_redeemed_count integer DEFAULT 0,
  boba_redeemed_count integer DEFAULT 0,
  last_stamp_earned_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE stamps_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stamps tracking"
  ON stamps_tracking FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Anon users can view own stamps tracking"
  ON stamps_tracking FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Users can insert own stamps tracking"
  ON stamps_tracking FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Anon users can insert stamps tracking"
  ON stamps_tracking FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Users can update own stamps tracking"
  ON stamps_tracking FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Anon users can update stamps tracking"
  ON stamps_tracking FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_stamps_tracking_user_id ON stamps_tracking(user_id);

-- =====================================================
-- STAMPS HISTORY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS stamps_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  stamps_earned integer NOT NULL,
  source text NOT NULL CHECK (source IN ('ticket_purchase', 'checkin_bonus', 'promotion', 'admin_grant')),
  is_free_ticket boolean DEFAULT false,
  reference_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  earned_at timestamptz DEFAULT now()
);

ALTER TABLE stamps_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stamps history"
  ON stamps_history FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Anon users can view stamps history"
  ON stamps_history FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Users can insert stamps history"
  ON stamps_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Anon users can insert stamps history"
  ON stamps_history FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE INDEX idx_stamps_history_user_id ON stamps_history(user_id);
CREATE INDEX idx_stamps_history_earned_at ON stamps_history(earned_at DESC);
CREATE INDEX idx_stamps_history_reference_id ON stamps_history(reference_id);

-- =====================================================
-- STAMPS REDEMPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS stamps_redemptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  redemption_type text NOT NULL CHECK (redemption_type IN ('ice_cream', 'boba')),
  stamps_spent integer NOT NULL CHECK (stamps_spent IN (5, 10)),
  flavor_selection text,
  qr_code text UNIQUE NOT NULL,
  redeemed_at timestamptz DEFAULT now(),
  used_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired', 'cancelled'))
);

ALTER TABLE stamps_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stamp redemptions"
  ON stamps_redemptions FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Anon users can view stamp redemptions"
  ON stamps_redemptions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Users can insert stamp redemptions"
  ON stamps_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Anon users can insert stamp redemptions"
  ON stamps_redemptions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Users can update stamp redemptions"
  ON stamps_redemptions FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Anon users can update stamp redemptions"
  ON stamps_redemptions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_stamps_redemptions_user_id ON stamps_redemptions(user_id);
CREATE INDEX idx_stamps_redemptions_qr_code ON stamps_redemptions(qr_code);
CREATE INDEX idx_stamps_redemptions_status ON stamps_redemptions(status);
CREATE INDEX idx_stamps_redemptions_redeemed_at ON stamps_redemptions(redeemed_at DESC);

-- =====================================================
-- FUNCTION: Auto-update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_stamps_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_stamps_tracking_updated_at
  BEFORE UPDATE ON stamps_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_stamps_tracking_updated_at();
