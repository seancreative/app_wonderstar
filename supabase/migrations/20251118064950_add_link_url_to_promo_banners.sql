/*
  # Add link_url to promo_banners table

  1. Changes
    - Add `link_url` column to promo_banners table
      - Stores the clickable link for each banner
      - Defaults to '#' (no action)
      - Allows admins to set custom links for promotional campaigns
    
  2. Notes
    - Existing banners will have link_url set to '#' by default
    - This enables clickable promotional banners with custom destinations
*/

-- Add link_url column to promo_banners table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promo_banners' AND column_name = 'link_url'
  ) THEN
    ALTER TABLE promo_banners ADD COLUMN link_url text NOT NULL DEFAULT '#';
  END IF;
END $$;
