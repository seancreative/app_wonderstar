/*
  # Add Email Fields to Staff Scan Logs

  ## Overview
  Adds staff_email and admin_email columns to staff_scan_logs table to track who performed each scan.
  This ensures scan history displays "Scanned by: email@example.com" for better accountability.

  ## Changes
  1. Add staff_email column for staff scanner users
  2. Add admin_email column for admin CMS users
  3. Create index for email-based queries
  4. Maintains backward compatibility (nullable columns)
*/

-- Add email columns to staff_scan_logs
ALTER TABLE staff_scan_logs
  ADD COLUMN IF NOT EXISTS staff_email text,
  ADD COLUMN IF NOT EXISTS admin_email text;

-- Create index for email-based queries
CREATE INDEX IF NOT EXISTS idx_staff_scan_logs_staff_email
  ON staff_scan_logs(staff_email);

CREATE INDEX IF NOT EXISTS idx_staff_scan_logs_admin_email
  ON staff_scan_logs(admin_email);

-- Add comment
COMMENT ON COLUMN staff_scan_logs.staff_email IS 'Email of staff member who performed the scan';
COMMENT ON COLUMN staff_scan_logs.admin_email IS 'Email of admin user who performed the scan';

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Email Fields Added to Staff Scan Logs!';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Added staff_email column';
  RAISE NOTICE '✓ Added admin_email column';
  RAISE NOTICE '✓ Created indexes for email queries';
  RAISE NOTICE '========================================';
END $$;
