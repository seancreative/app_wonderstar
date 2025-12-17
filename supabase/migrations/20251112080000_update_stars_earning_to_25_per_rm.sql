/*
  # Update Stars Earning System to 25 Stars per RM1

  ## Overview
  Updates the entire stars earning system from 1 star per RM1 to 25 stars per RM1.
  This provides a more rewarding and engaging user experience with higher perceived value.

  ## Changes
  1. **Updated Membership Tier Multipliers**
     - Bronze (RM 0): 25.0x multiplier (1 RM = 25 stars)
     - Silver (RM 500): 30.0x multiplier (1 RM = 30 stars, 20% bonus)
     - Gold (RM 2000): 37.5x multiplier (1 RM = 38 stars, 50% bonus)
     - Platinum (RM 5000): 50.0x multiplier (1 RM = 50 stars, 100% bonus)
     - VIP (RM 10000): 62.5x multiplier (1 RM = 63 stars, 150% bonus)

  2. **Bonus Progress Tracking Table**
     - Tracks user progress toward 1,500 stars milestone
     - Resets automatically after milestone completion
     - Supports multiple milestone completions tracking

  ## Benefits
  - More engaging reward system with higher star counts
  - Clear progression visible to users
  - Gamification through milestone tracking
  - Maintains proportional tier benefits

  ## Notes
  - All existing stars remain unchanged (no retroactive adjustments)
  - Future star earnings will use the new multiplier system
  - Admins can adjust multipliers through the membership_tiers table
*/

-- Update Bronze tier multiplier to 25.0x (base rate)
UPDATE membership_tiers SET
  earn_multiplier = 25.0,
  updated_at = now()
WHERE name = 'Bronze';

-- Update Silver tier multiplier to 30.0x (1.2x bonus)
UPDATE membership_tiers SET
  earn_multiplier = 30.0,
  updated_at = now()
WHERE name = 'Silver';

-- Update Gold tier multiplier to 37.5x (1.5x bonus)
UPDATE membership_tiers SET
  earn_multiplier = 37.5,
  updated_at = now()
WHERE name = 'Gold';

-- Update Platinum tier multiplier to 50.0x (2.0x bonus)
UPDATE membership_tiers SET
  earn_multiplier = 50.0,
  updated_at = now()
WHERE name = 'Platinum';

-- Update VIP tier multiplier to 62.5x (2.5x bonus)
UPDATE membership_tiers SET
  earn_multiplier = 62.5,
  updated_at = now()
WHERE name = 'VIP';

-- Create bonus_progress table to track progress toward milestone rewards
CREATE TABLE IF NOT EXISTS bonus_progress (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_stars integer DEFAULT 0 CHECK (current_stars >= 0),
  milestone_target integer DEFAULT 1500 CHECK (milestone_target > 0),
  times_completed integer DEFAULT 0 CHECK (times_completed >= 0),
  last_reset_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_bonus_progress_user_id ON bonus_progress(user_id);

-- Create function to automatically update bonus progress when stars are earned
CREATE OR REPLACE FUNCTION update_bonus_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when stars are earned (not spent)
  IF NEW.transaction_type IN ('earn', 'bonus') AND NEW.amount > 0 THEN
    -- Insert or update bonus progress
    INSERT INTO bonus_progress (user_id, current_stars, updated_at)
    VALUES (NEW.user_id, NEW.amount, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
      current_stars = LEAST(bonus_progress.current_stars + NEW.amount, bonus_progress.milestone_target),
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update bonus progress
DROP TRIGGER IF EXISTS trigger_update_bonus_progress ON stars_transactions;
CREATE TRIGGER trigger_update_bonus_progress
  AFTER INSERT ON stars_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_bonus_progress();

-- Function to reset bonus progress and track completion
CREATE OR REPLACE FUNCTION reset_bonus_progress(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE bonus_progress
  SET
    current_stars = 0,
    times_completed = times_completed + 1,
    last_reset_at = now(),
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add updated_at column to membership_tiers if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'membership_tiers' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE membership_tiers ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;
