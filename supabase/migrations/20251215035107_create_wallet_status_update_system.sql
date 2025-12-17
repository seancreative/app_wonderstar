/*
  # Create Robust Wallet Status Update System

  1. Problem Statement
    Payment callbacks sometimes fail to update wallet_transactions status from 'pending' to 'success',
    causing users' balances not to reflect even though payment succeeded. This creates critical issues:
    - User paid money but balance shows 0
    - Transaction stays 'pending' forever
    - calculateWalletBalance() skips pending transactions

  2. Root Causes
    - Silent update failures without proper error handling
    - Race conditions during concurrent callback processing
    - Missing verification and retry logic
    - No audit trail to diagnose failures

  3. Solution
    - Create atomic database function for status updates
    - Add comprehensive audit trail
    - Build automatic recovery mechanism
    - Add health check system

  4. Changes
    a) Status Update Audit Trail Table
       - Tracks every status change attempt
       - Records success/failure with details
       - Enables forensic analysis

    b) Atomic Update Function
       - SECURITY DEFINER to bypass any permission issues
       - Idempotent (safe to call multiple times)
       - Returns detailed result with success status
       - Comprehensive error handling

    c) Health Check Function
       - Finds stuck pending transactions
       - Auto-fixes if payment is confirmed
       - Returns list of problematic transactions

  5. Security
    - RLS disabled on transaction tables (already done)
    - Functions are SECURITY DEFINER for reliability
    - Audit trail tracks all changes
*/

-- =====================================================
-- CREATE AUDIT TRAIL TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS wallet_status_update_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_transaction_id uuid NOT NULL REFERENCES wallet_transactions(id),
  attempted_at timestamptz NOT NULL DEFAULT NOW(),
  old_status text,
  new_status text NOT NULL,
  success boolean NOT NULL,
  error_code text,
  error_message text,
  error_details jsonb,
  metadata jsonb,
  triggered_by text, -- 'payment_callback', 'health_check', 'manual_fix', 'admin'
  user_id uuid REFERENCES users(id),
  created_at timestamptz DEFAULT NOW()
);

-- Disable RLS for audit table
ALTER TABLE wallet_status_update_audit DISABLE ROW LEVEL SECURITY;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_wallet_status_audit_transaction_id
  ON wallet_status_update_audit(wallet_transaction_id);
CREATE INDEX IF NOT EXISTS idx_wallet_status_audit_attempted_at
  ON wallet_status_update_audit(attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_status_audit_success
  ON wallet_status_update_audit(success) WHERE success = false;

-- =====================================================
-- ATOMIC WALLET STATUS UPDATE FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION update_wallet_transaction_status(
  p_wallet_transaction_id uuid,
  p_new_status text,
  p_triggered_by text DEFAULT 'payment_callback',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_status text;
  v_current_status text;
  v_user_id uuid;
  v_amount numeric;
  v_transaction_type text;
  v_update_count integer;
  v_audit_id uuid;
  v_result jsonb;
  v_error_code text;
  v_error_message text;
  v_error_details jsonb;
BEGIN
  -- Log function entry
  RAISE NOTICE '[update_wallet_transaction_status] Starting update for transaction: %, new_status: %, triggered_by: %',
    p_wallet_transaction_id, p_new_status, p_triggered_by;

  -- Validate inputs
  IF p_wallet_transaction_id IS NULL THEN
    RAISE EXCEPTION 'wallet_transaction_id cannot be null';
  END IF;

  IF p_new_status IS NULL OR p_new_status NOT IN ('pending', 'processing', 'success', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status value: %. Must be one of: pending, processing, success, failed, cancelled', p_new_status;
  END IF;

  -- Fetch current transaction details
  BEGIN
    SELECT status, user_id, amount, transaction_type
    INTO v_old_status, v_user_id, v_amount, v_transaction_type
    FROM wallet_transactions
    WHERE id = p_wallet_transaction_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Wallet transaction not found: %', p_wallet_transaction_id;
    END IF;

    RAISE NOTICE '[update_wallet_transaction_status] Current state: status=%, user_id=%, amount=%, type=%',
      v_old_status, v_user_id, v_amount, v_transaction_type;

  EXCEPTION WHEN OTHERS THEN
    v_error_code := SQLSTATE;
    v_error_message := SQLERRM;
    v_error_details := jsonb_build_object(
      'error_code', v_error_code,
      'error_message', v_error_message,
      'transaction_id', p_wallet_transaction_id
    );

    -- Log failed attempt
    INSERT INTO wallet_status_update_audit (
      wallet_transaction_id, old_status, new_status, success,
      error_code, error_message, error_details, triggered_by, metadata
    ) VALUES (
      p_wallet_transaction_id, NULL, p_new_status, false,
      v_error_code, v_error_message, v_error_details, p_triggered_by, p_metadata
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Transaction not found or fetch failed',
      'error_code', v_error_code,
      'error_message', v_error_message,
      'error_details', v_error_details
    );
  END;

  -- IDEMPOTENCY CHECK: If already at desired status, this is OK (not an error)
  IF v_old_status = p_new_status THEN
    RAISE NOTICE '[update_wallet_transaction_status] Transaction already has status %, treating as success',
      p_new_status;

    -- Log successful idempotent operation
    INSERT INTO wallet_status_update_audit (
      wallet_transaction_id, old_status, new_status, success,
      triggered_by, user_id, metadata
    ) VALUES (
      p_wallet_transaction_id, v_old_status, p_new_status, true,
      p_triggered_by, v_user_id,
      jsonb_build_object('idempotent', true) || p_metadata
    )
    RETURNING id INTO v_audit_id;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'message', 'Status already set to ' || p_new_status,
      'old_status', v_old_status,
      'new_status', p_new_status,
      'audit_id', v_audit_id,
      'transaction_id', p_wallet_transaction_id,
      'user_id', v_user_id,
      'amount', v_amount
    );
  END IF;

  -- Perform the status update
  BEGIN
    UPDATE wallet_transactions
    SET
      status = p_new_status,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'status_updated_at', NOW(),
        'status_updated_by', p_triggered_by,
        'previous_status', v_old_status
      ),
      updated_at = NOW()
    WHERE id = p_wallet_transaction_id
      AND status = v_old_status; -- Prevent race conditions

    GET DIAGNOSTICS v_update_count = ROW_COUNT;

    IF v_update_count = 0 THEN
      -- This means status changed between our read and update (race condition)
      -- Re-read current status
      SELECT status INTO v_current_status
      FROM wallet_transactions
      WHERE id = p_wallet_transaction_id;

      RAISE WARNING '[update_wallet_transaction_status] Race condition detected: status changed from % to % during update',
        v_old_status, v_current_status;

      -- If it changed to our target status, treat as success
      IF v_current_status = p_new_status THEN
        INSERT INTO wallet_status_update_audit (
          wallet_transaction_id, old_status, new_status, success,
          triggered_by, user_id, metadata
        ) VALUES (
          p_wallet_transaction_id, v_old_status, p_new_status, true,
          p_triggered_by, v_user_id,
          jsonb_build_object('race_condition_resolved', true) || p_metadata
        )
        RETURNING id INTO v_audit_id;

        RETURN jsonb_build_object(
          'success', true,
          'race_condition', true,
          'message', 'Status updated by concurrent operation',
          'old_status', v_old_status,
          'new_status', p_new_status,
          'audit_id', v_audit_id
        );
      ELSE
        -- Status changed to something else - this is a problem
        RAISE EXCEPTION 'Race condition: status changed to % instead of %', v_current_status, p_new_status;
      END IF;
    END IF;

    RAISE NOTICE '[update_wallet_transaction_status] ✅ Successfully updated status from % to %',
      v_old_status, p_new_status;

    -- Verify the update
    SELECT status INTO v_current_status
    FROM wallet_transactions
    WHERE id = p_wallet_transaction_id;

    IF v_current_status != p_new_status THEN
      RAISE EXCEPTION 'Verification failed: status is % but expected %', v_current_status, p_new_status;
    END IF;

    -- Log successful update
    INSERT INTO wallet_status_update_audit (
      wallet_transaction_id, old_status, new_status, success,
      triggered_by, user_id, metadata
    ) VALUES (
      p_wallet_transaction_id, v_old_status, p_new_status, true,
      p_triggered_by, v_user_id, p_metadata
    )
    RETURNING id INTO v_audit_id;

    -- Build success result
    v_result := jsonb_build_object(
      'success', true,
      'message', 'Wallet transaction status updated successfully',
      'old_status', v_old_status,
      'new_status', p_new_status,
      'transaction_id', p_wallet_transaction_id,
      'user_id', v_user_id,
      'amount', v_amount,
      'transaction_type', v_transaction_type,
      'audit_id', v_audit_id,
      'updated_at', NOW()
    );

    RETURN v_result;

  EXCEPTION WHEN OTHERS THEN
    v_error_code := SQLSTATE;
    v_error_message := SQLERRM;
    v_error_details := jsonb_build_object(
      'error_code', v_error_code,
      'error_message', v_error_message,
      'old_status', v_old_status,
      'new_status', p_new_status,
      'transaction_id', p_wallet_transaction_id,
      'update_count', v_update_count
    );

    RAISE WARNING '[update_wallet_transaction_status] ❌ Update failed: % (code: %)',
      v_error_message, v_error_code;

    -- Log failed attempt
    INSERT INTO wallet_status_update_audit (
      wallet_transaction_id, old_status, new_status, success,
      error_code, error_message, error_details, triggered_by, user_id, metadata
    ) VALUES (
      p_wallet_transaction_id, v_old_status, p_new_status, false,
      v_error_code, v_error_message, v_error_details, p_triggered_by, v_user_id, p_metadata
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to update wallet transaction status',
      'error_code', v_error_code,
      'error_message', v_error_message,
      'error_details', v_error_details,
      'old_status', v_old_status,
      'attempted_new_status', p_new_status
    );
  END;
END;
$$;

-- =====================================================
-- HEALTH CHECK FUNCTION FOR STUCK TRANSACTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION check_stuck_wallet_transactions(
  p_age_minutes integer DEFAULT 10
)
RETURNS TABLE (
  wallet_transaction_id uuid,
  user_id uuid,
  amount numeric,
  status text,
  created_at timestamptz,
  minutes_stuck integer,
  payment_transaction_status text,
  can_auto_fix boolean,
  fix_reason text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH stuck_transactions AS (
    SELECT
      wt.id as wallet_transaction_id,
      wt.user_id,
      wt.amount,
      wt.status,
      wt.created_at,
      EXTRACT(EPOCH FROM (NOW() - wt.created_at)) / 60 AS minutes_stuck,
      pt.status as payment_transaction_status,
      wt.payment_transaction_id,
      wt.metadata
    FROM wallet_transactions wt
    LEFT JOIN payment_transactions pt ON pt.id = wt.payment_transaction_id
    WHERE wt.status IN ('pending', 'processing')
      AND wt.transaction_type = 'topup'
      AND wt.created_at < NOW() - (p_age_minutes || ' minutes')::interval
  )
  SELECT
    st.wallet_transaction_id,
    st.user_id,
    st.amount,
    st.status,
    st.created_at,
    st.minutes_stuck::integer,
    st.payment_transaction_status,
    CASE
      WHEN st.payment_transaction_status IN ('completed', 'success') THEN true
      WHEN st.payment_transaction_status = 'paid' THEN true
      ELSE false
    END as can_auto_fix,
    CASE
      WHEN st.payment_transaction_status IN ('completed', 'success', 'paid')
        THEN 'Payment confirmed but wallet status not updated'
      WHEN st.payment_transaction_status = 'failed'
        THEN 'Payment failed - should mark as failed'
      WHEN st.payment_transaction_status IS NULL
        THEN 'No payment transaction found'
      ELSE 'Payment status: ' || COALESCE(st.payment_transaction_status, 'unknown')
    END as fix_reason
  FROM stuck_transactions st
  ORDER BY st.created_at ASC;
END;
$$;

-- =====================================================
-- AUTO-FIX FUNCTION FOR STUCK TRANSACTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION auto_fix_stuck_wallet_transactions(
  p_age_minutes integer DEFAULT 10,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_stuck_count integer := 0;
  v_fixed_count integer := 0;
  v_failed_count integer := 0;
  v_transaction_record RECORD;
  v_fix_result jsonb;
  v_results jsonb[] := ARRAY[]::jsonb[];
BEGIN
  RAISE NOTICE '[auto_fix_stuck_wallet_transactions] Starting auto-fix (dry_run: %, age: % minutes)',
    p_dry_run, p_age_minutes;

  -- Get all stuck transactions that can be auto-fixed
  FOR v_transaction_record IN
    SELECT * FROM check_stuck_wallet_transactions(p_age_minutes)
    WHERE can_auto_fix = true
  LOOP
    v_stuck_count := v_stuck_count + 1;

    RAISE NOTICE '[auto_fix] Found stuck transaction: % (user: %, amount: RM%, stuck for: % min)',
      v_transaction_record.wallet_transaction_id,
      v_transaction_record.user_id,
      v_transaction_record.amount,
      v_transaction_record.minutes_stuck;

    IF NOT p_dry_run THEN
      -- Attempt to fix the transaction
      v_fix_result := update_wallet_transaction_status(
        v_transaction_record.wallet_transaction_id,
        'success',
        'health_check_auto_fix',
        jsonb_build_object(
          'auto_fixed', true,
          'stuck_for_minutes', v_transaction_record.minutes_stuck,
          'payment_status', v_transaction_record.payment_transaction_status,
          'fix_reason', v_transaction_record.fix_reason
        )
      );

      IF (v_fix_result->>'success')::boolean = true THEN
        v_fixed_count := v_fixed_count + 1;
        RAISE NOTICE '[auto_fix] ✅ Fixed transaction: %', v_transaction_record.wallet_transaction_id;
      ELSE
        v_failed_count := v_failed_count + 1;
        RAISE WARNING '[auto_fix] ❌ Failed to fix transaction: % - %',
          v_transaction_record.wallet_transaction_id,
          v_fix_result->>'error_message';
      END IF;

      v_results := array_append(v_results,
        jsonb_build_object(
          'transaction_id', v_transaction_record.wallet_transaction_id,
          'user_id', v_transaction_record.user_id,
          'amount', v_transaction_record.amount,
          'fix_result', v_fix_result
        )
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'stuck_count', v_stuck_count,
    'fixed_count', v_fixed_count,
    'failed_count', v_failed_count,
    'transactions', v_results,
    'timestamp', NOW()
  );
END;
$$;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_wallet_transaction_status TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_stuck_wallet_transactions TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auto_fix_stuck_wallet_transactions TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE wallet_status_update_audit IS
  'Audit trail for all wallet_transactions status update attempts. Tracks success/failure for forensic analysis.';

COMMENT ON FUNCTION update_wallet_transaction_status IS
  'Atomic function to update wallet_transaction status with comprehensive error handling, idempotency, and audit logging. SECURITY DEFINER ensures it always works regardless of RLS.';

COMMENT ON FUNCTION check_stuck_wallet_transactions IS
  'Health check function that identifies wallet transactions stuck in pending/processing status for longer than specified minutes. Returns list with auto-fix recommendations.';

COMMENT ON FUNCTION auto_fix_stuck_wallet_transactions IS
  'Automatically fixes stuck wallet transactions where payment is confirmed. Supports dry-run mode for safety. Logs all attempts to audit trail.';

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Wallet status update system installed successfully';
  RAISE NOTICE '   - Audit trail table created';
  RAISE NOTICE '   - Atomic update function ready';
  RAISE NOTICE '   - Health check functions available';
  RAISE NOTICE '   - Auto-fix mechanism enabled';
END $$;
