/*
  # Create User Preferences Table

  ## Purpose
  Replace localStorage with Supabase-backed storage for user preferences

  ## Table Created
  
  **user_preferences**
  - Stores user-specific preferences like theme, selected outlet, selected voucher
  - One record per user
  
  ## Security
  - RLS disabled for now (consistent with other tables in development)
  - Will be enabled when full auth migration is complete
*/

-- ============================================================================
-- CREATE USER_PREFERENCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- UI Preferences
  theme text DEFAULT 'colorful' CHECK (theme IN ('light', 'dark', 'colorful', 'robotic', 'aifuture', 'cyberpunk', 'icecream', 'pastel')),
  
  -- Shop Preferences
  selected_outlet_id uuid REFERENCES outlets(id) ON DELETE SET NULL,
  selected_voucher_code text,
  
  -- Notification Preferences
  notifications_enabled boolean DEFAULT true,
  email_notifications boolean DEFAULT true,
  push_notifications boolean DEFAULT true,
  
  -- App Settings
  haptics_enabled boolean DEFAULT true,
  reduce_motion boolean DEFAULT false,
  surprises_enabled boolean DEFAULT true,
  
  -- Language
  language text DEFAULT 'en',
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- ============================================================================
-- DISABLE RLS FOR DEVELOPMENT (consistent with other tables)
-- ============================================================================

ALTER TABLE user_preferences DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE FUNCTION TO AUTO-UPDATE updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();

-- ============================================================================
-- INITIALIZE PREFERENCES FOR EXISTING USERS
-- ============================================================================

INSERT INTO user_preferences (user_id, theme)
SELECT id, 'colorful'
FROM users
ON CONFLICT (user_id) DO NOTHING;
