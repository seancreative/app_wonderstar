/*
  # Add Gender and Workshop Interest Fields to Child Profiles

  1. Changes
    - Add `gender` column to child_profiles table (male, female, or null)
    - Add `interested_in_workshops` column to child_profiles table (boolean, defaults to false)
  
  2. Notes
    - Gender field is optional (nullable) to respect privacy choices
    - Workshop interest is a simple boolean checkbox for marketing preferences
    - Uses IF NOT EXISTS pattern to make migration idempotent
*/

-- Add gender column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'child_profiles' AND column_name = 'gender'
  ) THEN
    ALTER TABLE child_profiles ADD COLUMN gender text CHECK (gender IN ('male', 'female'));
  END IF;
END $$;

-- Add interested_in_workshops column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'child_profiles' AND column_name = 'interested_in_workshops'
  ) THEN
    ALTER TABLE child_profiles ADD COLUMN interested_in_workshops boolean DEFAULT false NOT NULL;
  END IF;
END $$;