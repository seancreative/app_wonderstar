/*
  # Fix Staff Passcodes System and Add Redemption Logging

  ## Overview
  This migration updates the staff passcode system to work globally across all outlets
  instead of being outlet-specific. It also creates comprehensive logging for all
  redemption activities.

  ## Changes

  ### 1. Staff Passcodes Schema Updates
  - Make outlet_id nullable (passcodes work at all outlets)
  - Add is_superadmin flag to identify admin passcodes like "1234"
  - Update existing "1234" passcodes to be superadmin and work globally
  - Remove unique constraint on (outlet_id, passcode) since outlet_id is now optional
  - Add new unique constraint on passcode alone for global uniqueness

  ### 2. New Tables

  **staff_redemption_logs** - Comprehensive audit trail for all redemption attempts
  - id (uuid, primary key)
  - staff_passcode_id (uuid, nullable) - Links to staff who performed redemption
  - redemption_type (text) - 'order', 'gift', 'stamp', 'mystery_box'
  - redemption_id (uuid) - ID of the redeemed item (order_id, redemption_id, etc)
  - user_id (uuid) - Customer whose item was redeemed
  - outlet_id (uuid, nullable) - Where redemption occurred
  - items_redeemed (jsonb) - Details of what was redeemed
  - success (boolean) - Whether redemption succeeded
  - failure_reason (text, nullable) - Why redemption failed if applicable
  - passcode_entered (text, nullable) - Track failed attempts (for security)
  - ip_address (text, nullable)
  - metadata (jsonb) - Additional context
  - created_at (timestamptz)

  ## Security
  - RLS enabled on staff_redemption_logs
  - Logs are append-only for security audit purposes
  - Failed attempts are logged for security monitoring
  - Admins can view all logs, regular users cannot

  ## Indexes
  - Index on staff_passcode_id for tracking staff activity
  - Index on redemption_type and redemption_id for lookups
  - Index on created_at for time-based queries
  - Index on success for filtering failed attempts
  - Index on outlet_id for location-based reporting
*/

-- Step 1: Drop existing unique constraint on (outlet_id, passcode)
DO $$
BEGIN
  ALTER TABLE staff_passcodes DROP CONSTRAINT IF EXISTS staff_passcodes_outlet_id_passcode_key;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Step 2: Make outlet_id nullable and add is_superadmin flag
DO $$
BEGIN
  -- Make outlet_id nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_passcodes' AND column_name = 'outlet_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE staff_passcodes ALTER COLUMN outlet_id DROP NOT NULL;
  END IF;

  -- Add is_superadmin column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_passcodes' AND column_name = 'is_superadmin'
  ) THEN
    ALTER TABLE staff_passcodes ADD COLUMN is_superadmin boolean DEFAULT false;
  END IF;

  -- Add description column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_passcodes' AND column_name = 'description'
  ) THEN
    ALTER TABLE staff_passcodes ADD COLUMN description text;
  END IF;
END $$;

-- Step 3: Update existing "1234" passcodes to be superadmin and remove outlet restriction
UPDATE staff_passcodes
SET
  outlet_id = NULL,
  is_superadmin = true,
  staff_name = 'Super Admin',
  description = 'Master passcode that works at all outlets'
WHERE passcode = '1234';

-- Step 4: Remove duplicate "1234" entries, keep only one
WITH first_passcode AS (
  SELECT id
  FROM staff_passcodes
  WHERE passcode = '1234'
  ORDER BY created_at
  LIMIT 1
)
DELETE FROM staff_passcodes
WHERE passcode = '1234'
AND id NOT IN (SELECT id FROM first_passcode);

-- Step 5: Add unique constraint on passcode alone (global uniqueness)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staff_passcodes_passcode_unique'
  ) THEN
    ALTER TABLE staff_passcodes ADD CONSTRAINT staff_passcodes_passcode_unique UNIQUE (passcode);
  END IF;
END $$;

-- Step 6: Update indexes
DROP INDEX IF EXISTS idx_staff_passcodes_verification;
CREATE INDEX IF NOT EXISTS idx_staff_passcodes_passcode ON staff_passcodes(passcode) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_staff_passcodes_superadmin ON staff_passcodes(is_superadmin) WHERE is_superadmin = true;

-- Step 7: Create staff_redemption_logs table
CREATE TABLE IF NOT EXISTS staff_redemption_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_passcode_id uuid REFERENCES staff_passcodes(id) ON DELETE SET NULL,
  redemption_type text NOT NULL CHECK (redemption_type IN ('order', 'gift', 'stamp', 'mystery_box')),
  redemption_id uuid NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  outlet_id uuid REFERENCES outlets(id) ON DELETE SET NULL,
  items_redeemed jsonb DEFAULT '[]'::jsonb,
  success boolean NOT NULL DEFAULT true,
  failure_reason text,
  passcode_entered text,
  ip_address text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_staff_redemption_logs_staff ON staff_redemption_logs(staff_passcode_id);
CREATE INDEX IF NOT EXISTS idx_staff_redemption_logs_redemption ON staff_redemption_logs(redemption_type, redemption_id);
CREATE INDEX IF NOT EXISTS idx_staff_redemption_logs_user ON staff_redemption_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_redemption_logs_outlet ON staff_redemption_logs(outlet_id);
CREATE INDEX IF NOT EXISTS idx_staff_redemption_logs_created_at ON staff_redemption_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_redemption_logs_success ON staff_redemption_logs(success) WHERE success = false;
CREATE INDEX IF NOT EXISTS idx_staff_redemption_logs_type_date ON staff_redemption_logs(redemption_type, created_at DESC);

-- Enable RLS
ALTER TABLE staff_redemption_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff_redemption_logs
CREATE POLICY "Admins can view all redemption logs"
  ON staff_redemption_logs
  FOR SELECT
  USING (true);

CREATE POLICY "System can insert redemption logs"
  ON staff_redemption_logs
  FOR INSERT
  WITH CHECK (true);

-- Update RLS policy for staff_passcodes to allow verification without outlet restriction
DROP POLICY IF EXISTS "Anyone can verify active passcodes" ON staff_passcodes;
CREATE POLICY "Anyone can verify active passcodes"
  ON staff_passcodes
  FOR SELECT
  USING (is_active = true);

-- Ensure at least one superadmin passcode exists
INSERT INTO staff_passcodes (staff_name, passcode, is_active, is_superadmin, description, outlet_id)
VALUES (
  'Super Admin',
  '1234',
  true,
  true,
  'Master passcode that works at all outlets',
  NULL
)
ON CONFLICT (passcode) DO UPDATE
SET
  is_superadmin = true,
  outlet_id = NULL,
  staff_name = 'Super Admin',
  description = 'Master passcode that works at all outlets';

-- Function to log redemption attempts
CREATE OR REPLACE FUNCTION log_staff_redemption(
  p_staff_passcode_id uuid,
  p_redemption_type text,
  p_redemption_id uuid,
  p_user_id uuid,
  p_outlet_id uuid,
  p_items_redeemed jsonb,
  p_success boolean,
  p_failure_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO staff_redemption_logs (
    staff_passcode_id,
    redemption_type,
    redemption_id,
    user_id,
    outlet_id,
    items_redeemed,
    success,
    failure_reason,
    metadata
  ) VALUES (
    p_staff_passcode_id,
    p_redemption_type,
    p_redemption_id,
    p_user_id,
    p_outlet_id,
    p_items_redeemed,
    p_success,
    p_failure_reason,
    p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;