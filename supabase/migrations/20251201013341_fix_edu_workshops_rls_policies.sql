/*
  # Fix edu_workshops RLS Policies

  ## Problem
  The RLS policies for edu_workshops are blocking admin insert/update/delete operations
  because they're checking `admin_users.id = auth.uid()` instead of `admin_users.auth_id = auth.uid()`.
  
  The `id` column is the primary key (UUID), while `auth_id` is the foreign key to auth.users.

  ## Solution
  Drop the incorrect policies and recreate them with the correct column reference.

  ## Changes
  1. Drop all existing admin/staff policies for edu_workshops
  2. Recreate policies with correct `auth_id` reference
  3. Keep public read-only policies unchanged
*/

-- Drop all existing admin/staff policies
DROP POLICY IF EXISTS "Admin users can insert edu workshops" ON edu_workshops;
DROP POLICY IF EXISTS "Admin users can update edu workshops" ON edu_workshops;
DROP POLICY IF EXISTS "Admin users can delete edu workshops" ON edu_workshops;
DROP POLICY IF EXISTS "Staff with permissions can insert edu workshops" ON edu_workshops;
DROP POLICY IF EXISTS "Staff with permissions can update edu workshops" ON edu_workshops;
DROP POLICY IF EXISTS "Staff with permissions can delete edu workshops" ON edu_workshops;
DROP POLICY IF EXISTS "Admins can manage edu workshops" ON edu_workshops;

-- Create corrected admin policies
CREATE POLICY "Admins can insert edu workshops"
  ON edu_workshops
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.auth_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

CREATE POLICY "Admins can update edu workshops"
  ON edu_workshops
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.auth_id = auth.uid()
      AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.auth_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

CREATE POLICY "Admins can delete edu workshops"
  ON edu_workshops
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.auth_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Create corrected staff policies
CREATE POLICY "Staff with permissions can insert edu workshops"
  ON edu_workshops
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_passcodes sp
      WHERE sp.auth_id = auth.uid()
      AND sp.is_active = true
      AND (
        sp.role IN ('outlet_manager', 'manager')
        OR (sp.assigned_permissions->>'eduworkshops')::boolean = true
        OR (sp.assigned_permissions->>'marketing')::boolean = true
      )
    )
  );

CREATE POLICY "Staff with permissions can update edu workshops"
  ON edu_workshops
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_passcodes sp
      WHERE sp.auth_id = auth.uid()
      AND sp.is_active = true
      AND (
        sp.role IN ('outlet_manager', 'manager')
        OR (sp.assigned_permissions->>'eduworkshops')::boolean = true
        OR (sp.assigned_permissions->>'marketing')::boolean = true
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_passcodes sp
      WHERE sp.auth_id = auth.uid()
      AND sp.is_active = true
      AND (
        sp.role IN ('outlet_manager', 'manager')
        OR (sp.assigned_permissions->>'eduworkshops')::boolean = true
        OR (sp.assigned_permissions->>'marketing')::boolean = true
      )
    )
  );

CREATE POLICY "Staff with permissions can delete edu workshops"
  ON edu_workshops
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_passcodes sp
      WHERE sp.auth_id = auth.uid()
      AND sp.is_active = true
      AND (
        sp.role IN ('outlet_manager', 'manager')
        OR (sp.assigned_permissions->>'eduworkshops')::boolean = true
        OR (sp.assigned_permissions->>'marketing')::boolean = true
      )
    )
  );