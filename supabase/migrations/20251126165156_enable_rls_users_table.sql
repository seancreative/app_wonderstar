/*
  # Enable RLS - Users Table

  ## Overview
  This migration enables Row Level Security on the users table.
  This is the core authentication table linking to Supabase auth.

  ## Security Model
  - Users can view their own profile
  - Users can update their own profile
  - Anyone can create a user account (signup)
  - Admins can view all users
  - Service role has full access

  ## Safety
  - Critical table for authentication
  - Allows self-registration (signup)
  - Prevents users from viewing other users' data
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
      AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

-- =====================================================
-- USERS TABLE
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- Allow user registration (signup) - anyone can insert
CREATE POLICY "Allow user registration"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth_id = auth.uid());

-- Admins can view all users
CREATE POLICY "Admins view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE auth_id = auth.uid()
        AND is_active = true
    )
  );

-- Service role has full access
CREATE POLICY "Service can manage users"
  ON users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
DECLARE
  users_count integer;
  migrated_count integer;
BEGIN
  SELECT COUNT(*) INTO users_count FROM users;
  SELECT COUNT(*) INTO migrated_count FROM users WHERE auth_id IS NOT NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS ENABLED - USERS TABLE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total users: %', users_count;
  RAISE NOTICE 'Migrated to auth: %', migrated_count;
  RAISE NOTICE 'Pending migration: %', (users_count - migrated_count);
  RAISE NOTICE '';
  RAISE NOTICE 'Security: Users access only their own data';
  RAISE NOTICE '========================================';
END $$;
