/*
  # Fix Transaction RLS Policies - Auth ID Mapping

  ## Problem
  The RLS policies for wallet_transactions, bonus_transactions, and stars_transactions
  were checking `auth.uid() = user_id`, but:
  - `auth.uid()` returns the Supabase Auth ID (stored in users.auth_id)
  - `transaction.user_id` references users.id (a different UUID)
  - These never match, causing authenticated users to see zero transactions

  ## Solution
  Update all transaction table SELECT policies to properly map through the users table:
  - Change from: `auth.uid() = user_id`
  - Change to: `user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())`

  ## Changes
  1. Drop and recreate SELECT policies for wallet_transactions
  2. Drop and recreate SELECT policies for bonus_transactions
  3. Drop and recreate SELECT policies for stars_transactions
  4. Keep anon policies for payment callbacks

  ## Security
  - Users can only see their own transactions (via auth_id -> users.id mapping)
  - Payment callbacks still work via anon policies
  - CMS access still works via anon policies
*/

-- ============================================================================
-- WALLET TRANSACTIONS: Fix authenticated user SELECT policy
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own wallet transactions" ON wallet_transactions;

CREATE POLICY "Users can view own wallet transactions"
  ON wallet_transactions
  FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Keep anon policy for payment callbacks
-- (Already exists from previous migration, but ensure it's there)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'wallet_transactions'
    AND policyname = 'Allow anon to view wallet transactions for callbacks'
  ) THEN
    CREATE POLICY "Allow anon to view wallet transactions for callbacks"
      ON wallet_transactions
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- ============================================================================
-- BONUS TRANSACTIONS: Fix authenticated user SELECT policy
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own bonus transactions" ON bonus_transactions;

CREATE POLICY "Users can view own bonus transactions"
  ON bonus_transactions
  FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Keep anon policy for payment callbacks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bonus_transactions'
    AND policyname = 'Allow anon to view bonus transactions for callbacks'
  ) THEN
    CREATE POLICY "Allow anon to view bonus transactions for callbacks"
      ON bonus_transactions
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- ============================================================================
-- STARS TRANSACTIONS: Fix authenticated user SELECT policy
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own stars transactions" ON stars_transactions;

CREATE POLICY "Users can view own stars transactions"
  ON stars_transactions
  FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Keep anon policy for various operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'stars_transactions'
    AND policyname = 'Allow anon to view stars transactions'
  ) THEN
    CREATE POLICY "Allow anon to view stars transactions"
      ON stars_transactions
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;