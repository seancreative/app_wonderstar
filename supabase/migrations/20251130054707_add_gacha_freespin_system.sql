/*
  # Add Gacha Free Spin System

  1. Changes
    - Add `gacha_freespin` column to users table
      - Stores the number of free gacha spins available
      - Default value: 0
      - Type: integer

  2. Functions
    - `grant_gacha_freespins` - Function to grant free spins to users
      - Parameters: user_id, amount, reason
      - Updates user's free spin count
      - Logs activity in timeline

  3. Initial Data
    - Set all existing users to have 0 free spins

  4. Notes
    - Free spins are used before stars in the gacha system
    - Admins can grant free spins via CMS
    - Free spin usage is tracked in stars_transactions
*/

-- Add gacha_freespin column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'gacha_freespin'
  ) THEN
    ALTER TABLE users ADD COLUMN gacha_freespin integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Update existing users to have 0 free spins
UPDATE users SET gacha_freespin = 0 WHERE gacha_freespin IS NULL;

-- Create function to grant free spins to users
CREATE OR REPLACE FUNCTION grant_gacha_freespins(
  p_user_id uuid,
  p_amount integer,
  p_reason text DEFAULT 'admin_grant'
)
RETURNS void AS $$
BEGIN
  -- Update user's free spin count
  UPDATE users
  SET gacha_freespin = gacha_freespin + p_amount,
      updated_at = now()
  WHERE id = p_user_id;

  -- Log in activity timeline
  INSERT INTO user_activity_timeline (
    user_id,
    title,
    description,
    activity_type,
    metadata,
    created_at
  )
  VALUES (
    p_user_id,
    'Free Spins Received',
    format('Received %s free gacha spin%s - %s',
      p_amount,
      CASE WHEN p_amount > 1 THEN 's' ELSE '' END,
      p_reason
    ),
    'gacha_freespin_grant',
    jsonb_build_object(
      'amount', p_amount,
      'reason', p_reason,
      'timestamp', now()
    ),
    now()
  );
END;
$$ LANGUAGE plpgsql;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_gacha_freespin ON users(gacha_freespin) WHERE gacha_freespin > 0;
