/*
  # Fix Product Images Storage Policies
  
  Updates the storage policies for the product-images bucket to allow uploads from anyone.
  This is needed for the CMS to upload product images.
  
  ## Changes
  - Drop existing restrictive policies for product-images bucket
  - Create new permissive policies allowing public access for INSERT, UPDATE, DELETE
*/

-- Drop existing policies for product-images
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for product images" ON storage.objects;

-- Create new permissive policies for product-images bucket
CREATE POLICY "Public read product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

CREATE POLICY "Anyone can upload product images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Anyone can update product images"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Anyone can delete product images"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'product-images');
