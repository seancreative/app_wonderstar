/*
  # Add Payment Error Tracking Fields

  ## Overview
  This migration adds error tracking fields to the payment_transactions table
  to capture detailed error information from Fiuu payment gateway for debugging
  and customer support purposes.

  ## New Columns

  1. **error_code** (text)
     - Stores structured error code from Fiuu API or internal error classification
     - Examples: 'FIUU_TIMEOUT', 'INVALID_CARD', 'NETWORK_ERROR', 'GATEWAY_ERROR'
     - Makes it easier to categorize and filter payment errors in CMS

  2. **error_details** (jsonb)
     - Stores additional error metadata and context
     - Can include: error timestamp, user info, payment method, amount, etc.
     - Flexible structure for comprehensive error debugging

  ## Updates
  - Existing error_message column remains for human-readable error descriptions
  - These fields are optional and only populated when errors occur
  - No existing data is modified

  ## Security
  - RLS remains disabled for development (following existing pattern)
  - No RLS policies added to maintain consistency with existing setup
*/

-- =====================================================
-- ADD ERROR TRACKING COLUMNS
-- =====================================================
DO $$
BEGIN
  -- Add error_code column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_transactions' AND column_name = 'error_code'
  ) THEN
    ALTER TABLE payment_transactions ADD COLUMN error_code text;
    CREATE INDEX IF NOT EXISTS idx_payment_transactions_error_code ON payment_transactions(error_code);
  END IF;

  -- Add error_details column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_transactions' AND column_name = 'error_details'
  ) THEN
    ALTER TABLE payment_transactions ADD COLUMN error_details jsonb DEFAULT '{}';
  END IF;
END $$;

-- =====================================================
-- HELPER FUNCTION: Log Payment Error
-- =====================================================
CREATE OR REPLACE FUNCTION log_payment_error(
  p_transaction_id uuid,
  p_error_code text,
  p_error_message text,
  p_error_details jsonb DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  UPDATE payment_transactions
  SET
    status = 'failed',
    error_code = p_error_code,
    error_message = p_error_message,
    error_details = p_error_details,
    updated_at = now(),
    completed_at = now()
  WHERE id = p_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- HELPER FUNCTION: Get Recent Payment Errors
-- =====================================================
CREATE OR REPLACE FUNCTION get_recent_payment_errors(
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  transaction_id uuid,
  order_id text,
  user_id uuid,
  amount decimal,
  payment_method text,
  error_code text,
  error_message text,
  error_details jsonb,
  created_at timestamptz,
  completed_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pt.id,
    pt.order_id,
    pt.user_id,
    pt.amount,
    pt.payment_method,
    pt.error_code,
    pt.error_message,
    pt.error_details,
    pt.created_at,
    pt.completed_at
  FROM payment_transactions pt
  WHERE pt.status = 'failed' AND pt.error_code IS NOT NULL
  ORDER BY pt.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
