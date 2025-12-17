/*
  # Enable RLS - Group D: Admin Tables (v2)

  ## Overview
  This migration enables Row Level Security on admin and staff tables.
  Fixed to use correct column names.

  ## Tables Covered
  - admin_users
  - admin_permissions
  - staff_passcodes
  - admin_activity_logs
  - staff_redemption_logs
  - staff_scan_logs (if exists)

  ## Security Model
  - Only users with admin_users.auth_id can access
  - Staff can access their own records
  - Activity logs readable by admins only
  - Service role has full access for system operations
*/

-- =====================================================
-- DROP EXISTING POLICIES FIRST
-- =====================================================

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'admin_users', 'admin_permissions', 'staff_passcodes',
        'admin_activity_logs', 'staff_redemption_logs', 'staff_scan_logs'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

-- =====================================================
-- ADMIN USERS
-- =====================================================
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all admin users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE auth_id = auth.uid()
        AND is_active = true
    )
  );

CREATE POLICY "Admins can update admin users"
  ON admin_users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE auth_id = auth.uid()
        AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE auth_id = auth.uid()
        AND is_active = true
    )
  );

CREATE POLICY "Service can manage admin users"
  ON admin_users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- ADMIN PERMISSIONS
-- =====================================================
ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all permissions"
  ON admin_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE auth_id = auth.uid()
        AND is_active = true
    )
  );

CREATE POLICY "Service can manage permissions"
  ON admin_permissions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- STAFF PASSCODES
-- =====================================================
ALTER TABLE staff_passcodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view own passcode"
  ON staff_passcodes FOR SELECT
  TO authenticated
  USING (
    auth_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE auth_id = auth.uid()
        AND is_active = true
    )
  );

CREATE POLICY "Admins manage staff passcodes"
  ON staff_passcodes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE auth_id = auth.uid()
        AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE auth_id = auth.uid()
        AND is_active = true
    )
  );

CREATE POLICY "Service can manage staff passcodes"
  ON staff_passcodes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- ADMIN ACTIVITY LOGS
-- =====================================================
ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view activity logs"
  ON admin_activity_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE auth_id = auth.uid()
        AND is_active = true
    )
  );

CREATE POLICY "Service can manage activity logs"
  ON admin_activity_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- STAFF REDEMPTION LOGS
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_redemption_logs') THEN
    ALTER TABLE staff_redemption_logs ENABLE ROW LEVEL SECURITY;

    EXECUTE 'CREATE POLICY "Staff view own redemption logs"
      ON staff_redemption_logs FOR SELECT
      TO authenticated
      USING (
        staff_passcode_id = (SELECT id FROM staff_passcodes WHERE auth_id = auth.uid()) OR
        EXISTS (
          SELECT 1 FROM admin_users
          WHERE auth_id = auth.uid()
            AND is_active = true
        )
      )';

    EXECUTE 'CREATE POLICY "Service can manage redemption logs"
      ON staff_redemption_logs FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- =====================================================
-- STAFF SCAN LOGS
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_scan_logs') THEN
    ALTER TABLE staff_scan_logs ENABLE ROW LEVEL SECURITY;

    EXECUTE 'CREATE POLICY "Staff view own scan logs"
      ON staff_scan_logs FOR SELECT
      TO authenticated
      USING (
        staff_passcode_id = (SELECT id FROM staff_passcodes WHERE auth_id = auth.uid()) OR
        EXISTS (
          SELECT 1 FROM admin_users
          WHERE auth_id = auth.uid()
            AND is_active = true
        )
      )';

    EXECUTE 'CREATE POLICY "Service can manage scan logs"
      ON staff_scan_logs FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS ENABLED - GROUP D (ADMIN TABLES)';
  RAISE NOTICE 'Security: Admin/Staff only access';
  RAISE NOTICE '========================================';
END $$;
