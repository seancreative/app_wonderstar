/*
  # Add Staff Authentication Fields

  1. Changes to `staff_passcodes` table
    - Add `email` column (unique, required for login)
    - Add `password_hash` column (bcrypt hashed password)
    - Add `description` column (staff role/notes)
    - Update constraints to allow email-based lookup

  2. Security
    - Maintain existing RLS policies
    - Ensure email uniqueness globally (not per outlet)
    - Keep passcode unique per outlet for scanner functionality

  3. Notes
    - Email is used for login authentication
    - Passcode is still used for QR code scanning
    - Password is hashed using bcrypt
    - Description helps identify staff roles
*/

-- Add new columns to staff_passcodes table
DO $$
BEGIN
  -- Add email column (unique globally)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_passcodes' AND column_name = 'email'
  ) THEN
    ALTER TABLE staff_passcodes ADD COLUMN email text UNIQUE NOT NULL DEFAULT '';
  END IF;

  -- Add password_hash column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_passcodes' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE staff_passcodes ADD COLUMN password_hash text NOT NULL DEFAULT '';
  END IF;

  -- Add description column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_passcodes' AND column_name = 'description'
  ) THEN
    ALTER TABLE staff_passcodes ADD COLUMN description text DEFAULT '';
  END IF;
END $$;

-- Remove default empty string constraints after adding columns
ALTER TABLE staff_passcodes ALTER COLUMN email DROP DEFAULT;
ALTER TABLE staff_passcodes ALTER COLUMN password_hash DROP DEFAULT;

-- Create index for email lookups (for login)
CREATE INDEX IF NOT EXISTS idx_staff_passcodes_email ON staff_passcodes(email) WHERE is_active = true;

-- Add comment to clarify table usage
COMMENT ON TABLE staff_passcodes IS 'Staff authentication and access control. Email/password for login, passcode for QR scanner.';
COMMENT ON COLUMN staff_passcodes.email IS 'Unique email for staff login authentication';
COMMENT ON COLUMN staff_passcodes.password_hash IS 'Bcrypt hashed password for authentication';
COMMENT ON COLUMN staff_passcodes.passcode IS '4-digit code for QR scanner access';
COMMENT ON COLUMN staff_passcodes.description IS 'Staff role, notes, or department information';
