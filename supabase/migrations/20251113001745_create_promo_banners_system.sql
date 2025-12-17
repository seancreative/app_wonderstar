/*
  # Create Promo Banners System

  1. New Tables
    - `promo_banners`
      - `id` (uuid, primary key)
      - `image_url` (text) - URL to banner image
      - `title` (text) - Banner title
      - `description` (text) - Banner description
      - `display_order` (integer) - Order to display banners
      - `is_active` (boolean) - Whether banner is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Disable RLS for development (consistent with other tables)
    - Public read access for customers
    - Admin write access via CMS

  3. Initial Data
    - Populate with default banners
*/

-- Create promo_banners table
CREATE TABLE IF NOT EXISTS promo_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL DEFAULT '',
  title text NOT NULL,
  description text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Disable RLS for development (consistent with other tables)
ALTER TABLE promo_banners DISABLE ROW LEVEL SECURITY;

-- Create index for ordering
CREATE INDEX IF NOT EXISTS idx_promo_banners_order ON promo_banners(display_order, is_active);

-- Insert default banners
INSERT INTO promo_banners (title, description, display_order, is_active) VALUES
  ('Weekend Bonus Stars!', 'Earn 2x stars on all activities this weekend', 1, true),
  ('New Workshop Alert!', 'Space Adventure workshop now open for booking', 2, true),
  ('Refer & Earn!', 'Get 100 bonus stars for every friend you refer', 3, true),
  ('Mystery Box Sale!', 'Limited time: 30% off all mystery boxes', 4, true)
ON CONFLICT DO NOTHING;