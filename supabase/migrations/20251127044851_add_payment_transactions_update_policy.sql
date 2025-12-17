/*
  # Add UPDATE Policy for payment_transactions

  ## Overview
  Allow authenticated users to update their own payment transactions
  when payment callback completes.

  ## Problem
  PaymentCallback.tsx needs to update payment_transactions status from
  'pending' to 'completed' after successful payment, but no UPDATE policy
  exists for users.

  Current policies:
  - SELECT: Users can view own transactions
  - INSERT: Users can create own transactions
  - ALL: Service role has full access

  Missing: UPDATE policy for users to update their own transactions

  ## Solution
  Add UPDATE policy that allows users to update their own payment transaction
  status and metadata when payment completes.

  ## Security
  - Users can only UPDATE their own transactions (user_id matches)
  - Prevents users from modifying other users' payment records
  - Service role retains full access
*/

-- =====================================================
-- ADD UPDATE POLICY FOR PAYMENT TRANSACTIONS
-- =====================================================

CREATE POLICY "Users update own payment transactions"
  ON payment_transactions FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ADDED: payment_transactions UPDATE policy';
  RAISE NOTICE 'Users can now update their own payment status';
  RAISE NOTICE 'Status: Payment callback can mark as completed';
  RAISE NOTICE '========================================';
END $$;
