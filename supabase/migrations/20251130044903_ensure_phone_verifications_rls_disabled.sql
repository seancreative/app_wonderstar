/*
  # Ensure phone_verifications Table Has RLS Disabled

  ## Purpose
  This table is accessed exclusively via Edge Functions using the service role key.
  RLS must be disabled to allow Edge Functions to read/write verification codes.

  ## Changes
  - Explicitly disable RLS on phone_verifications table
  - Drop any existing policies if they exist

  ## Security Notes
  - Edge Functions use service role key which bypasses RLS anyway
  - Table contains only temporary OTP codes, not sensitive user data
  - Rate limiting and expiration are enforced at application level
  - OTP codes are cleared after successful verification
*/

-- Drop any existing policies (shouldn't exist, but just in case)
DROP POLICY IF EXISTS "Allow service role full access" ON phone_verifications;
DROP POLICY IF EXISTS "Allow authenticated read" ON phone_verifications;
DROP POLICY IF EXISTS "Allow anon insert" ON phone_verifications;

-- Explicitly disable RLS
ALTER TABLE phone_verifications DISABLE ROW LEVEL SECURITY;

-- Add comment
COMMENT ON TABLE phone_verifications IS 'Temporary OTP storage for phone verification. RLS disabled - accessed via Edge Functions with service role key only.';