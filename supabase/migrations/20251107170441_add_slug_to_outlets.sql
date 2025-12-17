/*
  # Add slug column to outlets table

  1. Schema Changes
    - Add `slug` column to outlets table
    - Generate slugs from existing location values
    - Add unique constraint on slug

  2. Notes
    - Slugs are URL-friendly versions of location names
    - Existing outlets will have slugs auto-generated
*/

-- Add slug column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'outlets' AND column_name = 'slug'
  ) THEN
    ALTER TABLE outlets ADD COLUMN slug text;
  END IF;
END $$;

-- Generate slugs for existing outlets from location
UPDATE outlets 
SET slug = lower(regexp_replace(location, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Add unique constraint on slug
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'outlets_slug_key'
  ) THEN
    ALTER TABLE outlets ADD CONSTRAINT outlets_slug_key UNIQUE (slug);
  END IF;
END $$;

-- Create index on slug
CREATE INDEX IF NOT EXISTS idx_outlets_slug ON outlets(slug);
