/*
  # Fix fiuu_customers RLS Policies

  ## Overview
  Enable Row Level Security on fiuu_customers table to ensure users can only
  view their own payment records while allowing service role full access.

  ## Problem
  The fiuu_customers table stores sensitive payment gateway customer records
  but has RLS disabled, creating a security vulnerability.

  ## Solution
  - Enable RLS on fiuu_customers table
  - Add policy for users to view their own payment records
  - Add policy for service role to manage all records

  ## Security
  - Users can only SELECT their own fiuu_customers record
  - Service role has full access for payment processing
  - INSERT/UPDATE restricted to service role (payment gateway creates these)

  ## Priority
  CRITICAL - Contains sensitive payment information
*/

-- =====================================================
-- ENABLE RLS ON FIUU_CUSTOMERS
-- =====================================================

ALTER TABLE fiuu_customers ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- DROP EXISTING POLICIES (IF ANY)
-- =====================================================

DROP POLICY IF EXISTS "Users view own payment records" ON fiuu_customers;
DROP POLICY IF EXISTS "Service manages all payment records" ON fiuu_customers;

-- =====================================================
-- ADD USER SELECT POLICY
-- =====================================================

-- Allow users to view their own fiuu_customers record
CREATE POLICY "Users view own payment records"
  ON fiuu_customers FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- =====================================================
-- ADD SERVICE ROLE POLICY
-- =====================================================

-- Allow service role to manage all fiuu_customers records
-- This is needed for payment gateway integration
CREATE POLICY "Service manages all payment records"
  ON fiuu_customers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIXED: fiuu_customers RLS policies';
  RAISE NOTICE 'Security: Users view own, service manages all';
  RAISE NOTICE 'Status: CRITICAL - Payment data now secured';
  RAISE NOTICE '========================================';
END $$;
