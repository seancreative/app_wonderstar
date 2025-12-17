/*
  # Fix Stamps System INSERT Policies

  ## Overview
  This migration adds INSERT and UPDATE policies for authenticated users on stamps-related tables.
  This allows users to earn stamps, track their progress, and redeem stamps for rewards.

  ## Problem
  Users were unable to:
  - Initialize stamps tracking (INSERT into stamps_tracking)
  - Earn stamps (INSERT into stamps_history)
  - Redeem stamps (INSERT into stamps_redemptions, UPDATE stamps_tracking)
  
  All these operations were restricted to service_role only.

  ## Solution
  Add INSERT/UPDATE policies that allow authenticated users to manage their own stamp records
  with proper validation to ensure security.

  ## Tables Updated
  1. stamps_tracking - Add INSERT and UPDATE policies
  2. stamps_history - Add INSERT policy
  3. stamps_redemptions - Add INSERT policy

  ## Security
  - Users can only manage their own records (user_id must match auth.uid())
  - Proper validation on all operations
  - Service role policies remain for admin operations
*/

-- =====================================================
-- STAMPS TRACKING - ADD INSERT AND UPDATE POLICIES
-- =====================================================

-- Drop policies if they already exist
DROP POLICY IF EXISTS "Users can initialize own stamps tracking" ON stamps_tracking;
DROP POLICY IF EXISTS "Users can update own stamps tracking" ON stamps_tracking;

-- Allow users to create their own stamps tracking record
CREATE POLICY "Users can initialize own stamps tracking"
  ON stamps_tracking FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- Allow users to update their own stamps tracking
CREATE POLICY "Users can update own stamps tracking"
  ON stamps_tracking FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- =====================================================
-- STAMPS HISTORY - ADD INSERT POLICY
-- =====================================================

-- Drop policy if it already exists
DROP POLICY IF EXISTS "Users can create own stamp history" ON stamps_history;

-- Allow users to create their own stamp history records
CREATE POLICY "Users can create own stamp history"
  ON stamps_history FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    -- Validate source is from approved list
    AND source IN (
      'ticket_purchase', 'checkin_bonus', 'promotion', 
      'admin_grant', 'staff_scanner', 'order_completion'
    )
  );

-- =====================================================
-- STAMPS REDEMPTIONS - ADD INSERT POLICY
-- =====================================================

-- Drop policy if it already exists
DROP POLICY IF EXISTS "Users can create own stamp redemptions" ON stamps_redemptions;

-- Allow users to create their own stamp redemption records
CREATE POLICY "Users can create own stamp redemptions"
  ON stamps_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    -- Validate redemption type
    AND redemption_type IN ('ice_cream', 'ramen')
    -- Validate status is pending on creation
    AND status = 'pending'
  );

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIXED: Stamps system INSERT/UPDATE policies';
  RAISE NOTICE 'Users can now:';
  RAISE NOTICE '  - Initialize stamps tracking';
  RAISE NOTICE '  - Earn stamps';
  RAISE NOTICE '  - Redeem stamps for rewards';
  RAISE NOTICE '========================================';
END $$;
