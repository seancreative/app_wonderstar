/*
  # Drop All Remaining RLS Policies
  
  This migration drops all remaining RLS policies from all tables.
  Since RLS is already disabled on all tables, these policies won't be enforced,
  but dropping them ensures a completely clean state.
*/

-- =====================================================
-- DROP ALL POLICIES DYNAMICALLY
-- =====================================================

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN 
    SELECT schemaname, tablename, policyname
    FROM pg_policies 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
      policy_record.policyname, 
      policy_record.schemaname, 
      policy_record.tablename);
    RAISE NOTICE 'Dropped policy % on table %', policy_record.policyname, policy_record.tablename;
  END LOOP;
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  remaining_policies INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_policies
  FROM pg_policies 
  WHERE schemaname = 'public';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'All RLS policies have been dropped';
  RAISE NOTICE 'Remaining policies in public schema: %', remaining_policies;
  RAISE NOTICE '========================================';
END $$;
