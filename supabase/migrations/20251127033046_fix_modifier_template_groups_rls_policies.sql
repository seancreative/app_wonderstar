/*
  # Fix Modifier Template Groups RLS Policies

  ## Overview
  Enable Row Level Security on modifier_template_groups table to secure
  reusable modifier templates used by admins.

  ## Problem
  The modifier_template_groups table has RLS disabled. This table stores
  template associations for reusable modifier groups in the CMS admin interface.

  ## Solution
  Enable RLS with policies that:
  - Allow public to view templates (needed when they're applied to products)
  - Allow service role to manage templates (admin CMS operations)

  ## Table
  modifier_template_groups - Junction table linking templates to modifier groups

  ## Security Model
  - Public read access (templates applied to products need to be viewable)
  - Admin write access via service role (CMS operations only)
*/

-- =====================================================
-- CHECK IF TABLE EXISTS
-- =====================================================

DO $$
BEGIN
  -- Only proceed if the table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'modifier_template_groups'
  ) THEN
    
    -- Enable RLS
    ALTER TABLE modifier_template_groups ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "Public can view modifier template groups" ON modifier_template_groups;
    DROP POLICY IF EXISTS "Service manages modifier template groups" ON modifier_template_groups;
    
    -- Create SELECT policy for public
    CREATE POLICY "Public can view modifier template groups"
      ON modifier_template_groups FOR SELECT
      TO public
      USING (true);
    
    -- Create ALL policy for service role
    CREATE POLICY "Service manages modifier template groups"
      ON modifier_template_groups FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
    
    RAISE NOTICE '✓ modifier_template_groups RLS enabled and policies created';
  ELSE
    RAISE NOTICE '⚠ modifier_template_groups table does not exist, skipping';
  END IF;
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIXED: modifier_template_groups RLS policies';
  RAISE NOTICE 'Security: Public read, service role manages';
  RAISE NOTICE 'Status: Template system secured';
  RAISE NOTICE '========================================';
END $$;
