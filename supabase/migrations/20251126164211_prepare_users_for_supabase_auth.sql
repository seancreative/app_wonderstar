/*
  # Prepare Users Table for Supabase Authentication

  ## Overview
  This migration prepares the existing users table to work with Supabase Auth
  by adding necessary columns and indexes. All existing user data is preserved.

  ## Changes
  1. Add auth_id column to link with auth.users table
  2. Add password_hash column for temporary password storage
  3. Add indexes for performance
  4. Create helper function to check if user has auth account

  ## Safety
  - Uses IF NOT EXISTS to avoid errors if columns already exist
  - All existing data is preserved
  - No data is modified or deleted
  - Rollback safe (columns can be dropped if needed)

  ## Post-Migration
  - Existing users will have NULL auth_id until migration script runs
  - New signups will populate auth_id immediately
*/

-- =====================================================
-- ADD AUTH COLUMNS TO USERS TABLE
-- =====================================================

-- Add auth_id to link with Supabase auth.users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE;

-- Add password_hash for temporary storage during migration
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_hash text;

-- Add flag to track migration status
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_migrated boolean DEFAULT false;

-- Add timestamp for when user was migrated to auth
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_migrated_at timestamptz;

-- =====================================================
-- CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_migrated ON users(auth_migrated) WHERE auth_migrated = false;

-- =====================================================
-- ADD SIMILAR COLUMNS TO ADMIN_USERS
-- =====================================================

ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS auth_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE;

ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS password_hash text;

ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS auth_migrated boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_admin_users_auth_id ON admin_users(auth_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- =====================================================
-- ADD SIMILAR COLUMNS TO STAFF_PASSCODES
-- =====================================================

ALTER TABLE staff_passcodes 
ADD COLUMN IF NOT EXISTS auth_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE;

ALTER TABLE staff_passcodes 
ADD COLUMN IF NOT EXISTS password_hash text;

ALTER TABLE staff_passcodes 
ADD COLUMN IF NOT EXISTS auth_migrated boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_staff_passcodes_auth_id ON staff_passcodes(auth_id);
CREATE INDEX IF NOT EXISTS idx_staff_passcodes_email ON staff_passcodes(email);

-- =====================================================
-- CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to check if a user has been migrated to Supabase Auth
CREATE OR REPLACE FUNCTION has_supabase_auth(user_email text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE email = user_email AND auth_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user ID from auth ID
CREATE OR REPLACE FUNCTION get_user_id_from_auth()
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  RAISE NOTICE 'USERS TABLE PREPARED FOR AUTH MIGRATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total users: %', users_count;
  RAISE NOTICE 'Already migrated: %', migrated_count;
  RAISE NOTICE 'Pending migration: %', (users_count - migrated_count);
  RAISE NOTICE '';
  RAISE NOTICE 'Next step: Run user migration script';
  RAISE NOTICE '========================================';
END $$;
