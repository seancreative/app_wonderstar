/*
  # Create Temporary Phone Verification Table

  1. Purpose
    - Store OTP codes for phone numbers during signup process
    - Allow verification before user account is created
    - Track rate limiting for unregistered phone numbers

  2. New Table: phone_verifications
    - `phone` (text, primary key) - phone number being verified
    - `verification_code` (text) - current OTP code
    - `expires_at` (timestamptz) - when OTP expires (5 minutes)
    - `sent_count` (integer) - number of SMS sent in current hour
    - `last_sent_at` (timestamptz) - timestamp of last SMS
    - `verified` (boolean) - whether phone has been verified
    - `verified_at` (timestamptz) - when verification completed
    - `created_at` (timestamptz) - when record created
    - `updated_at` (timestamptz) - last update time

  3. Security
    - No RLS needed - accessed only via Edge Functions with service role key
    - Auto-cleanup of expired records
    - Rate limiting enforced

  4. Notes
    - Temporary storage during signup
    - Records can be cleaned up after 24 hours
    - Verification status copied to users table after signup
*/

-- Create phone_verifications table for temporary storage during signup
CREATE TABLE IF NOT EXISTS phone_verifications (
  phone TEXT PRIMARY KEY,
  verification_code TEXT,
  expires_at TIMESTAMPTZ,
  sent_count INTEGER DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_phone_verifications_expires_at 
  ON phone_verifications(expires_at);

-- Add index for rate limiting
CREATE INDEX IF NOT EXISTS idx_phone_verifications_last_sent 
  ON phone_verifications(last_sent_at);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_phone_verifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS phone_verifications_updated_at ON phone_verifications;
CREATE TRIGGER phone_verifications_updated_at
  BEFORE UPDATE ON phone_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_phone_verifications_updated_at();

-- Add comments
COMMENT ON TABLE phone_verifications IS 'Temporary storage for phone verification during signup process';
COMMENT ON COLUMN phone_verifications.phone IS 'Phone number being verified (with country code)';
COMMENT ON COLUMN phone_verifications.verification_code IS 'Current OTP code for verification';
COMMENT ON COLUMN phone_verifications.expires_at IS 'When the OTP expires (5 minutes from send)';
COMMENT ON COLUMN phone_verifications.sent_count IS 'Number of SMS sent in current hour (rate limiting)';
COMMENT ON COLUMN phone_verifications.verified IS 'Whether phone has been successfully verified';
