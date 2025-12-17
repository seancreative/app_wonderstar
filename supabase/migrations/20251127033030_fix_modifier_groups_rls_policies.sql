/*
  # Fix Modifier Groups RLS Policies

  ## Overview
  Enable Row Level Security on modifier-related tables to ensure proper access control
  while maintaining functionality for both customers and admins.

  ## Problem
  Tables modifier_groups, modifier_options, and product_modifiers have RLS disabled,
  creating potential security issues. These tables contain product customization data
  that customers need to view and admins need to manage.

  ## Solution
  Enable RLS with appropriate policies:
  - Public (anon + authenticated) can SELECT (view modifiers on products)
  - Service role can manage all (for admin CMS operations)

  ## Tables Updated
  1. modifier_groups - Modifier group definitions
  2. modifier_options - Individual options within groups
  3. product_modifiers - Junction table linking products to modifiers

  ## Security Model
  - Public read access (customers need to see customization options)
  - Admin write access via service role (CMS operations)
  - No direct user INSERT/UPDATE/DELETE (only through admin interface)
*/

-- =====================================================
-- ENABLE RLS ON ALL MODIFIER TABLES
-- =====================================================

ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_modifiers ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- DROP EXISTING POLICIES (IF ANY)
-- =====================================================

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('modifier_groups', 'modifier_options', 'product_modifiers')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

-- =====================================================
-- MODIFIER_GROUPS POLICIES
-- =====================================================

-- Allow public to view modifier groups (needed for product customization)
CREATE POLICY "Public can view modifier groups"
  ON modifier_groups FOR SELECT
  TO public
  USING (true);

-- Allow service role to manage all modifier groups (admin CMS)
CREATE POLICY "Service manages modifier groups"
  ON modifier_groups FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- MODIFIER_OPTIONS POLICIES
-- =====================================================

-- Allow public to view modifier options
CREATE POLICY "Public can view modifier options"
  ON modifier_options FOR SELECT
  TO public
  USING (true);

-- Allow service role to manage all modifier options
CREATE POLICY "Service manages modifier options"
  ON modifier_options FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- PRODUCT_MODIFIERS POLICIES
-- =====================================================

-- Allow public to view product-modifier associations
CREATE POLICY "Public can view product modifiers"
  ON product_modifiers FOR SELECT
  TO public
  USING (true);

-- Allow service role to manage all product-modifier associations
CREATE POLICY "Service manages product modifiers"
  ON product_modifiers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIXED: Modifier system RLS policies';
  RAISE NOTICE 'Tables: modifier_groups, modifier_options, product_modifiers';
  RAISE NOTICE 'Security: Public read, service role manages';
  RAISE NOTICE 'Status: Product customization secured';
  RAISE NOTICE '========================================';
END $$;
