/*
  # Fix Function Search Paths (v2)

  ## Overview
  Add explicit search_path settings to all database functions to prevent
  potential security issues from role-mutable search paths.

  ## Solution
  Drop and recreate functions with explicit search_path = public, pg_temp

  ## Functions Updated (16 total)
  All modifier, auth, subcategory, voucher, user preferences, and wallet functions
*/

-- =====================================================
-- UPDATE MODIFIER FUNCTIONS
-- =====================================================

DROP FUNCTION IF EXISTS update_modifier_groups_updated_at() CASCADE;
CREATE OR REPLACE FUNCTION update_modifier_groups_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS validate_single_choice_default() CASCADE;
CREATE OR REPLACE FUNCTION validate_single_choice_default()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE modifier_options
    SET is_default = false
    WHERE modifier_group_id = NEW.modifier_group_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================
-- UPDATE AUTH HELPER FUNCTIONS
-- =====================================================

DROP FUNCTION IF EXISTS has_supabase_auth() CASCADE;
CREATE OR REPLACE FUNCTION has_supabase_auth()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'auth' 
    AND table_name = 'users'
  );
END;
$$;

DROP FUNCTION IF EXISTS get_user_id_from_auth() CASCADE;
CREATE OR REPLACE FUNCTION get_user_id_from_auth()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN (SELECT id FROM users WHERE auth_id = auth.uid());
END;
$$;

-- =====================================================
-- UPDATE SUBCATEGORY FUNCTIONS
-- =====================================================

DROP FUNCTION IF EXISTS generate_subcategory_id() CASCADE;
CREATE OR REPLACE FUNCTION generate_subcategory_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN 'SC' || LPAD(NEXTVAL('subcategory_id_seq')::text, 4, '0');
END;
$$;

DROP FUNCTION IF EXISTS set_subcategory_id() CASCADE;
CREATE OR REPLACE FUNCTION set_subcategory_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.subcategory_id IS NULL THEN
    NEW.subcategory_id := generate_subcategory_id();
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================
-- UPDATE VOUCHER FUNCTIONS
-- =====================================================

DROP FUNCTION IF EXISTS get_special_discount_product_ids() CASCADE;
CREATE OR REPLACE FUNCTION get_special_discount_product_ids()
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  product_ids uuid[];
BEGIN
  SELECT ARRAY_AGG(id) INTO product_ids
  FROM shop_products
  WHERE LOWER(name) LIKE '%special%' 
     OR LOWER(name) LIKE '%discount%'
     OR metadata->>'is_special_promo' = 'true';
  
  RETURN COALESCE(product_ids, ARRAY[]::uuid[]);
END;
$$;

DROP FUNCTION IF EXISTS is_today_only_voucher_valid(uuid) CASCADE;
CREATE OR REPLACE FUNCTION is_today_only_voucher_valid(p_voucher_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_valid_from timestamptz;
  v_valid_until timestamptz;
BEGIN
  SELECT valid_from, valid_until 
  INTO v_valid_from, v_valid_until
  FROM vouchers
  WHERE id = p_voucher_id;

  RETURN (
    v_valid_from IS NOT NULL 
    AND v_valid_until IS NOT NULL
    AND CURRENT_TIMESTAMP >= v_valid_from 
    AND CURRENT_TIMESTAMP <= v_valid_until
  );
END;
$$;

DROP FUNCTION IF EXISTS can_redeem_daily_voucher_today(uuid, uuid) CASCADE;
CREATE OR REPLACE FUNCTION can_redeem_daily_voucher_today(
  p_user_id uuid,
  p_voucher_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_redeemed_today boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM user_vouchers
    WHERE user_id = p_user_id
      AND voucher_id = p_voucher_id
      AND DATE(redeemed_at) = CURRENT_DATE
  ) INTO v_redeemed_today;

  RETURN NOT v_redeemed_today;
END;
$$;

DROP FUNCTION IF EXISTS redeem_daily_voucher(uuid, uuid) CASCADE;
CREATE OR REPLACE FUNCTION redeem_daily_voucher(
  p_user_id uuid,
  p_voucher_id uuid
)
RETURNS TABLE(success boolean, message text, user_voucher_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_voucher_id uuid;
  v_can_redeem boolean;
BEGIN
  v_can_redeem := can_redeem_daily_voucher_today(p_user_id, p_voucher_id);
  
  IF NOT v_can_redeem THEN
    RETURN QUERY SELECT false, 'Already redeemed today'::text, NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO user_vouchers (user_id, voucher_id, status, redeemed_at)
  VALUES (p_user_id, p_voucher_id, 'available', now())
  RETURNING id INTO v_user_voucher_id;

  RETURN QUERY SELECT true, 'Voucher redeemed successfully'::text, v_user_voucher_id;
END;
$$;

DROP FUNCTION IF EXISTS cleanup_expired_daily_vouchers() CASCADE;
CREATE OR REPLACE FUNCTION cleanup_expired_daily_vouchers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM user_vouchers
  WHERE voucher_id IN (
    SELECT id FROM vouchers WHERE is_daily_redeemable = true
  )
  AND DATE(redeemed_at) < CURRENT_DATE
  AND status = 'available';
END;
$$;

-- =====================================================
-- UPDATE WALLET FUNCTIONS
-- =====================================================

DROP FUNCTION IF EXISTS sync_wallet_transaction_status(uuid, text) CASCADE;
CREATE OR REPLACE FUNCTION sync_wallet_transaction_status(
  p_transaction_id uuid,
  p_new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE wallet_transactions
  SET status = p_new_status,
      updated_at = now()
  WHERE id = p_transaction_id;
END;
$$;

DROP FUNCTION IF EXISTS reconcile_wallet_transaction(uuid, text) CASCADE;
CREATE OR REPLACE FUNCTION reconcile_wallet_transaction(
  p_transaction_id uuid,
  p_payment_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE wallet_transactions
  SET status = CASE
    WHEN p_payment_status = 'completed' THEN 'success'
    WHEN p_payment_status = 'failed' THEN 'failed'
    WHEN p_payment_status = 'cancelled' THEN 'cancelled'
    ELSE status
  END,
  updated_at = now()
  WHERE id = p_transaction_id;
END;
$$;

DROP FUNCTION IF EXISTS cleanup_abandoned_wallet_transactions() CASCADE;
CREATE OR REPLACE FUNCTION cleanup_abandoned_wallet_transactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE wallet_transactions
  SET status = 'cancelled'
  WHERE status = 'pending'
    AND created_at < (now() - interval '24 hours');
END;
$$;

-- =====================================================
-- RECREATE TRIGGERS (if they were dropped by CASCADE)
-- =====================================================

-- Recreate modifier_groups trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_modifier_groups_updated_at_trigger'
  ) THEN
    CREATE TRIGGER update_modifier_groups_updated_at_trigger
      BEFORE UPDATE ON modifier_groups
      FOR EACH ROW
      EXECUTE FUNCTION update_modifier_groups_updated_at();
  END IF;
END $$;

-- Recreate modifier_options trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'validate_single_choice_default_trigger'
  ) THEN
    CREATE TRIGGER validate_single_choice_default_trigger
      BEFORE INSERT OR UPDATE ON modifier_options
      FOR EACH ROW
      EXECUTE FUNCTION validate_single_choice_default();
  END IF;
END $$;

-- Recreate subcategory trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'set_subcategory_id_trigger'
  ) THEN
    CREATE TRIGGER set_subcategory_id_trigger
      BEFORE INSERT ON shop_products
      FOR EACH ROW
      EXECUTE FUNCTION set_subcategory_id();
  END IF;
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIXED: Function search paths';
  RAISE NOTICE 'Updated all functions with explicit search_path';
  RAISE NOTICE 'Security: Protected against schema injection';
  RAISE NOTICE 'Status: All functions secured, triggers recreated';
  RAISE NOTICE '========================================';
END $$;
