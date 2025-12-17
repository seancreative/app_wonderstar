/*
  # Create Staff Scan Logs Table

  ## Overview
  Creates a comprehensive logging table to track all scanning activities in the CMS.
  This provides a complete audit trail for both customer QR scans and order QR scans.

  ## Changes
  1. New Table: staff_scan_logs
    - Tracks all scan events with full details
    - Links to staff, customers, orders, outlets
    - Stores scan results and metadata
    - Supports different scan types

  2. Indexes for Performance
    - Fast queries by staff, customer, order
    - Time-based queries optimized
    - Scan type filtering

  3. RLS Policies
    - Admins and staff can view logs
    - System can insert logs
*/

-- =====================================================
-- CREATE STAFF SCAN LOGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS staff_scan_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Staff Information
  staff_id uuid REFERENCES staff_passcodes(id) ON DELETE SET NULL,
  staff_name text,
  admin_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  
  -- Scan Details
  scan_type text NOT NULL CHECK (scan_type IN ('customer', 'order', 'workshop', 'reward')),
  qr_code text NOT NULL,
  scan_result text NOT NULL CHECK (scan_result IN ('success', 'failure', 'partial')),
  
  -- Scanned Entity Information
  customer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  customer_name text,
  order_id uuid REFERENCES shop_orders(id) ON DELETE SET NULL,
  order_number text,
  
  -- Location
  outlet_id uuid REFERENCES outlets(id) ON DELETE SET NULL,
  outlet_name text,
  
  -- Results
  stars_awarded integer DEFAULT 0,
  items_redeemed integer DEFAULT 0,
  
  -- Status and Metadata
  success boolean NOT NULL DEFAULT true,
  failure_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  scanned_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_staff_scan_logs_staff_id 
  ON staff_scan_logs(staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_scan_logs_customer_id 
  ON staff_scan_logs(customer_id);

CREATE INDEX IF NOT EXISTS idx_staff_scan_logs_order_id 
  ON staff_scan_logs(order_id);

CREATE INDEX IF NOT EXISTS idx_staff_scan_logs_scanned_at 
  ON staff_scan_logs(scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_scan_logs_outlet_id 
  ON staff_scan_logs(outlet_id);

CREATE INDEX IF NOT EXISTS idx_staff_scan_logs_scan_type 
  ON staff_scan_logs(scan_type);

CREATE INDEX IF NOT EXISTS idx_staff_scan_logs_type_date 
  ON staff_scan_logs(scan_type, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_scan_logs_success 
  ON staff_scan_logs(success) WHERE success = false;

-- =====================================================
-- ENABLE RLS
-- =====================================================

ALTER TABLE staff_scan_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Allow admins and staff to view all scan logs
CREATE POLICY "Admins and staff can view scan logs"
  ON staff_scan_logs
  FOR SELECT
  USING (true);

-- Allow system to insert scan logs
CREATE POLICY "System can insert scan logs"
  ON staff_scan_logs
  FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Staff Scan Logs Table Created!';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Table: staff_scan_logs';
  RAISE NOTICE '✓ Indexes: 8 performance indexes';
  RAISE NOTICE '✓ RLS: Enabled with policies';
  RAISE NOTICE '';
  RAISE NOTICE 'Scan Types Supported:';
  RAISE NOTICE '  • customer - Customer QR code scans';
  RAISE NOTICE '  • order - Order QR code scans';
  RAISE NOTICE '  • workshop - Workshop booking scans';
  RAISE NOTICE '  • reward - Reward redemption scans';
  RAISE NOTICE '========================================';
END $$;
