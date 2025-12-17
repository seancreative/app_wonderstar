/*
  # Update User Activity Timeline Schema

  ## Changes
  - Add missing columns: activity_category, icon, amount_change
  - Rename activity_title to title
  - Rename activity_description to description
  - Add indexes for performance
  
  ## Purpose
  Enhances the activity timeline to track all user actions including vouchers, gacha, 
  profile updates, stars transactions, and more.
*/

-- Add missing columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_activity_timeline' 
                 AND column_name = 'activity_category') THEN
    ALTER TABLE user_activity_timeline ADD COLUMN activity_category text NOT NULL DEFAULT 'gamification';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_activity_timeline' 
                 AND column_name = 'icon') THEN
    ALTER TABLE user_activity_timeline ADD COLUMN icon text DEFAULT 'Activity';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_activity_timeline' 
                 AND column_name = 'amount_change') THEN
    ALTER TABLE user_activity_timeline ADD COLUMN amount_change decimal(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_activity_timeline' 
                 AND column_name = 'title') THEN
    ALTER TABLE user_activity_timeline ADD COLUMN title text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_activity_timeline' 
                 AND column_name = 'description') THEN
    ALTER TABLE user_activity_timeline ADD COLUMN description text;
  END IF;
END $$;

-- Copy data from old columns to new columns if needed
UPDATE user_activity_timeline SET title = activity_title WHERE title IS NULL AND activity_title IS NOT NULL;
UPDATE user_activity_timeline SET description = activity_description WHERE description IS NULL AND activity_description IS NOT NULL;

-- Make title not null after copying data
ALTER TABLE user_activity_timeline ALTER COLUMN title SET NOT NULL;

-- Drop old columns after data is copied
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'user_activity_timeline' 
             AND column_name = 'activity_title') THEN
    ALTER TABLE user_activity_timeline DROP COLUMN activity_title;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'user_activity_timeline' 
             AND column_name = 'activity_description') THEN
    ALTER TABLE user_activity_timeline DROP COLUMN activity_description;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_activity_timeline_user_id ON user_activity_timeline(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_timeline_created_at ON user_activity_timeline(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_timeline_activity_type ON user_activity_timeline(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_timeline_category ON user_activity_timeline(activity_category);
CREATE INDEX IF NOT EXISTS idx_user_activity_timeline_user_created ON user_activity_timeline(user_id, created_at DESC);

-- Add helpful comments
COMMENT ON TABLE user_activity_timeline IS 'Complete activity timeline tracking all user actions for audit trail and user insights';
COMMENT ON COLUMN user_activity_timeline.metadata IS 'Flexible JSON storage for activity-specific data like order_id, voucher_code, etc';
COMMENT ON COLUMN user_activity_timeline.stars_change IS 'Positive or negative star change (0 if not applicable)';
COMMENT ON COLUMN user_activity_timeline.amount_change IS 'Positive or negative wallet amount change (0 if not applicable)';
COMMENT ON COLUMN user_activity_timeline.icon IS 'Icon identifier from lucide-react to display in UI';
COMMENT ON COLUMN user_activity_timeline.activity_type IS 'Type of activity: voucher_redeemed, gacha_spin, profile_updated, stars_earned, wallet_topup, etc';
COMMENT ON COLUMN user_activity_timeline.activity_category IS 'Category: transaction, gamification, profile, social, reward, shop';
