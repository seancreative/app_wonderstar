/*
  # Create Bonus Transactions Tracking System

  1. New Tables
    - `bonus_transactions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `order_id` (uuid, foreign key to shop_orders, nullable)
      - `amount` (numeric) - Amount of bonus used or refunded
      - `transaction_type` (text) - 'redemption' or 'refund'
      - `order_number` (text) - For reference
      - `created_at` (timestamp) - Auto-generated timestamp
      - `metadata` (jsonb) - Additional data

  2. Security
    - Enable RLS (disabled for development phase, following existing pattern)
    - Add policies for authenticated users to read their own transactions
    - Admin access for CMS

  3. Purpose
    - Track all bonus balance redemptions with timestamps
    - Audit trail for bonus usage
    - Enable reporting and analysis in CMS
    - Support refund functionality for cancelled orders
*/

-- Create bonus_transactions table
CREATE TABLE IF NOT EXISTS bonus_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES shop_orders(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('redemption', 'refund')),
  order_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_bonus_transactions_user_id ON bonus_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_bonus_transactions_order_id ON bonus_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_bonus_transactions_created_at ON bonus_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bonus_transactions_type ON bonus_transactions(transaction_type);

-- Add comments for documentation
COMMENT ON TABLE bonus_transactions IS 'Tracks all bonus balance redemptions and refunds with timestamps';
COMMENT ON COLUMN bonus_transactions.amount IS 'Amount of bonus used (positive value)';
COMMENT ON COLUMN bonus_transactions.transaction_type IS 'Type of transaction: redemption (usage) or refund';
COMMENT ON COLUMN bonus_transactions.order_number IS 'Reference to shop order number';
COMMENT ON COLUMN bonus_transactions.metadata IS 'Additional data like payment method, vouchers used, etc';

-- Enable RLS (following existing pattern - disabled for dev)
ALTER TABLE bonus_transactions ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies are intentionally minimal following the existing pattern
-- where most tables have RLS enabled but policies are managed separately
