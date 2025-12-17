/*
  # Disable RLS for Tables Created After Initial RLS Disable

  ## Overview
  This migration disables Row Level Security on tables that were created
  after the initial RLS disable migration (20251107125836). These tables
  have RLS enabled by default, which prevents the custom localStorage-based
  authentication system from working properly.

  ## Tables Affected

  ### Voucher System Tables
  - user_vouchers - User-specific voucher instances
  - voucher_auto_rules - Automatic voucher issuance rules
  - voucher_redemptions - Voucher usage tracking

  ### Stamps System Tables
  - stamps_tracking - User stamps progress
  - stamps_history - Historical stamp records
  - stamps_redemptions - Stamp redemption records

  ### Admin & Staff Tables
  - admin_users - CMS admin accounts
  - admin_permissions - Admin role permissions
  - admin_activity_logs - Admin action audit trail
  - staff_passcodes - Staff authentication
  - staff_scan_logs - Staff QR scan logs
  - staff_redemption_logs - Staff redemption activity

  ### Order Management Tables
  - order_item_redemptions - Individual item redemptions

  ### Facilities & Configuration Tables
  - outlet_facilities - Outlet amenities and features
  - categories - Product category definitions
  - product_outlets - Product availability per outlet
  - wallet_topup_packages - W Balance topup options

  ## Security Note
  This is for DEVELOPMENT ONLY. RLS should be properly configured with
  appropriate policies before production deployment.

  ## Dependencies
  - Requires all affected tables to exist
  - Uses IF EXISTS to prevent errors if tables don't exist
*/

-- =====================================================
-- VOUCHER SYSTEM TABLES
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_vouchers') THEN
    ALTER TABLE user_vouchers DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on user_vouchers';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'voucher_auto_rules') THEN
    ALTER TABLE voucher_auto_rules DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on voucher_auto_rules';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'voucher_redemptions') THEN
    ALTER TABLE voucher_redemptions DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on voucher_redemptions';
  END IF;
END $$;

-- =====================================================
-- STAMPS SYSTEM TABLES
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'stamps_tracking') THEN
    ALTER TABLE stamps_tracking DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on stamps_tracking';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'stamps_history') THEN
    ALTER TABLE stamps_history DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on stamps_history';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'stamps_redemptions') THEN
    ALTER TABLE stamps_redemptions DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on stamps_redemptions';
  END IF;
END $$;

-- =====================================================
-- ADMIN & STAFF TABLES
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'admin_users') THEN
    ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on admin_users';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'admin_permissions') THEN
    ALTER TABLE admin_permissions DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on admin_permissions';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'admin_activity_logs') THEN
    ALTER TABLE admin_activity_logs DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on admin_activity_logs';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'staff_passcodes') THEN
    ALTER TABLE staff_passcodes DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on staff_passcodes';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'staff_scan_logs') THEN
    ALTER TABLE staff_scan_logs DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on staff_scan_logs';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'staff_redemption_logs') THEN
    ALTER TABLE staff_redemption_logs DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on staff_redemption_logs';
  END IF;
END $$;

-- =====================================================
-- ORDER MANAGEMENT TABLES
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'order_item_redemptions') THEN
    ALTER TABLE order_item_redemptions DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on order_item_redemptions';
  END IF;
END $$;

-- =====================================================
-- FACILITIES & CONFIGURATION TABLES
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'outlet_facilities') THEN
    ALTER TABLE outlet_facilities DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on outlet_facilities';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'categories') THEN
    ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on categories';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'product_outlets') THEN
    ALTER TABLE product_outlets DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on product_outlets';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'wallet_topup_packages') THEN
    ALTER TABLE wallet_topup_packages DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on wallet_topup_packages';
  END IF;
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS DISABLE MIGRATION COMPLETED';
  RAISE NOTICE 'All new tables now have RLS disabled';
  RAISE NOTICE 'for development environment';
  RAISE NOTICE '========================================';
END $$;