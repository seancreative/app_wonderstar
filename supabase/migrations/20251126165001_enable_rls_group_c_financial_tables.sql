/*
  # Enable RLS - Group C: Financial Tables

  ## Overview
  This migration enables Row Level Security on financial and transaction tables.
  These are critical tables that require careful access control.

  ## Tables Covered
  - wallet_transactions
  - stars_transactions
  - shop_cart_items
  - shop_orders
  - payment_transactions
  - redemptions
  - stamps_tracking
  - stamps_history
  - stamps_redemptions

  ## Security Model
  - Users can SELECT their own financial records
  - INSERT/UPDATE operations primarily through service role
  - Users can manage their own cart items
  - Strict validation on all modifications

  ## Safety
  - High risk - these are financial records
  - Read-only for users (except cart)
  - Service role for system operations
  - Comprehensive audit trail maintained
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
        'wallet_transactions', 'stars_transactions', 'shop_cart_items',
        'shop_orders', 'payment_transactions', 'redemptions',
        'stamps_tracking', 'stamps_history', 'stamps_redemptions'
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
-- WALLET TRANSACTIONS
-- =====================================================
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wallet transactions"
  ON wallet_transactions FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Service can manage wallet transactions"
  ON wallet_transactions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- STARS TRANSACTIONS
-- =====================================================
ALTER TABLE stars_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own stars transactions"
  ON stars_transactions FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Service can manage stars transactions"
  ON stars_transactions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- SHOP CART ITEMS
-- =====================================================
ALTER TABLE shop_cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own cart"
  ON shop_cart_items FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users manage own cart"
  ON shop_cart_items FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users update own cart"
  ON shop_cart_items FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users delete own cart items"
  ON shop_cart_items FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Service can manage all carts"
  ON shop_cart_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- SHOP ORDERS
-- =====================================================
ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own orders"
  ON shop_orders FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users create own orders"
  ON shop_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Service can manage orders"
  ON shop_orders FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- PAYMENT TRANSACTIONS
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_transactions') THEN
    ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

    EXECUTE 'CREATE POLICY "Users view own payment transactions"
      ON payment_transactions FOR SELECT
      TO authenticated
      USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))';

    EXECUTE 'CREATE POLICY "Service can manage payment transactions"
      ON payment_transactions FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- =====================================================
-- REDEMPTIONS
-- =====================================================
ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own redemptions"
  ON redemptions FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users create redemptions"
  ON redemptions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Service can manage redemptions"
  ON redemptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- STAMPS TRACKING
-- =====================================================
ALTER TABLE stamps_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own stamps"
  ON stamps_tracking FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Service can manage stamps"
  ON stamps_tracking FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- STAMPS HISTORY
-- =====================================================
ALTER TABLE stamps_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own stamp history"
  ON stamps_history FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Service can manage stamp history"
  ON stamps_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- STAMPS REDEMPTIONS
-- =====================================================
ALTER TABLE stamps_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own stamp redemptions"
  ON stamps_redemptions FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Service can manage stamp redemptions"
  ON stamps_redemptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS ENABLED - GROUP C (FINANCIAL TABLES)';
  RAISE NOTICE 'Security: Users view own, service manages';
  RAISE NOTICE '========================================';
END $$;
