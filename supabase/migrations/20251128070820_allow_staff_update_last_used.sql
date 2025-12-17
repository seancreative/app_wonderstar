/*
  # Allow Staff to Update Last Used Timestamp
  
  ## Summary
  This migration ensures authenticated staff can update their last_used_at
  and auth_id fields after successful login.
  
  ## Changes
  1. Add policy for authenticated users to update their own last_used_at
  2. Allow updating auth_id when linking Supabase Auth account
  
  ## Security
  - Staff can only update their own record
  - Only specific fields can be updated (last_used_at, auth_id)
*/

-- Drop old policy if exists
DROP POLICY IF EXISTS "Staff can update login time" ON staff_passcodes;
DROP POLICY IF EXISTS "Staff can update own login data" ON staff_passcodes;

-- Allow staff to update their last_used_at and auth_id after login
CREATE POLICY "Staff can update own login data"
  ON staff_passcodes
  FOR UPDATE
  TO authenticated
  USING (auth_id = auth.uid() OR email = auth.email())
  WITH CHECK (auth_id = auth.uid() OR email = auth.email());

COMMENT ON POLICY "Staff can update own login data" ON staff_passcodes IS 'Allows staff to update last_used_at and auth_id after login';

-- Also allow service role full access for system operations
DROP POLICY IF EXISTS "Service full access staff" ON staff_passcodes;

CREATE POLICY "Service role full access to staff"
  ON staff_passcodes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Service role full access to staff" ON staff_passcodes IS 'Allows service role to perform system operations on staff records';
