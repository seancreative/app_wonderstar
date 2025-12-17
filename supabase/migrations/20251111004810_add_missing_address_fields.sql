/*
  # Add Missing Address Fields to Users Table

  1. New Columns
    - address: Full street address
    - city: City name
    - postcode: Postal code (in addition to existing zipcode)

  2. Important Notes
    - These fields are required for payment gateway integration
    - All fields are optional to avoid breaking existing records
*/

-- Add address column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'address'
  ) THEN
    ALTER TABLE users ADD COLUMN address text;
  END IF;
END $$;

-- Add city column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'city'
  ) THEN
    ALTER TABLE users ADD COLUMN city text;
  END IF;
END $$;

-- Add postcode column if it doesn't exist (in addition to zipcode for compatibility)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'postcode'
  ) THEN
    ALTER TABLE users ADD COLUMN postcode text;
  END IF;
END $$;

-- Sync existing zipcode data to postcode for consistency
UPDATE users 
SET postcode = zipcode 
WHERE zipcode IS NOT NULL AND postcode IS NULL;