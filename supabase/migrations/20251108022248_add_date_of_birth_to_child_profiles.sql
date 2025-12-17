/*
  # Add Date of Birth to Child Profiles

  1. Changes
    - Add `date_of_birth` column to `child_profiles` table
    - Column is optional (nullable) to maintain backwards compatibility
    - Existing records with age will remain unchanged
    - New records should use date_of_birth instead of age

  2. Notes
    - The age field will be kept for backwards compatibility
    - The application will calculate age from date_of_birth when displaying
    - Date of birth provides more accurate age tracking over time
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'child_profiles' 
    AND column_name = 'date_of_birth'
  ) THEN
    ALTER TABLE child_profiles 
    ADD COLUMN date_of_birth DATE;
  END IF;
END $$;
