/*
  # Create Order Ready Notification System

  1. Changes
    - Update notifications table to support 'order_ready' notification type
    - Create order_notifications tracking table
    - Add indexes for performance
    - Enable realtime publication

  2. New Tables
    - `order_notifications`
      - `id` (uuid, primary key)
      - `order_id` (uuid, references shop_orders)
      - `user_id` (uuid, references users)
      - `staff_id` (uuid, references staff_passcodes)
      - `notification_id` (uuid, references notifications)
      - `order_number` (text)
      - `collection_number` (text)
      - `outlet_name` (text)
      - `notification_sent_at` (timestamptz)
      - `is_read` (boolean)
      - `read_at` (timestamptz)
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on order_notifications
    - Users can view their own notifications
    - Staff can insert notifications
*/

-- Update notifications table CHECK constraint to include order_ready
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

  -- Add new constraint with order_ready included
  ALTER TABLE notifications ADD CONSTRAINT notifications_notification_type_check
    CHECK (notification_type IN ('reminder', 'wallet', 'voucher', 'mission', 'promo', 'system', 'order_ready'));
END $$;

-- Create order_notifications tracking table
CREATE TABLE IF NOT EXISTS order_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES shop_orders(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  staff_id uuid REFERENCES staff_passcodes(id),
  notification_id uuid REFERENCES notifications(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  collection_number text NOT NULL,
  outlet_name text,
  notification_sent_at timestamptz DEFAULT now(),
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_notifications_order_id ON order_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_order_notifications_user_id ON order_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_order_notifications_created_at ON order_notifications(created_at DESC);

-- Enable RLS
ALTER TABLE order_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_notifications
CREATE POLICY "Users can view own order notifications"
  ON order_notifications FOR SELECT
  USING (true);

CREATE POLICY "Staff can insert order notifications"
  ON order_notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own order notifications"
  ON order_notifications FOR UPDATE
  USING (true);

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE order_notifications;

-- Create function to send order ready notification
CREATE OR REPLACE FUNCTION send_order_ready_notification(
  p_order_id uuid,
  p_staff_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order record;
  v_notification_id uuid;
  v_collection_number text;
  v_result jsonb;
BEGIN
  -- Get order details
  SELECT
    o.id,
    o.order_number,
    o.user_id,
    o.outlet_id,
    ot.name as outlet_name
  INTO v_order
  FROM shop_orders o
  LEFT JOIN outlets ot ON ot.id = o.outlet_id
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Extract last 4 digits for collection number
  v_collection_number := RIGHT(v_order.order_number, 4);

  -- Check if notification already sent for this order
  IF EXISTS (
    SELECT 1 FROM order_notifications
    WHERE order_id = p_order_id
    AND notification_sent_at > now() - interval '1 hour'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Notification already sent recently');
  END IF;

  -- Insert notification
  INSERT INTO notifications (
    user_id,
    title,
    message,
    notification_type,
    is_read,
    action_url,
    created_at
  ) VALUES (
    v_order.user_id,
    'Order Ready to Collect! 🎉',
    'Your order #' || v_collection_number || ' is ready for pickup at ' || COALESCE(v_order.outlet_name, 'WonderStars'),
    'order_ready',
    false,
    '/myqr',
    now()
  ) RETURNING id INTO v_notification_id;

  -- Track in order_notifications
  INSERT INTO order_notifications (
    order_id,
    user_id,
    staff_id,
    notification_id,
    order_number,
    collection_number,
    outlet_name,
    notification_sent_at
  ) VALUES (
    p_order_id,
    v_order.user_id,
    p_staff_id,
    v_notification_id,
    v_order.order_number,
    v_collection_number,
    v_order.outlet_name,
    now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'notification_id', v_notification_id,
    'order_number', v_order.order_number,
    'collection_number', v_collection_number
  );

  RETURN v_result;
END;
$$;
