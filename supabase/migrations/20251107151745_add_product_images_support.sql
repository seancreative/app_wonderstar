/*
  # Add Product Images Support

  1. Schema Changes
    - Add `images` column to `shop_products` table
      - Array of image URLs for product gallery/slider
    - Add `primary_image` column to `shop_products` table
      - Single URL for main product display
  
  2. Storage Setup
    - Create storage bucket for product images
    - Set up public read access policy
  
  3. Notes
    - Existing products will have NULL images (will fall back to emoji display)
    - Images array supports multiple photos for slider functionality
    - Primary image is used as the main display/thumbnail
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_products' AND column_name = 'images'
  ) THEN
    ALTER TABLE shop_products ADD COLUMN images text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_products' AND column_name = 'primary_image'
  ) THEN
    ALTER TABLE shop_products ADD COLUMN primary_image text;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');