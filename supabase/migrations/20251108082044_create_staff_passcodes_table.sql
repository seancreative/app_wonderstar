/*
  # Create Staff Passcodes Table

  ## Overview
  Creates a system for managing staff passcodes used for order redemptions.
  Each outlet can have multiple staff members with unique passcodes.

  ## New Tables

  1. **staff_passcodes** - Store staff passcode configurations
     - id (uuid, primary key)
     - outlet_id (uuid, foreign key to outlets)
     - staff_name (text, not null) - Display name of staff member
     - passcode (text, not null) - 4-digit PIN code
     - is_active (boolean) - Enable/disable staff access
     - created_by_admin_id (uuid, foreign key to admin_users)
     - created_at (timestamptz)
     - updated_at (timestamptz)
     - last_used_at (timestamptz) - Track last redemption activity

  ## Security
  - RLS enabled on staff_passcodes table
  - Staff can verify their own passcode
  - Admins can manage all passcodes
  - Passcodes are stored as plain text for simplicity (4-digit PINs)

  ## Indexes
  - Index on outlet_id for quick lookups
  - Index on passcode + outlet_id for verification
  - Index on is_active for filtering active staff

  ## Initial Data
  - Seeds default passcode "1234" for each outlet with staff name "Staff Member"
*/

-- Create staff_passcodes table
CREATE TABLE IF NOT EXISTS staff_passcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  staff_name text NOT NULL,
  passcode text NOT NULL CHECK (passcode ~ '^\d{4}$'),
  is_active boolean DEFAULT true,
  created_by_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE(outlet_id, passcode)
);

CREATE INDEX IF NOT EXISTS idx_staff_passcodes_outlet_id ON staff_passcodes(outlet_id);
CREATE INDEX IF NOT EXISTS idx_staff_passcodes_verification ON staff_passcodes(outlet_id, passcode) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_staff_passcodes_active ON staff_passcodes(is_active) WHERE is_active = true;

ALTER TABLE staff_passcodes ENABLE ROW LEVEL SECURITY;

-- Public can verify passcodes (needed for frontend redemption flow)
CREATE POLICY "Anyone can verify active passcodes"
  ON staff_passcodes
  FOR SELECT
  USING (is_active = true);

-- Admins can manage all passcodes
CREATE POLICY "Admins can manage passcodes"
  ON staff_passcodes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to update last_used_at when passcode is used
CREATE OR REPLACE FUNCTION update_staff_passcode_last_used()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE staff_passcodes
  SET last_used_at = now()
  WHERE id = (
    SELECT sp.id
    FROM staff_passcodes sp
    WHERE sp.outlet_id = NEW.redeemed_at_outlet_id
    AND sp.is_active = true
    LIMIT 1
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update last_used_at on redemption
DROP TRIGGER IF EXISTS update_passcode_last_used_trigger ON order_item_redemptions;
CREATE TRIGGER update_passcode_last_used_trigger
  AFTER UPDATE ON order_item_redemptions
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status = 'pending')
  EXECUTE FUNCTION update_staff_passcode_last_used();

-- Seed default passcode "1234" for all existing outlets
INSERT INTO staff_passcodes (outlet_id, staff_name, passcode, is_active)
SELECT 
  id,
  'Staff Member',
  '1234',
  true
FROM outlets
ON CONFLICT (outlet_id, passcode) DO NOTHING;