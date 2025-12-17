/*
  # EMERGENCY ROLLBACK - Disable All RLS

  ## Purpose
  This script can be used to immediately disable RLS on all tables
  if issues occur during or after the RLS migration.

  ## Usage
  Only run this if you need to rollback the RLS implementation.
  You can apply it manually or use mcp__supabase__apply_migration

  ## Safety
  This script preserves all data and only affects security policies.
  All table structures, triggers, and functions remain intact.
*/

-- =====================================================
-- DISABLE RLS ON ALL TABLES
-- =====================================================

DO $$
DECLARE
  table_record RECORD;
BEGIN
  RAISE NOTICE 'EMERGENCY ROLLBACK: Disabling RLS on all tables...';

  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', table_record.tablename);
    RAISE NOTICE 'Disabled RLS on table: %', table_record.tablename;
  END LOOP;

  RAISE NOTICE 'RLS disabled on all tables.';
END $$;

-- =====================================================
-- DROP ALL RLS POLICIES
-- =====================================================

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  RAISE NOTICE 'Dropping all RLS policies...';

  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
    RAISE NOTICE 'Dropped policy: % on %', policy_record.policyname, policy_record.tablename;
  END LOOP;

  RAISE NOTICE 'All RLS policies dropped.';
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'EMERGENCY ROLLBACK COMPLETE';
  RAISE NOTICE 'All RLS has been disabled';
  RAISE NOTICE 'All policies have been dropped';
  RAISE NOTICE 'Database is now in open access mode';
  RAISE NOTICE '========================================';
END $$;
