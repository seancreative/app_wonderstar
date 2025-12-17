/*
  # Create Daily Special Discount Voucher System

  ## Overview
  This migration enables Special Discount vouchers to be redeemed daily (once per day).
  Each redemption creates a voucher instance valid only for that specific day.

  ## Changes

  1. **vouchers table**
     - Add `is_daily_redeemable` boolean column to mark vouchers as daily-redeemable
     - Daily vouchers can be redeemed once per day, with each redemption expiring at end of day

  2. **user_vouchers table**
     - Add `last_redeemed_date` date column to track when voucher was last redeemed
     - Add `redemption_count` integer column to track total number of daily redemptions
     - Add `is_daily_voucher` boolean column to quickly identify daily vouchers

  3. **Functions**
     - Create function to check if user can redeem daily voucher today
     - Create function to handle daily voucher redemption with automatic expiry setting
     - Create function to reset expired daily vouchers for next day

  ## Security
  - All existing RLS policies remain unchanged
  - Daily voucher redemption respects existing user authentication

  ## Notes
  - Daily vouchers expire at 23:59:59 on the day they are redeemed
  - Users can redeem the same daily voucher code again the next day
  - Special Discount vouchers are automatically marked as daily-redeemable
*/

-- =====================================================
-- ADD COLUMNS TO VOUCHERS TABLE
-- =====================================================

DO $$
BEGIN
  -- Mark vouchers as daily-redeemable
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vouchers' AND column_name = 'is_daily_redeemable'
  ) THEN
    ALTER TABLE vouchers ADD COLUMN is_daily_redeemable boolean DEFAULT false NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_vouchers_is_daily_redeemable
    ON vouchers(is_daily_redeemable) WHERE is_daily_redeemable = true;
    RAISE NOTICE 'Added is_daily_redeemable column to vouchers table';
  END IF;
END $$;

-- =====================================================
-- ADD COLUMNS TO USER_VOUCHERS TABLE
-- =====================================================

DO $$
BEGIN
  -- Track last redemption date for daily vouchers
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_vouchers' AND column_name = 'last_redeemed_date'
  ) THEN
    ALTER TABLE user_vouchers ADD COLUMN last_redeemed_date date;
    CREATE INDEX IF NOT EXISTS idx_user_vouchers_last_redeemed_date
    ON user_vouchers(last_redeemed_date);
    RAISE NOTICE 'Added last_redeemed_date column to user_vouchers table';
  END IF;

  -- Track total number of daily redemptions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_vouchers' AND column_name = 'redemption_count'
  ) THEN
    ALTER TABLE user_vouchers ADD COLUMN redemption_count integer DEFAULT 0 NOT NULL;
    RAISE NOTICE 'Added redemption_count column to user_vouchers table';
  END IF;

  -- Quick flag to identify daily vouchers
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_vouchers' AND column_name = 'is_daily_voucher'
  ) THEN
    ALTER TABLE user_vouchers ADD COLUMN is_daily_voucher boolean DEFAULT false NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_user_vouchers_is_daily_voucher
    ON user_vouchers(is_daily_voucher) WHERE is_daily_voucher = true;
    RAISE NOTICE 'Added is_daily_voucher column to user_vouchers table';
  END IF;
END $$;

-- =====================================================
-- FUNCTION: CHECK IF USER CAN REDEEM DAILY VOUCHER TODAY
-- =====================================================

CREATE OR REPLACE FUNCTION can_redeem_daily_voucher_today(
  user_uuid uuid,
  voucher_uuid uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_redeemed_date date;
  v_today date := CURRENT_DATE;
BEGIN
  -- Get the last redemption date for this user and voucher
  SELECT last_redeemed_date
  INTO v_last_redeemed_date
  FROM user_vouchers
  WHERE user_id = user_uuid
    AND voucher_id = voucher_uuid
    AND is_daily_voucher = true
  LIMIT 1;

  -- If no record exists, user can redeem
  IF v_last_redeemed_date IS NULL THEN
    RETURN true;
  END IF;

  -- If last redemption was before today, user can redeem
  IF v_last_redeemed_date < v_today THEN
    RETURN true;
  END IF;

  -- User already redeemed today
  RETURN false;
END;
$$;

-- =====================================================
-- FUNCTION: REDEEM DAILY VOUCHER
-- =====================================================

CREATE OR REPLACE FUNCTION redeem_daily_voucher(
  user_uuid uuid,
  voucher_uuid uuid,
  redemption_method text DEFAULT 'manual_code'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_voucher RECORD;
  v_existing_user_voucher RECORD;
  v_today date := CURRENT_DATE;
  v_today_end_time timestamptz := (CURRENT_DATE + interval '1 day' - interval '1 second');
  v_user_voucher_id uuid;
  v_result jsonb;
BEGIN
  -- Get voucher details
  SELECT *
  INTO v_voucher
  FROM vouchers
  WHERE id = voucher_uuid
    AND is_active = true
    AND is_daily_redeemable = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Voucher not found or not a daily voucher'
    );
  END IF;

  -- Check if user can redeem today
  IF NOT can_redeem_daily_voucher_today(user_uuid, voucher_uuid) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You have already redeemed this voucher today. Come back tomorrow!'
    );
  END IF;

  -- Check if user_voucher record already exists
  SELECT *
  INTO v_existing_user_voucher
  FROM user_vouchers
  WHERE user_id = user_uuid
    AND voucher_id = voucher_uuid
    AND is_daily_voucher = true
  LIMIT 1;

  IF FOUND THEN
    -- Update existing record
    UPDATE user_vouchers
    SET
      last_redeemed_date = v_today,
      expires_at = v_today_end_time,
      status = 'available',
      redemption_count = redemption_count + 1,
      updated_at = now(),
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{last_redemption_method}',
        to_jsonb(redemption_method)
      )
    WHERE id = v_existing_user_voucher.id
    RETURNING id INTO v_user_voucher_id;
  ELSE
    -- Create new record
    INSERT INTO user_vouchers (
      user_id,
      voucher_id,
      status,
      last_redeemed_date,
      expires_at,
      is_daily_voucher,
      redemption_count,
      max_usage_count,
      metadata
    ) VALUES (
      user_uuid,
      voucher_uuid,
      'available',
      v_today,
      v_today_end_time,
      true,
      1,
      999999,
      jsonb_build_object(
        'redemption_method', redemption_method,
        'first_redeemed_at', now()
      )
    )
    RETURNING id INTO v_user_voucher_id;
  END IF;

  -- Return success with user_voucher_id
  RETURN jsonb_build_object(
    'success', true,
    'user_voucher_id', v_user_voucher_id,
    'expires_at', v_today_end_time,
    'message', 'Voucher redeemed successfully! Valid until midnight tonight.'
  );
END;
$$;

-- =====================================================
-- FUNCTION: AUTO-EXPIRE DAILY VOUCHERS (CLEANUP)
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_expired_daily_vouchers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update status of expired daily vouchers
  -- Note: They remain in the system and can be redeemed again the next day
  UPDATE user_vouchers
  SET status = 'expired'
  WHERE is_daily_voucher = true
    AND status = 'available'
    AND expires_at < now();

  RAISE NOTICE 'Cleaned up expired daily vouchers';
END;
$$;

-- =====================================================
-- UPDATE EXISTING SPECIAL DISCOUNT VOUCHERS
-- =====================================================

-- Mark all existing special discount vouchers as daily-redeemable
-- A special discount voucher is identified by having products with special_discount = true
DO $$
BEGIN
  UPDATE vouchers
  SET is_daily_redeemable = true
  WHERE is_active = true
    AND eligible_product_ids IS NOT NULL
    AND array_length(eligible_product_ids, 1) > 0
    AND EXISTS (
      SELECT 1 FROM shop_products
      WHERE shop_products.product_id = ANY(vouchers.eligible_product_ids)
      AND shop_products.special_discount = true
      AND shop_products.is_active = true
    );

  -- Remove expiry dates from daily-redeemable vouchers (they expire daily automatically)
  UPDATE vouchers
  SET expires_at = NULL
  WHERE is_daily_redeemable = true;

  RAISE NOTICE 'Updated existing special discount vouchers to be daily-redeemable';
END $$;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN vouchers.is_daily_redeemable IS 'Marks voucher as redeemable once per day with automatic daily expiry';
COMMENT ON COLUMN user_vouchers.last_redeemed_date IS 'Date when user last redeemed this daily voucher';
COMMENT ON COLUMN user_vouchers.redemption_count IS 'Total number of times user has redeemed this daily voucher';
COMMENT ON COLUMN user_vouchers.is_daily_voucher IS 'Quick flag to identify daily-redeemable vouchers';

COMMENT ON FUNCTION can_redeem_daily_voucher_today(uuid, uuid) IS 'Checks if user can redeem a daily voucher today';
COMMENT ON FUNCTION redeem_daily_voucher(uuid, uuid, text) IS 'Redeems a daily voucher for a user with automatic daily expiry';
COMMENT ON FUNCTION cleanup_expired_daily_vouchers() IS 'Marks expired daily vouchers as expired (run daily via cron)';
