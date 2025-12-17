/*
  # Add Granular Manager Permissions System

  1. Overview
    - Enhance the existing assigned_permissions JSONB column
    - Add specific permission flags for each CMS section
    - Set default permissions for existing staff members
    
  2. Permissions Structure
    - Dashboard: View dashboard analytics
    - Orders: Manage orders and transactions
    - Products: Manage products and categories
    - Customers: View and manage customer data
    - Redemptions: Handle voucher/reward redemptions
    - Rewards: Manage rewards catalog
    - Marketing: Manage promotions and vouchers
    - Analytics: View detailed analytics
    - Finance: Access financial reports
    - Settings: Manage outlet and system settings

  3. Default Permissions
    - Admin: All permissions enabled
    - Manager: All permissions enabled by default (can be customized)
    - Staff: Limited to Orders, Redemptions only
    - Star Scanner: No CMS access (scanner only)

  4. Security
    - Permissions checked at application level via StaffAuthContext
    - RLS policies remain unchanged (table-level access)
    - UI components will hide/show based on permissions
*/

-- ============================================
-- Step 1: Set Default Permissions for Existing Staff
-- ============================================

-- Update admin users with full permissions
UPDATE staff_passcodes
SET assigned_permissions = jsonb_build_object(
  'dashboard', true,
  'orders', true,
  'products', true,
  'customers', true,
  'redemptions', true,
  'rewards', true,
  'marketing', true,
  'analytics', true,
  'finance', true,
  'settings', true
)
WHERE role = 'admin' AND assigned_permissions IS NULL;

-- Update managers with full permissions (can be customized later)
UPDATE staff_passcodes
SET assigned_permissions = jsonb_build_object(
  'dashboard', true,
  'orders', true,
  'products', true,
  'customers', true,
  'redemptions', true,
  'rewards', true,
  'marketing', true,
  'analytics', true,
  'finance', true,
  'settings', true
)
WHERE role = 'manager' AND assigned_permissions IS NULL;

-- Update staff with limited permissions
UPDATE staff_passcodes
SET assigned_permissions = jsonb_build_object(
  'dashboard', false,
  'orders', true,
  'products', false,
  'customers', false,
  'redemptions', true,
  'rewards', false,
  'marketing', false,
  'analytics', false,
  'finance', false,
  'settings', false
)
WHERE role = 'staff' AND assigned_permissions IS NULL;

-- Update star scanners with no CMS access
UPDATE staff_passcodes
SET assigned_permissions = jsonb_build_object(
  'dashboard', false,
  'orders', false,
  'products', false,
  'customers', false,
  'redemptions', false,
  'rewards', false,
  'marketing', false,
  'analytics', false,
  'finance', false,
  'settings', false
)
WHERE role = 'star_scanner' AND assigned_permissions IS NULL;

-- ============================================
-- Step 2: Create Helper Function to Check Permissions
-- ============================================

CREATE OR REPLACE FUNCTION check_staff_permission(
  staff_auth_id uuid,
  permission_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  has_permission boolean;
  staff_role text;
BEGIN
  -- Get staff role and check permission
  SELECT 
    role,
    COALESCE(
      (assigned_permissions ->> permission_key)::boolean,
      false
    )
  INTO staff_role, has_permission
  FROM staff_passcodes
  WHERE auth_id = staff_auth_id
    AND is_active = true;

  -- Admin always has all permissions
  IF staff_role = 'admin' THEN
    RETURN true;
  END IF;

  -- Return the assigned permission
  RETURN COALESCE(has_permission, false);
END;
$$;

GRANT EXECUTE ON FUNCTION check_staff_permission(uuid, text) TO authenticated;

COMMENT ON FUNCTION check_staff_permission(uuid, text) IS 
  'Checks if a staff member has a specific permission. Admins always return true.';

-- ============================================
-- Step 3: Create Function to Get All Permissions
-- ============================================

CREATE OR REPLACE FUNCTION get_staff_permissions(staff_auth_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN role = 'admin' THEN 
        jsonb_build_object(
          'dashboard', true,
          'orders', true,
          'products', true,
          'customers', true,
          'redemptions', true,
          'rewards', true,
          'marketing', true,
          'analytics', true,
          'finance', true,
          'settings', true
        )
      ELSE COALESCE(
        assigned_permissions,
        jsonb_build_object(
          'dashboard', false,
          'orders', false,
          'products', false,
          'customers', false,
          'redemptions', false,
          'rewards', false,
          'marketing', false,
          'analytics', false,
          'finance', false,
          'settings', false
        )
      )
    END
  FROM staff_passcodes
  WHERE auth_id = staff_auth_id
    AND is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_staff_permissions(uuid) TO authenticated;

COMMENT ON FUNCTION get_staff_permissions(uuid) IS 
  'Returns all permissions for a staff member. Admins get all permissions automatically.';

-- ============================================
-- Step 4: Add Index for Better Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_staff_passcodes_assigned_permissions 
ON staff_passcodes USING gin(assigned_permissions);

-- ============================================
-- Step 5: Add Validation Trigger
-- ============================================

CREATE OR REPLACE FUNCTION validate_staff_permissions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Ensure assigned_permissions has all required keys for managers
  IF NEW.role = 'manager' AND NEW.assigned_permissions IS NOT NULL THEN
    -- Fill in any missing keys with false
    NEW.assigned_permissions = NEW.assigned_permissions || jsonb_build_object(
      'dashboard', COALESCE((NEW.assigned_permissions->>'dashboard')::boolean, false),
      'orders', COALESCE((NEW.assigned_permissions->>'orders')::boolean, false),
      'products', COALESCE((NEW.assigned_permissions->>'products')::boolean, false),
      'customers', COALESCE((NEW.assigned_permissions->>'customers')::boolean, false),
      'redemptions', COALESCE((NEW.assigned_permissions->>'redemptions')::boolean, false),
      'rewards', COALESCE((NEW.assigned_permissions->>'rewards')::boolean, false),
      'marketing', COALESCE((NEW.assigned_permissions->>'marketing')::boolean, false),
      'analytics', COALESCE((NEW.assigned_permissions->>'analytics')::boolean, false),
      'finance', COALESCE((NEW.assigned_permissions->>'finance')::boolean, false),
      'settings', COALESCE((NEW.assigned_permissions->>'settings')::boolean, false)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_valid_staff_permissions ON staff_passcodes;
CREATE TRIGGER ensure_valid_staff_permissions
  BEFORE INSERT OR UPDATE ON staff_passcodes
  FOR EACH ROW
  EXECUTE FUNCTION validate_staff_permissions();
