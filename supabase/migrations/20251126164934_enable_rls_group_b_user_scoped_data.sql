/*
  # Enable RLS - Group B: User-Scoped Data

  ## Overview
  This migration enables Row Level Security on tables containing user-specific data.
  Users should only be able to access their own records.

  ## Tables Covered
  - child_profiles
  - user_preferences
  - notifications
  - mission_progress
  - workshop_bookings
  - check_ins
  - mystery_box_openings

  ## Security Model
  - Users can only SELECT their own data
  - Users can INSERT/UPDATE/DELETE their own data
  - Uses auth.uid() linked through users.auth_id

  ## Safety
  - Medium risk - affects user data access
  - Policies ensure users can't see other users' data
  - Service role can still access all data for admin operations
*/

-- =====================================================
-- DROP EXISTING POLICIES FIRST
-- =====================================================

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'child_profiles', 'user_preferences', 'notifications',
        'mission_progress', 'workshop_bookings', 'check_ins',
        'mystery_box_openings'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

-- =====================================================
-- CHILD PROFILES
-- =====================================================
ALTER TABLE child_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own children"
  ON child_profiles FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users insert own children"
  ON child_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users update own children"
  ON child_profiles FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users delete own children"
  ON child_profiles FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- =====================================================
-- USER PREFERENCES
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_preferences') THEN
    ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

    EXECUTE 'CREATE POLICY "Users manage own preferences"
      ON user_preferences FOR ALL
      TO authenticated
      USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
      WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))';
  END IF;
END $$;

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Service can create notifications"
  ON notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =====================================================
-- MISSION PROGRESS
-- =====================================================
ALTER TABLE mission_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own mission progress"
  ON mission_progress FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users update own mission progress"
  ON mission_progress FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Service can manage mission progress"
  ON mission_progress FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- WORKSHOP BOOKINGS
-- =====================================================
ALTER TABLE workshop_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own bookings"
  ON workshop_bookings FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users create own bookings"
  ON workshop_bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Service can manage bookings"
  ON workshop_bookings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- CHECK-INS
-- =====================================================
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own check-ins"
  ON check_ins FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users create check-ins"
  ON check_ins FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Service can manage check-ins"
  ON check_ins FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- MYSTERY BOX OPENINGS
-- =====================================================
ALTER TABLE mystery_box_openings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own box openings"
  ON mystery_box_openings FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users create box openings"
  ON mystery_box_openings FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Service can manage box openings"
  ON mystery_box_openings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS ENABLED - GROUP B (USER DATA)';
  RAISE NOTICE 'Security: Users access only their own data';
  RAISE NOTICE '========================================';
END $$;
