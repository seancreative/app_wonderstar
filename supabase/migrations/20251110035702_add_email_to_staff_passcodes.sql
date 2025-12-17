/*
  # Add Email Field to Staff Passcodes

  ## Overview
  Adds email field to staff_passcodes table to enable staff login with email + passcode
  for quick access to the Star Scanner.

  ## Changes
  1. Add email column to staff_passcodes (nullable, unique)
  2. Add index on email for faster lookups
  3. Update RLS policy to allow email-based verification

  ## Notes
  - Email is optional to maintain backward compatibility with existing passcodes
  - When email is set, staff can log in with email + passcode for scanner-only access
*/

-- Add email column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_passcodes' AND column_name = 'email'
  ) THEN
    ALTER TABLE staff_passcodes ADD COLUMN email text UNIQUE;
  END IF;
END $$;

-- Add index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_staff_passcodes_email ON staff_passcodes(email) WHERE email IS NOT NULL AND is_active = true;

-- Update to allow email-based verification
DROP POLICY IF EXISTS "Anyone can verify active passcodes" ON staff_passcodes;
CREATE POLICY "Anyone can verify active passcodes"
  ON staff_passcodes
  FOR SELECT
  USING (is_active = true);