/*
  # Enhanced Staff and Rewards Management System
  
  This migration enhances the staff management system and rewards functionality:
  
  1. Updates staff_passcodes table to support global staff accounts
  2. Adds staff_scan_logs table for detailed scan tracking
  3. Adds rewards table enhancements
  4. Creates indexes for performance
*/

-- Remove outlet_id requirement from staff_passcodes and make it optional
-- This allows for global staff accounts that can work at any outlet
ALTER TABLE staff_passcodes 
  DROP CONSTRAINT IF EXISTS staff_passcodes_outlet_id_fkey,
  ALTER COLUMN outlet_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS staff_passcodes_outlet_id_passcode_key;

-- Add new fields for enhanced staff management
ALTER TABLE staff_passcodes
  ADD COLUMN IF NOT EXISTS staff_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS roles jsonb DEFAULT '{"sections": [], "can_scan": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_superadmin boolean DEFAULT false;

-- Create unique constraint that allows outlet_id to be null
DROP INDEX IF EXISTS idx_staff_passcodes_verification;
CREATE UNIQUE INDEX idx_staff_passcodes_unique_passcode 
  ON staff_passcodes(passcode) 
  WHERE outlet_id IS NULL;

-- Create staff scan logs table
CREATE TABLE IF NOT EXISTS staff_scan_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES staff_passcodes(id) ON DELETE CASCADE,
  staff_name text NOT NULL,
  scan_type text NOT NULL CHECK (scan_type IN ('order', 'customer', 'workshop', 'reward')),
  scanned_entity_id uuid,
  scanned_entity_type text,
  qr_code text,
  customer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  customer_name text,
  order_id uuid,
  outlet_id uuid REFERENCES outlets(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  scanned_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Indexes for staff_scan_logs
CREATE INDEX IF NOT EXISTS idx_staff_scan_logs_staff_id ON staff_scan_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_scan_logs_customer_id ON staff_scan_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_staff_scan_logs_order_id ON staff_scan_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_staff_scan_logs_scanned_at ON staff_scan_logs(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_scan_logs_outlet_id ON staff_scan_logs(outlet_id);

-- RLS for staff_scan_logs
ALTER TABLE staff_scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view their own scan logs"
  ON staff_scan_logs
  FOR SELECT
  USING (true);

CREATE POLICY "Staff can insert their own scan logs"
  ON staff_scan_logs
  FOR INSERT
  WITH CHECK (true);

-- Update rewards table to ensure it has all necessary fields
ALTER TABLE rewards
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS stock integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'toys',
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Function to generate staff_id
CREATE OR REPLACE FUNCTION generate_staff_id()
RETURNS text AS $$
DECLARE
  new_id text;
  exists boolean;
BEGIN
  LOOP
    new_id := 'STF-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    SELECT EXISTS(SELECT 1 FROM staff_passcodes WHERE staff_id = new_id) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate staff_id on insert
CREATE OR REPLACE FUNCTION set_staff_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.staff_id IS NULL THEN
    NEW.staff_id := generate_staff_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_staff_id ON staff_passcodes;
CREATE TRIGGER trigger_set_staff_id
  BEFORE INSERT ON staff_passcodes
  FOR EACH ROW
  EXECUTE FUNCTION set_staff_id();

-- Update existing staff records to have staff_id
UPDATE staff_passcodes 
SET staff_id = generate_staff_id()
WHERE staff_id IS NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_staff_passcodes_staff_id ON staff_passcodes(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_passcodes_email ON staff_passcodes(email);
CREATE INDEX IF NOT EXISTS idx_rewards_is_active ON rewards(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_rewards_category ON rewards(category);
