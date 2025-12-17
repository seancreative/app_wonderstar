/*
  # Fix Modifier Options - Add Missing is_available Column

  1. Changes
    - Add `is_available` column to `modifier_options` table
    - This column is required by the application code but was missing from the schema
    - Default value is `true` for all existing and new options

  2. Impact
    - Fixes the bug where modifier options were not being saved
    - The save code was trying to insert `is_available: true` which failed silently
    - All existing options will be marked as available by default
*/

-- Add the missing is_available column
ALTER TABLE modifier_options 
ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT true NOT NULL;

-- Update any existing NULL values to true (shouldn't be any, but just in case)
UPDATE modifier_options 
SET is_available = true 
WHERE is_available IS NULL;
