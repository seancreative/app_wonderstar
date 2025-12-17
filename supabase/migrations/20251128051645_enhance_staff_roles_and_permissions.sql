/*
  # Staff Role Management & Permission System

  ## Summary
  This migration enhances the staff management system with:
  - Role-based access control (Manager, Staff, Star Scanner)
  - Flexible permission system
  - Deprecates 4-digit passcode in favor of email/password authentication
  - Prepares system for granular permission management

  ## Changes

  1. Staff Roles
    - Add `role` column to staff_passcodes table
    - Valid roles: 'manager', 'staff', 'star_scanner'
    - Default role is 'staff' for existing records

  2. Permissions
    - Add `assigned_permissions` JSONB column for custom permissions
    - Store resource-action mappings

  3. Passcode Deprecation
    - Make `passcode` column nullable (backward compatibility)
    - Will be phased out in future migration

  4. Data Migration
    - Set default role for all existing staff
    - Assign default permissions based on role

  5. Indexes
    - Add index on role for filtering
    - Add index on auth_id for session lookups
*/

-- Step 1: Add role column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_passcodes' AND column_name = 'role'
  ) THEN
    ALTER TABLE staff_passcodes ADD COLUMN role text NOT NULL DEFAULT 'staff';

    -- Add check constraint for valid roles
    ALTER TABLE staff_passcodes ADD CONSTRAINT staff_passcodes_role_check
      CHECK (role IN ('manager', 'staff', 'star_scanner'));
  END IF;
END $$;

-- Step 2: Add assigned_permissions column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_passcodes' AND column_name = 'assigned_permissions'
  ) THEN
    ALTER TABLE staff_passcodes ADD COLUMN assigned_permissions jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Step 3: Make passcode nullable (deprecation)
DO $$
BEGIN
  -- Check if passcode column exists and is NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_passcodes'
      AND column_name = 'passcode'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE staff_passcodes ALTER COLUMN passcode DROP NOT NULL;
    COMMENT ON COLUMN staff_passcodes.passcode IS 'DEPRECATED: Use email/password authentication instead. Kept for backward compatibility only.';
  END IF;
END $$;

-- Step 4: Ensure password_hash and auth_id columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_passcodes' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE staff_passcodes ADD COLUMN password_hash text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_passcodes' AND column_name = 'auth_id'
  ) THEN
    ALTER TABLE staff_passcodes ADD COLUMN auth_id uuid UNIQUE;
  END IF;
END $$;

-- Step 5: Data Migration - Set default role for existing staff
UPDATE staff_passcodes
SET role = 'staff'
WHERE role IS NULL OR role = '';

-- Step 6: Assign default permissions based on role
UPDATE staff_passcodes
SET assigned_permissions = jsonb_build_object(
  'orders', jsonb_build_array('read', 'update'),
  'redemptions', jsonb_build_array('read', 'update', 'redeem'),
  'star_scanner', jsonb_build_array('use'),
  'profile', jsonb_build_array('read', 'update')
)
WHERE role = 'staff' AND assigned_permissions = '{}'::jsonb;

UPDATE staff_passcodes
SET assigned_permissions = jsonb_build_object(
  'dashboard', jsonb_build_array('read'),
  'products', jsonb_build_array('read', 'create', 'update'),
  'orders', jsonb_build_array('read', 'update'),
  'redemptions', jsonb_build_array('read', 'update', 'redeem'),
  'star_scanner', jsonb_build_array('use'),
  'reports', jsonb_build_array('read'),
  'staff', jsonb_build_array('read', 'create', 'update'),
  'settings', jsonb_build_array('read', 'update'),
  'profile', jsonb_build_array('read', 'update')
)
WHERE role = 'manager' AND assigned_permissions = '{}'::jsonb;

UPDATE staff_passcodes
SET assigned_permissions = jsonb_build_object(
  'star_scanner', jsonb_build_array('use'),
  'profile', jsonb_build_array('read', 'update')
)
WHERE role = 'star_scanner' AND assigned_permissions = '{}'::jsonb;

-- Step 7: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_passcodes_role ON staff_passcodes(role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_staff_passcodes_auth_id ON staff_passcodes(auth_id) WHERE auth_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_passcodes_email ON staff_passcodes(email) WHERE is_active = true;

-- Step 8: Update RLS policies for role-based access
-- Drop old policies if they exist
DROP POLICY IF EXISTS "Staff can view own data" ON staff_passcodes;
DROP POLICY IF EXISTS "Managers can view outlet staff" ON staff_passcodes;

-- Staff can view their own data
CREATE POLICY "Staff can view own data"
  ON staff_passcodes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_id);

-- Managers can view staff in their outlet
CREATE POLICY "Managers can view outlet staff"
  ON staff_passcodes
  FOR SELECT
  TO authenticated
  USING (
    role = 'manager' AND
    outlet_id IN (
      SELECT outlet_id
      FROM staff_passcodes
      WHERE auth_id = auth.uid()
        AND role IN ('manager', 'staff')
        AND is_active = true
    )
  );

-- Super admins (from admin_users) can view all staff
CREATE POLICY "Admins can view all staff"
  ON staff_passcodes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE auth_id = auth.uid()
        AND is_active = true
    )
  );

-- Admins can manage all staff
CREATE POLICY "Admins can manage all staff"
  ON staff_passcodes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE auth_id = auth.uid()
        AND is_active = true
    )
  );

-- Managers can create/update staff in their outlet
CREATE POLICY "Managers can manage outlet staff"
  ON staff_passcodes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_passcodes sp
      WHERE sp.auth_id = auth.uid()
        AND sp.role = 'manager'
        AND sp.outlet_id = staff_passcodes.outlet_id
        AND sp.is_active = true
    )
  );

CREATE POLICY "Managers can update outlet staff"
  ON staff_passcodes
  FOR UPDATE
  TO authenticated
  USING (
    outlet_id IN (
      SELECT outlet_id
      FROM staff_passcodes
      WHERE auth_id = auth.uid()
        AND role = 'manager'
        AND is_active = true
    )
  );

-- Staff can update their own profile
CREATE POLICY "Staff can update own profile"
  ON staff_passcodes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_id)
  WITH CHECK (
    auth.uid() = auth_id AND
    -- Prevent staff from changing their own role or outlet
    role = (SELECT role FROM staff_passcodes WHERE id = staff_passcodes.id) AND
    outlet_id = (SELECT outlet_id FROM staff_passcodes WHERE id = staff_passcodes.id)
  );

-- Step 9: Add helpful comments
COMMENT ON COLUMN staff_passcodes.role IS 'Staff role: manager (full section access), staff (orders/redemptions), star_scanner (scanner only)';
COMMENT ON COLUMN staff_passcodes.assigned_permissions IS 'Custom permissions in format: {"resource": ["action1", "action2"]}. Overrides default role permissions.';
COMMENT ON COLUMN staff_passcodes.password_hash IS 'Bcrypt hashed password for email/password authentication';
COMMENT ON COLUMN staff_passcodes.auth_id IS 'Supabase Auth UUID for session management and RLS policies';

-- Step 10: Create helper function to get staff permissions
CREATE OR REPLACE FUNCTION get_staff_default_permissions(staff_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN CASE staff_role
    WHEN 'manager' THEN jsonb_build_object(
      'dashboard', jsonb_build_array('read'),
      'products', jsonb_build_array('read', 'create', 'update'),
      'orders', jsonb_build_array('read', 'update'),
      'redemptions', jsonb_build_array('read', 'update', 'redeem'),
      'star_scanner', jsonb_build_array('use'),
      'reports', jsonb_build_array('read'),
      'staff', jsonb_build_array('read', 'create', 'update'),
      'settings', jsonb_build_array('read', 'update'),
      'profile', jsonb_build_array('read', 'update')
    )
    WHEN 'staff' THEN jsonb_build_object(
      'orders', jsonb_build_array('read', 'update'),
      'redemptions', jsonb_build_array('read', 'update', 'redeem'),
      'star_scanner', jsonb_build_array('use'),
      'profile', jsonb_build_array('read', 'update')
    )
    WHEN 'star_scanner' THEN jsonb_build_object(
      'star_scanner', jsonb_build_array('use'),
      'profile', jsonb_build_array('read', 'update')
    )
    ELSE '{}'::jsonb
  END;
END;
$$;

COMMENT ON FUNCTION get_staff_default_permissions IS 'Returns default permissions for a given staff role';