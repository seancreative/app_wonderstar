/*
  # Create Kitchen Item Tracking System

  ## Overview
  This migration creates the internal kitchen tracking system for marking
  F&B order items as prepared. This is completely separate from customer-facing
  order status and is used only by kitchen staff.

  ## Changes Made

  1. **New Table: kitchen_item_tracking**
     - Tracks which items kitchen staff have marked as prepared
     - Internal use only - does not affect customer order status
     - Allows kitchen staff to check off items as they're prepared

  2. **Fields**
     - `id` (uuid, primary key) - Unique identifier
     - `order_id` (uuid, foreign key) - References shop_orders
     - `item_index` (integer) - Index of item in order items JSONB array
     - `is_prepared` (boolean) - Whether item is marked as prepared
     - `prepared_by_staff_id` (uuid) - Staff member who marked item
     - `prepared_at` (timestamptz) - When item was marked prepared
     - `created_at` (timestamptz) - When tracking record was created

  3. **Constraints**
     - UNIQUE constraint on (order_id, item_index) to prevent duplicates
     - Foreign key to shop_orders with CASCADE delete
     - Foreign key to staff_passcodes for tracking staff

  4. **Indexes**
     - Index on order_id for fast lookup by order
     - Index on is_prepared for filtering prepared/unprepared items

  5. **Security**
     - RLS disabled for development (kitchen staff access controlled by KMS auth)
*/

-- =====================================================
-- CREATE KITCHEN ITEM TRACKING TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS kitchen_item_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  item_index integer NOT NULL CHECK (item_index >= 0),
  is_prepared boolean DEFAULT false,
  prepared_by_staff_id uuid REFERENCES staff_passcodes(id) ON DELETE SET NULL,
  prepared_at timestamptz,
  created_at timestamptz DEFAULT now(),

  UNIQUE(order_id, item_index)
);

-- =====================================================
-- CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_kitchen_tracking_order_id
  ON kitchen_item_tracking(order_id);

CREATE INDEX IF NOT EXISTS idx_kitchen_tracking_is_prepared
  ON kitchen_item_tracking(is_prepared);

CREATE INDEX IF NOT EXISTS idx_kitchen_tracking_prepared_by
  ON kitchen_item_tracking(prepared_by_staff_id);

-- =====================================================
-- DISABLE RLS (Kitchen staff access via KMS auth)
-- =====================================================

ALTER TABLE kitchen_item_tracking DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE HELPER FUNCTION TO TOGGLE ITEM PREPARATION
-- =====================================================

CREATE OR REPLACE FUNCTION toggle_kitchen_item_preparation(
  p_order_id uuid,
  p_item_index integer,
  p_staff_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_record kitchen_item_tracking;
  v_result jsonb;
BEGIN
  -- Check if record exists
  SELECT * INTO v_existing_record
  FROM kitchen_item_tracking
  WHERE order_id = p_order_id AND item_index = p_item_index;

  IF v_existing_record IS NULL THEN
    -- Create new record marked as prepared
    INSERT INTO kitchen_item_tracking (
      order_id,
      item_index,
      is_prepared,
      prepared_by_staff_id,
      prepared_at
    ) VALUES (
      p_order_id,
      p_item_index,
      true,
      p_staff_id,
      now()
    )
    RETURNING jsonb_build_object(
      'order_id', order_id,
      'item_index', item_index,
      'is_prepared', is_prepared
    ) INTO v_result;
  ELSE
    -- Toggle existing record
    UPDATE kitchen_item_tracking
    SET
      is_prepared = NOT is_prepared,
      prepared_by_staff_id = CASE
        WHEN NOT is_prepared THEN p_staff_id
        ELSE prepared_by_staff_id
      END,
      prepared_at = CASE
        WHEN NOT is_prepared THEN now()
        ELSE prepared_at
      END
    WHERE order_id = p_order_id AND item_index = p_item_index
    RETURNING jsonb_build_object(
      'order_id', order_id,
      'item_index', item_index,
      'is_prepared', is_prepared
    ) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

-- =====================================================
-- CREATE HELPER FUNCTION TO MARK ALL ITEMS IN ORDER
-- =====================================================

CREATE OR REPLACE FUNCTION mark_all_order_items_prepared(
  p_order_id uuid,
  p_staff_id uuid,
  p_item_count integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_index integer;
  v_inserted_count integer := 0;
BEGIN
  -- Mark all items in the order as prepared
  FOR v_item_index IN 0..(p_item_count - 1) LOOP
    INSERT INTO kitchen_item_tracking (
      order_id,
      item_index,
      is_prepared,
      prepared_by_staff_id,
      prepared_at
    ) VALUES (
      p_order_id,
      v_item_index,
      true,
      p_staff_id,
      now()
    )
    ON CONFLICT (order_id, item_index)
    DO UPDATE SET
      is_prepared = true,
      prepared_by_staff_id = p_staff_id,
      prepared_at = now();

    v_inserted_count := v_inserted_count + 1;
  END LOOP;

  RETURN v_inserted_count;
END;
$$;

-- =====================================================
-- CREATE HELPER FUNCTION TO GET ORDER PREPARATION STATUS
-- =====================================================

CREATE OR REPLACE FUNCTION get_order_preparation_status(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'item_index', item_index,
      'is_prepared', is_prepared,
      'prepared_at', prepared_at
    ) ORDER BY item_index
  )
  INTO v_result
  FROM kitchen_item_tracking
  WHERE order_id = p_order_id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
