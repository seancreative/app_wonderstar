/*
  # Fix Wallet Transaction Status System

  ## Problem
  Wallet transactions were being created with status only in metadata JSON field.
  The balance calculation counted ALL transactions regardless of payment success.
  This caused issues where money appeared before payment was confirmed, or didn't
  appear after successful payment.

  ## Solution
  1. Add a proper `status` column directly to wallet_transactions table
  2. Migrate existing status data from metadata to the new column
  3. Update balance calculation to only count 'success' status transactions
  4. Create trigger to auto-sync wallet transaction status with payment transaction status

  ## Changes
  1. **wallet_transactions table**
     - Add `status` column with check constraint
     - Default value: 'pending'
     - Valid values: 'pending', 'processing', 'success', 'failed', 'cancelled'
     - Migrate existing data from metadata to status column

  2. **Trigger function**
     - Auto-update wallet_transaction status when payment_transaction status changes
     - Ensures data consistency between payment and wallet transactions

  3. **Helper function**
     - Function to manually reconcile stuck transactions
     - Useful for admin operations

  ## Security
  - RLS remains disabled (following project pattern)
*/

-- =====================================================
-- ADD STATUS COLUMN TO WALLET_TRANSACTIONS
-- =====================================================

-- Add status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallet_transactions' AND column_name = 'status'
  ) THEN
    -- Add the column with a default value
    ALTER TABLE wallet_transactions
    ADD COLUMN status text NOT NULL DEFAULT 'pending';

    -- Add check constraint for valid status values
    ALTER TABLE wallet_transactions
    ADD CONSTRAINT valid_wallet_transaction_status
    CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled'));

    -- Create index for better query performance
    CREATE INDEX idx_wallet_transactions_status ON wallet_transactions(status);

    RAISE NOTICE 'Added status column to wallet_transactions';
  ELSE
    RAISE NOTICE 'Status column already exists in wallet_transactions';
  END IF;
END $$;

-- =====================================================
-- MIGRATE EXISTING STATUS DATA FROM METADATA
-- =====================================================

-- Update existing records to extract status from metadata
-- If no status in metadata, check if there's a linked payment transaction
DO $$
BEGIN
  -- First, update records that have status in metadata
  UPDATE wallet_transactions
  SET status = COALESCE(
    (metadata->>'status')::text,
    'pending'
  )
  WHERE status = 'pending'
    AND metadata IS NOT NULL
    AND metadata->>'status' IS NOT NULL;

  -- Second, update records linked to successful payment transactions
  UPDATE wallet_transactions wt
  SET status = 'success'
  FROM payment_transactions pt
  WHERE wt.payment_transaction_id = pt.id
    AND pt.status = 'success'
    AND wt.status = 'pending';

  -- Third, update records linked to failed payment transactions
  UPDATE wallet_transactions wt
  SET status = 'failed'
  FROM payment_transactions pt
  WHERE wt.payment_transaction_id = pt.id
    AND pt.status = 'failed'
    AND wt.status = 'pending';

  -- Fourth, update records linked to cancelled payment transactions
  UPDATE wallet_transactions wt
  SET status = 'cancelled'
  FROM payment_transactions pt
  WHERE wt.payment_transaction_id = pt.id
    AND pt.status = 'cancelled'
    AND wt.status = 'pending';

  RAISE NOTICE 'Migrated status data from metadata to status column';
END $$;

-- =====================================================
-- CREATE TRIGGER TO SYNC WALLET AND PAYMENT STATUS
-- =====================================================

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS sync_wallet_transaction_status ON payment_transactions;
DROP FUNCTION IF EXISTS sync_wallet_transaction_status();

-- Create trigger function to update wallet transaction status
CREATE OR REPLACE FUNCTION sync_wallet_transaction_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status has changed and there's a linked wallet transaction
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.wallet_transaction_id IS NOT NULL THEN

    -- Update the linked wallet transaction status
    UPDATE wallet_transactions
    SET
      status = NEW.status,
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{status}',
        to_jsonb(NEW.status),
        true
      )
    WHERE id = NEW.wallet_transaction_id;

    -- Log the sync
    RAISE NOTICE 'Synced wallet transaction % status to %', NEW.wallet_transaction_id, NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires after payment transaction status update
CREATE TRIGGER sync_wallet_transaction_status
  AFTER UPDATE OF status ON payment_transactions
  FOR EACH ROW
  WHEN (NEW.wallet_transaction_id IS NOT NULL)
  EXECUTE FUNCTION sync_wallet_transaction_status();

-- =====================================================
-- HELPER FUNCTION FOR MANUAL RECONCILIATION
-- =====================================================

-- Function to manually reconcile a wallet transaction with its payment
CREATE OR REPLACE FUNCTION reconcile_wallet_transaction(
  p_wallet_transaction_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_wallet_tx wallet_transactions;
  v_payment_tx payment_transactions;
  v_result jsonb;
BEGIN
  -- Get wallet transaction
  SELECT * INTO v_wallet_tx
  FROM wallet_transactions
  WHERE id = p_wallet_transaction_id;

  IF v_wallet_tx.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Wallet transaction not found'
    );
  END IF;

  -- Get linked payment transaction
  IF v_wallet_tx.payment_transaction_id IS NOT NULL THEN
    SELECT * INTO v_payment_tx
    FROM payment_transactions
    WHERE id = v_wallet_tx.payment_transaction_id;

    IF v_payment_tx.id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Linked payment transaction not found'
      );
    END IF;

    -- Sync status from payment to wallet
    UPDATE wallet_transactions
    SET
      status = v_payment_tx.status,
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{reconciled_at}',
        to_jsonb(now()),
        true
      )
    WHERE id = p_wallet_transaction_id;

    RETURN jsonb_build_object(
      'success', true,
      'wallet_transaction_id', v_wallet_tx.id,
      'payment_transaction_id', v_payment_tx.id,
      'old_status', v_wallet_tx.status,
      'new_status', v_payment_tx.status
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No linked payment transaction'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION TO CLEANUP ABANDONED TRANSACTIONS
-- =====================================================

-- Function to mark old pending transactions as cancelled
CREATE OR REPLACE FUNCTION cleanup_abandoned_wallet_transactions(
  p_hours_threshold integer DEFAULT 24
)
RETURNS jsonb AS $$
DECLARE
  v_updated_count integer;
BEGIN
  -- Mark transactions as cancelled if they've been pending for too long
  WITH updated AS (
    UPDATE wallet_transactions
    SET
      status = 'cancelled',
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{cancelled_reason}',
        '"abandoned_timeout"'::jsonb,
        true
      )
    WHERE status = 'pending'
      AND created_at < now() - (p_hours_threshold || ' hours')::interval
    RETURNING id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  RETURN jsonb_build_object(
    'success', true,
    'cancelled_count', v_updated_count,
    'hours_threshold', p_hours_threshold
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================

-- Query to check wallet transactions status distribution
COMMENT ON TABLE wallet_transactions IS 'Wallet transaction status: pending (awaiting payment), processing (payment in progress), success (payment confirmed), failed (payment failed), cancelled (payment cancelled or abandoned)';

-- Create a view for easy balance checking
CREATE OR REPLACE VIEW user_wallet_balances AS
SELECT
  user_id,
  SUM(CASE WHEN transaction_type = 'topup' AND status = 'success' THEN amount ELSE 0 END) as total_topups,
  SUM(CASE WHEN transaction_type = 'topup' AND status = 'success' THEN bonus_amount ELSE 0 END) as total_bonus,
  SUM(CASE WHEN transaction_type = 'spend' AND status = 'success' THEN amount ELSE 0 END) as total_spent,
  SUM(CASE WHEN transaction_type = 'bonus' AND status = 'success' THEN bonus_amount ELSE 0 END) as additional_bonus,
  -- Calculate main balance (topups - spends)
  SUM(CASE
    WHEN transaction_type = 'topup' AND status = 'success' THEN amount
    WHEN transaction_type = 'spend' AND status = 'success' THEN amount
    ELSE 0
  END) as main_balance,
  -- Calculate bonus balance
  SUM(CASE
    WHEN transaction_type IN ('topup', 'bonus') AND status = 'success' THEN bonus_amount
    ELSE 0
  END) as bonus_balance,
  -- Total balance
  SUM(CASE
    WHEN transaction_type = 'topup' AND status = 'success' THEN amount + bonus_amount
    WHEN transaction_type = 'spend' AND status = 'success' THEN amount
    WHEN transaction_type = 'bonus' AND status = 'success' THEN bonus_amount
    ELSE 0
  END) as total_balance,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_transactions_count
FROM wallet_transactions
GROUP BY user_id;

COMMENT ON VIEW user_wallet_balances IS 'Real-time wallet balances calculated from successful transactions only';
