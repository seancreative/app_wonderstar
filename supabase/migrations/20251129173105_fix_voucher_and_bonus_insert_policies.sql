/*
  # Fix Voucher Redemptions and Bonus Transactions INSERT Policies

  ## Problem
  Users cannot checkout with W Balance because:
  - voucher_redemptions table missing INSERT policy for users
  - bonus_transactions table missing INSERT policy for users

  ## Solution
  Add INSERT policies that allow:
  1. Users to create their own voucher redemptions
  2. Users to create their own bonus transactions
  
  ## Security
  - Users can only insert records for themselves (user_id check)
  - All other security checks remain in place
*/

-- =====================================================
-- VOUCHER REDEMPTIONS - ADD INSERT POLICY
-- =====================================================

CREATE POLICY "Users can create own voucher redemptions"
  ON voucher_redemptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- =====================================================
-- BONUS TRANSACTIONS - ADD INSERT POLICY
-- =====================================================

-- First check if the policy already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'bonus_transactions' 
    AND policyname = 'Users can create own bonus transactions'
  ) THEN
    CREATE POLICY "Users can create own bonus transactions"
      ON bonus_transactions
      FOR INSERT
      TO authenticated
      WITH CHECK (
        user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
      );
  END IF;
END $$;

COMMENT ON POLICY "Users can create own voucher redemptions" ON voucher_redemptions IS 
  'Allows users to record their own voucher redemptions when checking out';

COMMENT ON POLICY "Users can create own bonus transactions" ON bonus_transactions IS 
  'Allows users to record bonus balance usage when checking out';
