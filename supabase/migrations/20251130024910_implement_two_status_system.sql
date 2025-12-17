/*
  # Implement Two-Status System for Orders

  ## Overview
  This migration separates payment tracking from order fulfillment by implementing
  two distinct status fields: payment_status (automated by FIUU) and status (fulfillment workflow).

  ## Changes Made

  1. **Add Payment Status Field**
     - `payment_status` (text) - Tracks payment: 'pending', 'paid', 'failed'
     - `payment_error_code` (text) - Stores FIUU error code for failed payments
     - Default: 'pending'

  2. **Update Fulfillment Status Values**
     - Rename 'pending' → 'waiting_payment'
     - Remove 'confirmed' (merged into payment flow)
     - Keep: 'ready', 'completed', 'cancelled'
     - Add: 'refunded'
     - New constraint: ('waiting_payment', 'ready', 'completed', 'cancelled', 'refunded')

  3. **Add Cancellation Tracking**
     - `cancellation_reason` (text) - Predefined reason for cancellation
     - `cancellation_notes` (text) - Additional notes
     - `cancelled_by` (uuid) - Staff member who cancelled
     - `cancelled_at` (timestamptz) - When cancelled

  4. **Add Refund Tracking**
     - `refund_reason` (text) - Predefined reason for refund
     - `refund_notes` (text) - Additional notes
     - `refunded_by` (uuid) - Staff member who processed refund
     - `refunded_at` (timestamptz) - When refunded

  5. **Backfill Existing Data**
     - Map old status values to new structure
     - Set payment_status based on current status
     - Preserve existing order state

  ## Status Flow

  ### Automated Transitions
  - Order Created: status='waiting_payment', payment_status='pending'
  - Payment Confirmed: status='ready', payment_status='paid'
  - QR Scanned: status='completed', payment_status='paid'

  ### Manual Transitions (Staff)
  - Cancel: Any status → 'cancelled' (with reason)
  - Refund: Any paid status → 'refunded' (with reason)

  ## Notes
  - Payment status is managed exclusively by FIUU payment callbacks
  - Fulfillment status is managed by staff actions and QR scanning
  - All existing orders are migrated to the new structure
*/

-- =====================================================
-- STEP 1: ADD NEW PAYMENT STATUS FIELDS
-- =====================================================

-- Add payment_status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN payment_status text DEFAULT 'pending'
      CHECK (payment_status IN ('pending', 'paid', 'failed'));
  END IF;
END $$;

-- Add payment_error_code column for failed payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'payment_error_code'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN payment_error_code text;
  END IF;
END $$;

-- Create index on payment_status for performance
CREATE INDEX IF NOT EXISTS idx_shop_orders_payment_status ON shop_orders(payment_status);

-- =====================================================
-- STEP 2: ADD CANCELLATION TRACKING FIELDS
-- =====================================================

-- Add cancellation_reason
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'cancellation_reason'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN cancellation_reason text;
  END IF;
END $$;

-- Add cancellation_notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'cancellation_notes'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN cancellation_notes text;
  END IF;
END $$;

-- Add cancelled_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'cancelled_by'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN cancelled_by uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add cancelled_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN cancelled_at timestamptz;
  END IF;
END $$;

-- =====================================================
-- STEP 3: ADD REFUND TRACKING FIELDS
-- =====================================================

-- Add refund_reason
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'refund_reason'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN refund_reason text;
  END IF;
END $$;

-- Add refund_notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'refund_notes'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN refund_notes text;
  END IF;
END $$;

-- Add refunded_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'refunded_by'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN refunded_by uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add refunded_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'refunded_at'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN refunded_at timestamptz;
  END IF;
END $$;

-- =====================================================
-- STEP 4: BACKFILL PAYMENT STATUS FOR EXISTING ORDERS
-- =====================================================

-- Set payment_status based on current status
DO $$
BEGIN
  -- Orders with 'completed' or 'ready' status are paid
  UPDATE shop_orders
  SET payment_status = 'paid'
  WHERE status IN ('completed', 'ready', 'confirmed')
    AND payment_status = 'pending';

  -- Orders with 'cancelled' status might be unpaid or paid
  -- Check if they have payment_transaction_id to determine
  UPDATE shop_orders
  SET payment_status = 'paid'
  WHERE status = 'cancelled'
    AND payment_transaction_id IS NOT NULL
    AND payment_status = 'pending';

  -- Keep 'pending' status as 'pending' payment_status (default)
END $$;

-- =====================================================
-- STEP 5: UPDATE STATUS VALUES (FULFILLMENT)
-- =====================================================

-- First, update existing data to new status values
DO $$
BEGIN
  -- 'pending' becomes 'waiting_payment'
  UPDATE shop_orders
  SET status = 'waiting_payment'
  WHERE status = 'pending';

  -- 'confirmed' becomes 'ready' (payment confirmed, ready for pickup)
  UPDATE shop_orders
  SET status = 'ready'
  WHERE status = 'confirmed';
  
  -- 'ready' stays 'ready'
  -- 'completed' stays 'completed'
  -- 'cancelled' stays 'cancelled'
END $$;

-- Drop old constraint if exists
DO $$
BEGIN
  ALTER TABLE shop_orders DROP CONSTRAINT IF EXISTS shop_orders_status_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Add new constraint with updated values
ALTER TABLE shop_orders ADD CONSTRAINT shop_orders_status_check
  CHECK (status IN ('waiting_payment', 'ready', 'completed', 'cancelled', 'refunded'));

-- =====================================================
-- STEP 6: ADD HELPFUL COMMENTS
-- =====================================================

COMMENT ON COLUMN shop_orders.payment_status IS 'Payment status from FIUU: pending, paid, failed';
COMMENT ON COLUMN shop_orders.payment_error_code IS 'Error code from FIUU if payment failed';
COMMENT ON COLUMN shop_orders.status IS 'Fulfillment status: waiting_payment, ready, completed, cancelled, refunded';
COMMENT ON COLUMN shop_orders.cancellation_reason IS 'Predefined reason for order cancellation';
COMMENT ON COLUMN shop_orders.cancellation_notes IS 'Additional notes about cancellation';
COMMENT ON COLUMN shop_orders.cancelled_by IS 'Staff member who cancelled the order';
COMMENT ON COLUMN shop_orders.cancelled_at IS 'Timestamp when order was cancelled';
COMMENT ON COLUMN shop_orders.refund_reason IS 'Predefined reason for order refund';
COMMENT ON COLUMN shop_orders.refund_notes IS 'Additional notes about refund';
COMMENT ON COLUMN shop_orders.refunded_by IS 'Staff member who processed the refund';
COMMENT ON COLUMN shop_orders.refunded_at IS 'Timestamp when order was refunded';

-- =====================================================
-- STEP 7: CREATE UPDATED ORDER STATUS VIEW
-- =====================================================

CREATE OR REPLACE VIEW order_status_summary AS
SELECT 
  id,
  order_number,
  user_id,
  outlet_id,
  payment_status,
  payment_error_code,
  status as fulfillment_status,
  payment_method,
  total_amount,
  cancellation_reason,
  cancelled_at,
  refund_reason,
  refunded_at,
  created_at,
  completed_at
FROM shop_orders
ORDER BY created_at DESC;

COMMENT ON VIEW order_status_summary IS 'Summary view showing payment status and fulfillment status separately';
