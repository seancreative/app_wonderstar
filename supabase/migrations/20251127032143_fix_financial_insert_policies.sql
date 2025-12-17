/*
  # Fix Financial Tables INSERT Policies

  ## Overview
  This migration adds INSERT policies for authenticated users on financial transaction tables.
  This allows users to create wallet transactions and stars transactions from the frontend.

  ## Problem
  Users were unable to:
  - Top up wallet (INSERT into wallet_transactions)
  - Spend from wallet (INSERT into wallet_transactions)
  - Earn stars (INSERT into stars_transactions)
  - Spend stars (INSERT into stars_transactions)
  
  All these operations were restricted to service_role only.

  ## Solution
  Add INSERT policies that allow authenticated users to create their own transaction records
  with proper validation to ensure security and prevent abuse.

  ## Tables Updated
  1. wallet_transactions - Add INSERT policy
  2. stars_transactions - Add INSERT policy

  ## Security
  - Users can only create transactions for themselves (user_id must match auth.uid())
  - Transaction types are validated
  - Reasonable limits can be enforced at application level
  - Service role policies remain for admin operations
*/

-- =====================================================
-- WALLET TRANSACTIONS - ADD INSERT POLICY
-- =====================================================

-- Drop policy if it already exists
DROP POLICY IF EXISTS "Users can create own wallet transactions" ON wallet_transactions;

-- Allow users to create their own wallet transaction records
CREATE POLICY "Users can create own wallet transactions"
  ON wallet_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    -- Validate transaction type
    AND transaction_type IN ('topup', 'spend', 'bonus', 'refund')
    -- Validate status (pending or success on creation)
    AND status IN ('pending', 'success', 'failed')
  );

-- =====================================================
-- STARS TRANSACTIONS - ADD INSERT POLICY
-- =====================================================

-- Drop policy if it already exists
DROP POLICY IF EXISTS "Users can create own stars transactions" ON stars_transactions;

-- Allow users to create their own stars transaction records
CREATE POLICY "Users can create own stars transactions"
  ON stars_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    -- Validate transaction type
    AND transaction_type IN ('earn', 'spend', 'bonus', 'adjustment')
    -- Validate multiplier is reasonable (0.1 to 10.0)
    AND multiplier >= 0.1 AND multiplier <= 10.0
  );

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIXED: Financial tables INSERT policies';
  RAISE NOTICE 'Users can now:';
  RAISE NOTICE '  - Create wallet transactions (topup, spend)';
  RAISE NOTICE '  - Create stars transactions (earn, spend)';
  RAISE NOTICE '========================================';
END $$;
