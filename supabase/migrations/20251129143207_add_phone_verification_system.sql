/*
  # Add Phone Verification System

  1. Purpose
    - Enable SMS-based phone number verification during signup
    - Track verification status and rate limiting
    - Support OTP code validation with expiry

  2. New Columns for users table
    - `phone_verified` (boolean) - whether phone is verified
    - `phone_verification_code` (text) - current OTP code (hashed for security)
    - `phone_verification_expires_at` (timestamptz) - when OTP expires
    - `phone_verification_sent_count` (integer) - sends in current hour
    - `phone_verification_last_sent_at` (timestamptz) - last SMS send time
    - `phone_verified_at` (timestamptz) - when verification completed

  3. Security
    - OTP codes stored temporarily
    - Rate limiting via sent_count and last_sent_at
    - Automatic expiry after 5 minutes
    - Cleared after successful verification

  4. Notes
    - Existing users default to unverified (no retroactive verification)
    - Verification is optional during signup
    - Rate limit: 3 SMS per hour per phone number
*/

-- Add phone verification fields to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verification_code TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS phone_verification_expires_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS phone_verification_sent_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phone_verification_last_sent_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ DEFAULT NULL;

-- Add index for performance on verification queries
CREATE INDEX IF NOT EXISTS idx_users_phone_verification 
  ON users(phone, phone_verified);

-- Add index for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_users_verification_rate_limit 
  ON users(phone, phone_verification_last_sent_at);

-- Add comments for documentation
COMMENT ON COLUMN users.phone_verified IS 'Whether the phone number has been verified via SMS OTP';
COMMENT ON COLUMN users.phone_verification_code IS 'Current OTP code for verification (cleared after use)';
COMMENT ON COLUMN users.phone_verification_expires_at IS 'Timestamp when the OTP code expires (5 minutes from send)';
COMMENT ON COLUMN users.phone_verification_sent_count IS 'Number of SMS sent in current hour (for rate limiting)';
COMMENT ON COLUMN users.phone_verification_last_sent_at IS 'Timestamp of last SMS send (for rate limiting)';
COMMENT ON COLUMN users.phone_verified_at IS 'Timestamp when phone was successfully verified';
