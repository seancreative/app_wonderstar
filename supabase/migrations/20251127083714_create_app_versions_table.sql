/*
  # Create App Versions Table

  ## Overview
  Track application version history with detailed changelogs.

  ## Tables Created
  1. **app_versions**
     - `id` (uuid, primary key)
     - `version` (text, unique) - Version number (e.g., "1.01", "1.02")
     - `release_date` (timestamptz) - When this version was released
     - `title` (text) - Brief title of the update
     - `summary` (text) - Summary of changes
     - `changes` (jsonb) - Detailed list of changes grouped by category
     - `files_modified` (text[]) - Array of file paths that were modified
     - `is_major` (boolean) - Whether this is a major update
     - `created_at` (timestamptz)

  ## Structure of changes JSONB
  ```json
  {
    "features": ["New feature 1", "New feature 2"],
    "fixes": ["Bug fix 1", "Bug fix 2"],
    "improvements": ["Improvement 1", "Improvement 2"],
    "database": ["Schema change 1", "Migration 2"]
  }
  ```

  ## Security
  - Public read access for all users
  - Disable RLS for now (can be enabled later with proper policies)
*/

-- Create app_versions table
CREATE TABLE IF NOT EXISTS app_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text UNIQUE NOT NULL,
  release_date timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  summary text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  files_modified text[] DEFAULT ARRAY[]::text[],
  is_major boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_app_versions_release_date ON app_versions(release_date DESC);
CREATE INDEX IF NOT EXISTS idx_app_versions_version ON app_versions(version);

-- Disable RLS for app_versions (public read access)
ALTER TABLE app_versions DISABLE ROW LEVEL SECURITY;

-- Insert initial version (current state)
INSERT INTO app_versions (version, release_date, title, summary, changes, files_modified, is_major)
VALUES (
  '1.00',
  '2025-11-27T00:00:00Z',
  'Initial Production Release',
  'WonderStars loyalty app with complete feature set including shop, rewards, stamps, and payment system.',
  '{
    "features": [
      "Complete shop system with cart and checkout",
      "W Balance wallet with top-up via Fiuu payment gateway",
      "Stars loyalty points system (25 stars per RM1 spent)",
      "Stamps collection system with rewards",
      "Voucher system with multiple discount types",
      "QR code generation for order redemption",
      "Staff scanner for order fulfillment",
      "CMS dashboard for admin management",
      "Multi-outlet support",
      "User profiles with tier benefits"
    ],
    "fixes": [],
    "improvements": [],
    "database": [
      "Complete database schema with RLS policies",
      "Payment transactions tracking",
      "Order management system",
      "User authentication with Supabase Auth"
    ]
  }'::jsonb,
  ARRAY['Complete application']::text[],
  true
) ON CONFLICT (version) DO NOTHING;

-- Insert today's fixes as version 1.01
INSERT INTO app_versions (version, release_date, title, summary, changes, files_modified, is_major)
VALUES (
  '1.01',
  '2025-11-27T08:00:00Z',
  'Critical Fixes: Payment QR & Staff Management',
  'Fixed three critical issues: CMS staff passcode errors, voucher discount calculation, and QR generation timing.',
  '{
    "fixes": [
      "Fixed CMS staff passcode save errors with detailed error messages",
      "Fixed voucher TEST2025 per-product discount calculation",
      "Fixed QR code generation - now only generates after successful payment"
    ],
    "improvements": [
      "Enhanced error handling in staff creation with pre-validation",
      "Added debug logging for voucher discount calculations",
      "Improved payment flow to prevent QR codes for failed payments"
    ],
    "database": [
      "Added confirmed_at column to shop_orders table"
    ]
  }'::jsonb,
  ARRAY[
    'src/pages/cms/CMSStaff.tsx',
    'src/pages/ShopCart.tsx',
    'src/pages/ShopCheckout.tsx',
    'src/pages/PaymentCallback.tsx',
    'src/pages/MyQR.tsx'
  ]::text[],
  false
) ON CONFLICT (version) DO NOTHING;
