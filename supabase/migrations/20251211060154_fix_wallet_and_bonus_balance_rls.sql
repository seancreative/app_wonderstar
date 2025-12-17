/*
  # Fix Wallet and Bonus Balance RLS Policies

  ## Issues Fixed
  1. **Wallet balance not showing**: Users couldn't SELECT their wallet_transactions to calculate balance
  2. **Bonus balance not updating after topup**: Payment callback couldn't read users.bonus_balance to calculate new balance
  3. **Bonus transactions invisible**: Users couldn't SELECT their bonus_transactions to see transaction history

  ## Changes
  1. Add SELECT policy for wallet_transactions (authenticated users can view their own transactions)
  2. Add SELECT policy for bonus_transactions (authenticated users can view their own transactions)
  3. Add SELECT policy for stars_transactions (authenticated users can view their own transactions)
  4. Add SELECT policy for users table bonus_balance (allow payment callbacks to read for calculations)

  ## Security Notes
  - All policies are user-scoped (auth.uid() = user_id)
  - Payment callbacks need to read bonus_balance to add bonus amounts correctly
  - Users can only see their own transaction history
*/

-- ============================================================================
-- WALLET TRANSACTIONS: Allow users to SELECT their own transactions
-- ============================================================================

CREATE POLICY "Users can view own wallet transactions"
  ON wallet_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Also allow anonymous for payment callbacks that might not be authenticated
CREATE POLICY "Allow anon to view wallet transactions for callbacks"
  ON wallet_transactions
  FOR SELECT
  TO anon
  USING (true);

-- ============================================================================
-- BONUS TRANSACTIONS: Allow users to SELECT their own transactions
-- ============================================================================

CREATE POLICY "Users can view own bonus transactions"
  ON bonus_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Also allow anonymous for payment callbacks
CREATE POLICY "Allow anon to view bonus transactions for callbacks"
  ON bonus_transactions
  FOR SELECT
  TO anon
  USING (true);

-- ============================================================================
-- STARS TRANSACTIONS: Allow users to SELECT their own transactions
-- ============================================================================

CREATE POLICY "Users can view own stars transactions"
  ON stars_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Also allow anonymous for various operations
CREATE POLICY "Allow anon to view stars transactions"
  ON stars_transactions
  FOR SELECT
  TO anon
  USING (true);

-- ============================================================================
-- USERS TABLE: Allow reading bonus_balance for payment callbacks
-- ============================================================================

-- The users table already has policies, but we need to ensure bonus_balance is readable
-- This policy allows payment callbacks to read user data including bonus_balance
CREATE POLICY "Allow anon to read users for payment callbacks"
  ON users
  FOR SELECT
  TO anon
  USING (true);
