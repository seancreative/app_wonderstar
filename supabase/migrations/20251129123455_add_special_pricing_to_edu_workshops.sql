/*
  # Add Special Pricing to EDU Workshops

  1. Purpose
    - Add special pricing functionality to edu_workshops table
    - Enable promotional pricing with normal price strikethrough on frontend
    - Maintain backward compatibility with existing workshops

  2. Changes
    - Add `special_price` column (numeric, nullable) for discounted price
    - Add `has_special_price` column (boolean) to flag special pricing
    - Keep existing `event_price` as normal/regular price
    - Add index for performance on is_active

  3. Notes
    - Special price is optional
    - If has_special_price = true, frontend shows strikethrough on event_price
    - Existing workshops default to no special pricing
*/

-- Add special pricing fields
ALTER TABLE edu_workshops 
  ADD COLUMN IF NOT EXISTS special_price DECIMAL(10, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS has_special_price BOOLEAN DEFAULT false;

-- Add index for better performance on active workshops
CREATE INDEX IF NOT EXISTS idx_edu_workshops_active_order 
  ON edu_workshops(is_active, display_order);

-- Add index for created_at for timestamp queries
CREATE INDEX IF NOT EXISTS idx_edu_workshops_created_at 
  ON edu_workshops(created_at DESC);

-- Add comment for documentation
COMMENT ON COLUMN edu_workshops.special_price IS 'Optional discounted price - if set, normal price (event_price) shows as strikethrough';
COMMENT ON COLUMN edu_workshops.has_special_price IS 'Flag to indicate if special pricing is active';
