/*
  # Setup Storage Bucket for Product Images
  
  Creates the storage bucket and policies for product image uploads
*/

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policy to allow public read
CREATE POLICY IF NOT EXISTS "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'product-images' );

-- Allow anyone to upload (we'll handle auth in the app)
CREATE POLICY IF NOT EXISTS "Anyone can upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'product-images' );

-- Allow anyone to update their uploads
CREATE POLICY IF NOT EXISTS "Anyone can update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'product-images' );

-- Allow anyone to delete
CREATE POLICY IF NOT EXISTS "Anyone can delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'product-images' );
