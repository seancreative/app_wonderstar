/*
  # Fix Staff Login RLS - Allow Anonymous Login
  
  ## Summary
  This migration ensures staff can login by allowing anonymous (unauthenticated) users
  to read their email and password_hash from staff_passcodes table for authentication.
  
  ## Changes
  1. Add RLS policy allowing anonymous SELECT for login purposes
  2. Ensure password_hash is readable during login flow
  3. Staff can authenticate before having a session
  
  ## Security
  - Only SELECT allowed (no modifications)
  - Only for active staff
  - Required for bcrypt password verification
*/

-- Drop old login policy if it exists
DROP POLICY IF EXISTS "Staff can login" ON staff_passcodes;
DROP POLICY IF EXISTS "Allow anonymous staff login" ON staff_passcodes;

-- Allow anonymous users to read staff data for login verification
CREATE POLICY "Allow anonymous staff login"
  ON staff_passcodes
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

COMMENT ON POLICY "Allow anonymous staff login" ON staff_passcodes IS 'Allows unauthenticated users to read staff data for login verification (email and password_hash)';
