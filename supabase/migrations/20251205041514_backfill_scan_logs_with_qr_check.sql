/*
  # Backfill Staff Scan Logs from Historical Data

  Populates staff_scan_logs with recent historical activity data.
*/

-- Customer check-ins
INSERT INTO staff_scan_logs (
  scan_type, qr_code, scan_result, customer_id, customer_name,
  stars_awarded, success, scanned_at, metadata
)
SELECT
  'customer'::text,
  'CHECKIN-' || st.user_id,
  'success'::text,
  st.user_id,
  COALESCE(u.name, u.email),
  st.amount,
  true,
  st.created_at,
  jsonb_build_object('source', 'backfill')
FROM stars_transactions st
JOIN users u ON u.id = st.user_id
WHERE 
  st.transaction_type = 'earn'
  AND st.amount > 0
  AND st.created_at > now() - interval '30 days'
  AND NOT EXISTS (
    SELECT 1 FROM staff_scan_logs WHERE customer_id = st.user_id 
    AND abs(extract(epoch from (scanned_at - st.created_at))) < 10
  )
ORDER BY st.created_at DESC
LIMIT 200;

-- Orders (only with QR codes)
INSERT INTO staff_scan_logs (
  scan_type, qr_code, scan_result, order_id, order_number,
  customer_id, outlet_id, outlet_name, success, scanned_at, metadata
)
SELECT
  'order'::text,
  so.qr_code,
  'success'::text,
  so.id,
  so.order_number,
  so.user_id,
  so.outlet_id,
  o.name,
  true,
  COALESCE(so.completed_at, so.created_at),
  jsonb_build_object('source', 'backfill')
FROM shop_orders so
LEFT JOIN outlets o ON o.id = so.outlet_id
WHERE 
  so.qr_code IS NOT NULL
  AND so.status IN ('completed', 'confirmed')
  AND so.created_at > now() - interval '30 days'
  AND NOT EXISTS (SELECT 1 FROM staff_scan_logs WHERE order_id = so.id)
ORDER BY COALESCE(so.completed_at, so.created_at) DESC
LIMIT 150;

-- Rewards
INSERT INTO staff_scan_logs (
  scan_type, qr_code, scan_result, customer_id,
  success, scanned_at, metadata
)
SELECT
  'reward'::text,
  r.qr_code,
  'success'::text,
  r.user_id,
  true,
  r.used_at,
  jsonb_build_object('source', 'backfill', 'action', 'gift_redemption')
FROM redemptions r
WHERE 
  r.used_at IS NOT NULL
  AND r.used_at > now() - interval '30 days'
  AND NOT EXISTS (SELECT 1 FROM staff_scan_logs WHERE qr_code = r.qr_code)
ORDER BY r.used_at DESC
LIMIT 50;

DO $$
DECLARE total int;
BEGIN
  SELECT COUNT(*) INTO total FROM staff_scan_logs;
  RAISE NOTICE 'Scan history backfilled! Total: %', total;
END $$;
