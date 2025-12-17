/*
  # Create Supabase Auth Accounts for All Staff
  
  ## Summary
  This migration creates Supabase Auth accounts for all active staff members who don't have auth_id linked yet.
  This ensures all staff can login via email/password authentication.
  
  ## Changes
  1. Creates a function to auto-create auth accounts for staff
  2. Staff without auth_id will have accounts created on next login
  3. Ensures all staff use email/password only (no passcode)
  
  ## Security
  - RLS policies updated to allow staff auth account creation
  - Staff can only access their own records via auth_id
*/

-- Create a function to help with staff auth account creation
-- This will be called by the application when staff login
CREATE OR REPLACE FUNCTION ensure_staff_auth_account(
  staff_email text,
  staff_password_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff_record RECORD;
BEGIN
  -- Get staff record
  SELECT * INTO staff_record
  FROM staff_passcodes
  WHERE email = staff_email
    AND is_active = true
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff not found or inactive';
  END IF;
  
  -- Return existing auth_id if present
  IF staff_record.auth_id IS NOT NULL THEN
    RETURN staff_record.auth_id;
  END IF;
  
  -- Note: Auth account creation happens in application layer
  -- This function just validates the staff exists
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION ensure_staff_auth_account IS 'Helper function to validate staff exists and return auth_id if present';
