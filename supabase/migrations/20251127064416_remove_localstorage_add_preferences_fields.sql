/*
  # Remove localStorage Dependencies - Add Preferences Fields

  ## Overview
  This migration adds database fields to support moving all data from localStorage
  to Supabase, ensuring proper data persistence, security, and multi-device sync.

  ## Changes

  1. **user_preferences table enhancements**
     - Add `ui_hints` JSONB column for storing UI tutorial hints
     - Ensure `theme` column exists with proper default
     - Add indexes for performance

  2. **staff_passcodes table enhancements**
     - Add `auth_id` column to link staff to Supabase Auth
     - Add index for auth_id lookups
     - Enable staff to use Supabase Auth sessions

  ## Purpose
  Eliminate localStorage usage for:
  - User authentication (use Supabase Auth sessions)
  - Admin authentication (use Supabase Auth sessions)
  - Staff authentication (use Supabase Auth sessions)
  - Theme preferences (store in user_preferences)
  - UI hints/tutorials (store in user_preferences.ui_hints)

  ## Security Benefits
  - No client-side session storage (XSS protection)
  - All authentication via Supabase Auth (JWT tokens)
  - Data persists across devices
  - Single source of truth
  - Proper audit trails

  ## Data Structure

  ### ui_hints JSONB Format
  ```json
  {
    "quantity_hint_seen": true,
    "welcome_tutorial_seen": false,
    "cart_tutorial_seen": true
  }
  ```
*/

-- =====================================================
-- USER PREFERENCES - Add UI Hints Support
-- =====================================================

-- Add ui_hints column for storing UI tutorial/hint states
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_preferences' AND column_name = 'ui_hints'
  ) THEN
    ALTER TABLE user_preferences 
    ADD COLUMN ui_hints JSONB DEFAULT '{}';
  END IF;
END $$;

-- Ensure theme column exists with proper default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_preferences' AND column_name = 'theme'
  ) THEN
    ALTER TABLE user_preferences 
    ADD COLUMN theme TEXT DEFAULT 'colorful';
  END IF;
END $$;

-- Add index for user_id lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id 
ON user_preferences(user_id);

-- =====================================================
-- STAFF PASSCODES - Add Supabase Auth Support
-- =====================================================

-- Add auth_id to link staff to Supabase Auth
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_passcodes' AND column_name = 'auth_id'
  ) THEN
    ALTER TABLE staff_passcodes 
    ADD COLUMN auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add unique constraint on auth_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staff_passcodes_auth_id_key'
  ) THEN
    ALTER TABLE staff_passcodes 
    ADD CONSTRAINT staff_passcodes_auth_id_key UNIQUE (auth_id);
  END IF;
END $$;

-- Add index for auth_id lookups
CREATE INDEX IF NOT EXISTS idx_staff_passcodes_auth_id 
ON staff_passcodes(auth_id);

-- =====================================================
-- HELPER FUNCTION: Get User Preference
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_preference(
  p_user_id UUID,
  p_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value JSONB;
BEGIN
  SELECT 
    CASE 
      WHEN p_key = 'theme' THEN to_jsonb(theme)
      WHEN p_key = 'ui_hints' THEN ui_hints
      ELSE NULL
    END INTO v_value
  FROM user_preferences
  WHERE user_id = p_user_id;

  RETURN COALESCE(v_value, '{}'::JSONB);
END;
$$;

-- =====================================================
-- HELPER FUNCTION: Set User Preference
-- =====================================================

CREATE OR REPLACE FUNCTION public.set_user_preference(
  p_user_id UUID,
  p_key TEXT,
  p_value JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_preferences (user_id, updated_at)
  VALUES (p_user_id, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET updated_at = NOW();

  IF p_key = 'theme' THEN
    UPDATE user_preferences
    SET theme = p_value #>> '{}'
    WHERE user_id = p_user_id;
  ELSIF p_key = 'ui_hints' THEN
    UPDATE user_preferences
    SET ui_hints = COALESCE(ui_hints, '{}'::JSONB) || p_value
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'localStorage Elimination Migration Complete';
  RAISE NOTICE '';
  RAISE NOTICE 'Added to user_preferences:';
  RAISE NOTICE '  ✓ ui_hints JSONB column';
  RAISE NOTICE '  ✓ theme TEXT column (if missing)';
  RAISE NOTICE '  ✓ Indexes for performance';
  RAISE NOTICE '';
  RAISE NOTICE 'Added to staff_passcodes:';
  RAISE NOTICE '  ✓ auth_id UUID column';
  RAISE NOTICE '  ✓ Unique constraint on auth_id';
  RAISE NOTICE '  ✓ Index for auth_id lookups';
  RAISE NOTICE '';
  RAISE NOTICE 'Helper Functions Created:';
  RAISE NOTICE '  ✓ get_user_preference()';
  RAISE NOTICE '  ✓ set_user_preference()';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Update AuthContext (remove userId localStorage)';
  RAISE NOTICE '  2. Update AdminAuthContext (use Supabase Auth only)';
  RAISE NOTICE '  3. Update StaffAuthContext (use Supabase Auth only)';
  RAISE NOTICE '  4. Update ThemeContext (use database only)';
  RAISE NOTICE '  5. Update ProductDetailModal (use ui_hints)';
  RAISE NOTICE '========================================';
END $$;
