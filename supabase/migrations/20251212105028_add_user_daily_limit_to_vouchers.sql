/*
  # Add Per-User Daily Usage Limit to Vouchers

  ## Overview
  This migration adds a per-user daily usage limit system to vouchers, allowing admins to:
  - Limit how many times each user can use a voucher per day
  - Track daily usage with automatic reset at midnight
  - Maintain existing global and lifetime user limits

  ## Changes

  ### 1. Vouchers Table
    - Add `user_daily_limit` column (nullable, default NULL = unlimited)
    - This is SEPARATE from:
      - `max_uses` (global limit across all users)
      - `usage_limit_per_user` (per-user lifetime limit)

  ### 2. User Vouchers Table
    - Add `daily_usage_count` column to track today's usage
    - Add `last_daily_reset_date` column to track when counter was last reset

  ### 3. Database Functions
    - `check_daily_voucher_limit`: Validates if user can use voucher today
    - `reset_daily_usage_if_needed`: Automatically resets counter for new day
    - `use_user_voucher`: Updated to handle daily limit tracking

  ## Example Usage

  Voucher with:
  - `max_uses` = 1000 (global: 1000 total redemptions)
  - `usage_limit_per_user` = 5 (each user can use 5 times ever)
  - `user_daily_limit` = 1 (each user can only use once per day)

  Result: User can redeem up to 5 times total, but only once per day

  ## Security
  - No RLS changes needed (inherits from existing policies)
  - Daily reset is automatic and server-controlled
  - Cannot be manipulated by client
*/

-- =====================================================
-- 1. ADD DAILY LIMIT COLUMN TO VOUCHERS
-- =====================================================

DO $$
BEGIN
  -- Add user_daily_limit column to vouchers table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vouchers' AND column_name = 'user_daily_limit'
  ) THEN
    ALTER TABLE vouchers
    ADD COLUMN user_daily_limit integer DEFAULT NULL;

    COMMENT ON COLUMN vouchers.user_daily_limit IS 'Maximum times each user can use this voucher per day (NULL = unlimited daily uses)';
  END IF;
END $$;

-- =====================================================
-- 2. ADD DAILY TRACKING COLUMNS TO USER_VOUCHERS
-- =====================================================

DO $$
BEGIN
  -- Add daily_usage_count column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_vouchers' AND column_name = 'daily_usage_count'
  ) THEN
    ALTER TABLE user_vouchers
    ADD COLUMN daily_usage_count integer DEFAULT 0 NOT NULL;

    COMMENT ON COLUMN user_vouchers.daily_usage_count IS 'Number of times voucher was used today';
  END IF;

  -- Add last_daily_reset_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_vouchers' AND column_name = 'last_daily_reset_date'
  ) THEN
    ALTER TABLE user_vouchers
    ADD COLUMN last_daily_reset_date date DEFAULT CURRENT_DATE;

    COMMENT ON COLUMN user_vouchers.last_daily_reset_date IS 'Last date when daily counter was reset';
  END IF;
END $$;

-- =====================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_vouchers_daily_reset
ON user_vouchers(user_id, voucher_id, last_daily_reset_date);

-- =====================================================
-- 4. FUNCTION TO RESET DAILY USAGE IF NEW DAY
-- =====================================================

CREATE OR REPLACE FUNCTION reset_daily_usage_if_needed(user_voucher_uuid uuid)
RETURNS void AS $$
BEGIN
  UPDATE user_vouchers
  SET
    daily_usage_count = 0,
    last_daily_reset_date = CURRENT_DATE,
    updated_at = now()
  WHERE id = user_voucher_uuid
    AND last_daily_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_daily_usage_if_needed IS 'Resets daily usage counter if its a new day';

-- =====================================================
-- 5. FUNCTION TO CHECK DAILY LIMIT
-- =====================================================

CREATE OR REPLACE FUNCTION check_daily_voucher_limit(
  user_voucher_uuid uuid,
  OUT can_use boolean,
  OUT error_message text
)
AS $$
DECLARE
  v_voucher record;
  v_user_voucher record;
BEGIN
  -- Get user voucher details
  SELECT
    uv.daily_usage_count,
    uv.last_daily_reset_date,
    uv.usage_count,
    uv.max_usage_count,
    uv.status,
    uv.expires_at
  INTO v_user_voucher
  FROM user_vouchers uv
  WHERE uv.id = user_voucher_uuid;

  -- Check if user voucher exists
  IF NOT FOUND THEN
    can_use := false;
    error_message := 'Voucher not found';
    RETURN;
  END IF;

  -- Reset daily counter if new day
  IF v_user_voucher.last_daily_reset_date < CURRENT_DATE THEN
    PERFORM reset_daily_usage_if_needed(user_voucher_uuid);
    v_user_voucher.daily_usage_count := 0;
  END IF;

  -- Check voucher status
  IF v_user_voucher.status != 'available' THEN
    can_use := false;
    error_message := 'Voucher is not available';
    RETURN;
  END IF;

  -- Check expiry
  IF v_user_voucher.expires_at IS NOT NULL AND v_user_voucher.expires_at < now() THEN
    can_use := false;
    error_message := 'Voucher has expired';
    RETURN;
  END IF;

  -- Check lifetime usage limit
  IF v_user_voucher.usage_count >= v_user_voucher.max_usage_count THEN
    can_use := false;
    error_message := 'Voucher usage limit reached';
    RETURN;
  END IF;

  -- Get voucher details for daily limit
  SELECT v.user_daily_limit
  INTO v_voucher
  FROM vouchers v
  INNER JOIN user_vouchers uv ON uv.voucher_id = v.id
  WHERE uv.id = user_voucher_uuid;

  -- Check daily limit (if set)
  IF v_voucher.user_daily_limit IS NOT NULL THEN
    IF v_user_voucher.daily_usage_count >= v_voucher.user_daily_limit THEN
      can_use := false;
      error_message := 'Daily usage limit reached. You can use this voucher again tomorrow.';
      RETURN;
    END IF;
  END IF;

  -- All checks passed
  can_use := true;
  error_message := NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_daily_voucher_limit IS 'Checks if user can use voucher today (validates daily, lifetime, expiry, and status)';

-- =====================================================
-- 6. UPDATE USE_USER_VOUCHER FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION use_user_voucher(user_voucher_uuid uuid)
RETURNS void AS $$
DECLARE
  v_user_voucher record;
BEGIN
  -- Get current voucher state
  SELECT
    daily_usage_count,
    usage_count,
    max_usage_count,
    last_daily_reset_date
  INTO v_user_voucher
  FROM user_vouchers
  WHERE id = user_voucher_uuid;

  -- Reset daily counter if new day
  IF v_user_voucher.last_daily_reset_date < CURRENT_DATE THEN
    PERFORM reset_daily_usage_if_needed(user_voucher_uuid);
  END IF;

  -- Increment both daily and lifetime usage counters
  UPDATE user_vouchers
  SET
    usage_count = usage_count + 1,
    daily_usage_count = CASE
      WHEN last_daily_reset_date < CURRENT_DATE THEN 1
      ELSE daily_usage_count + 1
    END,
    last_daily_reset_date = CURRENT_DATE,
    status = CASE
      WHEN usage_count + 1 >= max_usage_count THEN 'used'
      ELSE status
    END,
    used_at = CASE
      WHEN used_at IS NULL THEN now()
      ELSE used_at
    END,
    updated_at = now()
  WHERE id = user_voucher_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION use_user_voucher IS 'Marks voucher as used, increments both lifetime and daily counters';

-- =====================================================
-- 7. BACKWARD COMPATIBILITY
-- =====================================================

-- Existing vouchers with NULL user_daily_limit have unlimited daily uses (no change in behavior)
-- Existing user_vouchers get initialized with today's date and 0 count
UPDATE user_vouchers
SET
  daily_usage_count = 0,
  last_daily_reset_date = CURRENT_DATE
WHERE daily_usage_count IS NULL OR last_daily_reset_date IS NULL;