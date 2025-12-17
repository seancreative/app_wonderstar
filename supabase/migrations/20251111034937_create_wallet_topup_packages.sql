/*
  # Create Wallet Top-up Packages System

  1. New Tables
    - `wallet_topup_packages`
      - `id` (uuid, primary key)
      - `amount` (decimal) - The money amount in RM
      - `bonus_points` (integer) - Extra loyalty points earned
      - `display_order` (integer) - Sort order
      - `is_active` (boolean) - Whether package is available
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `wallet_topup_packages` table
    - Add policy for authenticated users to read active packages

  3. Data
    - Insert 7 default topup packages with bonus points
*/

-- Create wallet_topup_packages table
CREATE TABLE IF NOT EXISTS wallet_topup_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount decimal(10,2) NOT NULL,
  bonus_points integer NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE wallet_topup_packages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view active topup packages"
  ON wallet_topup_packages
  FOR SELECT
  USING (is_active = true);

-- Insert default topup packages
INSERT INTO wallet_topup_packages (amount, bonus_points, display_order, is_active) VALUES
  (1.00, 1, 1, true),
  (5.00, 5, 2, true),
  (10.00, 10, 3, true),
  (25.00, 25, 4, true),
  (50.00, 50, 5, true),
  (100.00, 115, 6, true),
  (200.00, 240, 7, true)
ON CONFLICT DO NOTHING;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_wallet_topup_packages_active ON wallet_topup_packages(is_active, display_order);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_wallet_topup_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallet_topup_packages_updated_at
  BEFORE UPDATE ON wallet_topup_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_topup_packages_updated_at();
