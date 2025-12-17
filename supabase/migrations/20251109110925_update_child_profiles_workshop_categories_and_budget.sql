/*
  # Update Child Profiles - Workshop Categories and Budget Preferences

  1. Changes
    - Remove `interested_in_workshops` boolean column
    - Add `workshop_interests` jsonb array for multiple category selections
    - Add `budget_tier` text field for budget preference
    - Add `photo_url` text field for child photo
  
  2. Notes
    - Workshop interests will store an array of selected categories
    - Budget tier stores: 'essential', 'enhanced', 'advanced', 'full', 'none'
    - Photo URL will store the child's profile picture
*/

-- Drop the old interested_in_workshops column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'child_profiles' AND column_name = 'interested_in_workshops'
  ) THEN
    ALTER TABLE child_profiles DROP COLUMN interested_in_workshops;
  END IF;
END $$;

-- Add photo_url column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'child_profiles' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE child_profiles ADD COLUMN photo_url text;
  END IF;
END $$;

-- Add workshop_interests column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'child_profiles' AND column_name = 'workshop_interests'
  ) THEN
    ALTER TABLE child_profiles ADD COLUMN workshop_interests jsonb DEFAULT '[]'::jsonb NOT NULL;
  END IF;
END $$;

-- Add budget_tier column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'child_profiles' AND column_name = 'budget_tier'
  ) THEN
    ALTER TABLE child_profiles ADD COLUMN budget_tier text CHECK (budget_tier IN ('essential', 'enhanced', 'advanced', 'full', 'none'));
  END IF;
END $$;