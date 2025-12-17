/*
  # Enable RLS - Group E: Voucher System

  ## Overview
  This migration enables Row Level Security on voucher-related tables.
  These tables handle voucher ownership, redemption, and usage tracking.

  ## Tables Covered
  - user_vouchers
  - voucher_redemptions
  - voucher_usage
  - voucher_auto_rules
  - order_item_redemptions

  ## Security Model
  - Users can view their own vouchers and usage
  - Service role manages voucher assignment and redemption
  - Auto rules only accessible by service role
  - Order item redemptions viewable by users, manageable by service

  ## Safety
  - Complex relationships between tables
  - Critical for promotional campaigns
  - Service role primary for mutations
*/

-- =====================================================
-- DROP EXISTING POLICIES FIRST
-- =====================================================

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'user_vouchers', 'voucher_redemptions', 'voucher_usage',
        'voucher_auto_rules', 'order_item_redemptions'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

-- =====================================================
-- USER VOUCHERS
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_vouchers') THEN
    ALTER TABLE user_vouchers ENABLE ROW LEVEL SECURITY;

    EXECUTE 'CREATE POLICY "Users view own vouchers"
      ON user_vouchers FOR SELECT
      TO authenticated
      USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))';

    EXECUTE 'CREATE POLICY "Users can update own voucher usage"
      ON user_vouchers FOR UPDATE
      TO authenticated
      USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
      WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))';

    EXECUTE 'CREATE POLICY "Service can manage user vouchers"
      ON user_vouchers FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- =====================================================
-- VOUCHER REDEMPTIONS
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voucher_redemptions') THEN
    ALTER TABLE voucher_redemptions ENABLE ROW LEVEL SECURITY;

    EXECUTE 'CREATE POLICY "Users view own voucher redemptions"
      ON voucher_redemptions FOR SELECT
      TO authenticated
      USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))';

    EXECUTE 'CREATE POLICY "Service can manage voucher redemptions"
      ON voucher_redemptions FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- =====================================================
-- VOUCHER USAGE
-- =====================================================
ALTER TABLE voucher_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own voucher usage"
  ON voucher_usage FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Service can manage voucher usage"
  ON voucher_usage FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- VOUCHER AUTO RULES
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voucher_auto_rules') THEN
    ALTER TABLE voucher_auto_rules ENABLE ROW LEVEL SECURITY;

    EXECUTE 'CREATE POLICY "Admins view voucher auto rules"
      ON voucher_auto_rules FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admin_users
          WHERE auth_id = auth.uid()
            AND is_active = true
        )
      )';

    EXECUTE 'CREATE POLICY "Service can manage voucher auto rules"
      ON voucher_auto_rules FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- =====================================================
-- ORDER ITEM REDEMPTIONS
-- =====================================================
ALTER TABLE order_item_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own order redemptions"
  ON order_item_redemptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shop_orders
      WHERE shop_orders.id = order_item_redemptions.order_id
        AND shop_orders.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Service can manage order redemptions"
  ON order_item_redemptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Staff can view redemptions at their outlet
CREATE POLICY "Staff view outlet redemptions"
  ON order_item_redemptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_passcodes sp
      JOIN shop_orders so ON so.outlet_id = sp.outlet_id
      WHERE sp.auth_id = auth.uid()
        AND sp.is_active = true
        AND so.id = order_item_redemptions.order_id
    )
  );

-- Staff can update redemption status
CREATE POLICY "Staff update redemption status"
  ON order_item_redemptions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_passcodes sp
      JOIN shop_orders so ON so.outlet_id = sp.outlet_id
      WHERE sp.auth_id = auth.uid()
        AND sp.is_active = true
        AND so.id = order_item_redemptions.order_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_passcodes sp
      JOIN shop_orders so ON so.outlet_id = sp.outlet_id
      WHERE sp.auth_id = auth.uid()
        AND sp.is_active = true
        AND so.id = order_item_redemptions.order_id
    )
  );

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS ENABLED - GROUP E (VOUCHER SYSTEM)';
  RAISE NOTICE 'Security: Users view own, service/staff manage';
  RAISE NOTICE '========================================';
END $$;
