/*
  # Fix Stars Transactions RLS - Final Comprehensive Fix

  ## Problem
  Stars add/deduct functionality not working due to:
  1. balance_after column removed in migration 20251211121208 but code still references it (FIXED in code)
  2. RLS policies may be blocking INSERT operations
  3. Auth ID mapping may not be working correctly

  ## Solution
  1. Ensure stars_transactions table has proper RLS policies
  2. Allow authenticated users to INSERT their own transactions
  3. Allow anon users for system operations (payment callbacks, CMS)
  4. Properly map auth.uid() to users.auth_id to users.id

  ## Changes
  1. Drop all existing policies on stars_transactions
  2. Recreate clean, working policies for SELECT and INSERT
  3. Ensure transaction_type validation includes all needed types
  4. Add UPDATE policy for system operations
*/

-- =====================================================
-- STEP 1: Drop all existing policies
-- =====================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'stars_transactions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON stars_transactions', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- =====================================================
-- STEP 2: Create SELECT policies
-- =====================================================

-- Authenticated users can view their own transactions
CREATE POLICY "Users can view own stars transactions"
  ON stars_transactions
  FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Anon users can view all (for CMS, payment callbacks, staff scanner)
CREATE POLICY "Anon can view stars transactions"
  ON stars_transactions
  FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- STEP 3: Create INSERT policies
-- =====================================================

-- Authenticated users can insert their own transactions
CREATE POLICY "Users can create own stars transactions"
  ON stars_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    AND transaction_type IN ('earn', 'spend', 'bonus', 'adjustment', 'refund')
    AND multiplier >= 0.1 AND multiplier <= 10.0
  );

-- Anon users can insert (for payment callbacks, system operations)
CREATE POLICY "System can create stars transactions"
  ON stars_transactions
  FOR INSERT
  TO anon
  WITH CHECK (
    transaction_type IN ('earn', 'spend', 'bonus', 'adjustment', 'refund')
    AND multiplier >= 0.1 AND multiplier <= 10.0
  );

-- =====================================================
-- STEP 4: Create UPDATE policy (for system operations)
-- =====================================================

-- Allow updates for system operations (rarely needed)
CREATE POLICY "System can update stars transactions"
  ON stars_transactions
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- STEP 5: Verify column structure
-- =====================================================

DO $$
DECLARE
  has_balance_after boolean;
BEGIN
  -- Check if balance_after column exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'stars_transactions'
    AND column_name = 'balance_after'
  ) INTO has_balance_after;

  IF has_balance_after THEN
    RAISE WARNING 'balance_after column still exists! Migration 20251211121208 may not have run.';
  ELSE
    RAISE NOTICE '✓ balance_after column correctly removed';
  END IF;
END $$;

-- =====================================================
-- STEP 6: Verification
-- =====================================================

DO $$
DECLARE
  policy_count integer;
  rls_enabled boolean;
BEGIN
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'stars_transactions';

  -- Check RLS status
  SELECT rowsecurity INTO rls_enabled
  FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename = 'stars_transactions';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'STARS TRANSACTIONS RLS FIX COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS Enabled: %', rls_enabled;
  RAISE NOTICE 'Policies Count: %', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Policies Created:';
  RAISE NOTICE '  ✓ Users can view own stars transactions';
  RAISE NOTICE '  ✓ Anon can view stars transactions';
  RAISE NOTICE '  ✓ Users can create own stars transactions';
  RAISE NOTICE '  ✓ System can create stars transactions';
  RAISE NOTICE '  ✓ System can update stars transactions';
  RAISE NOTICE '';
  RAISE NOTICE 'Stars functionality should now work:';
  RAISE NOTICE '  • Earning stars (check-ins, purchases)';
  RAISE NOTICE '  • Spending stars (redemptions, gacha)';
  RAISE NOTICE '  • Payment callbacks';
  RAISE NOTICE '  • CMS staff operations';
  RAISE NOTICE '========================================';
END $$;
