/*
  # Add User Registration Fields

  1. Changes
    - Add `country` column to users table
    - Add `zipcode` column to users table
    - Add `state` column to users table (for Malaysia states)
    - Add `password_hash` column to users table
    - Add `terms_accepted` column to users table
    - Add `pdpa_accepted` column to users table
    - Add `country_code` column for phone numbers
  
  2. Notes
    - All fields are optional except terms_accepted and pdpa_accepted for new signups
    - Password will be hashed before storage
*/

-- Add new columns to users table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'country'
  ) THEN
    ALTER TABLE users ADD COLUMN country text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'zipcode'
  ) THEN
    ALTER TABLE users ADD COLUMN zipcode text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'state'
  ) THEN
    ALTER TABLE users ADD COLUMN state text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE users ADD COLUMN password_hash text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'terms_accepted'
  ) THEN
    ALTER TABLE users ADD COLUMN terms_accepted boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'pdpa_accepted'
  ) THEN
    ALTER TABLE users ADD COLUMN pdpa_accepted boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'country_code'
  ) THEN
    ALTER TABLE users ADD COLUMN country_code text DEFAULT '+60';
  END IF;
END $$;