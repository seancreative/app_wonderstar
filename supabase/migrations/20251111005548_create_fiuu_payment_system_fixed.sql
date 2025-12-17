/*
  # Fiuu Payment Gateway Integration

  ## Overview
  This migration creates the necessary tables and fields for integrating Fiuu payment gateway
  to support credit/debit cards, FPX online banking, and e-wallets (TnG, GrabPay, Boost).

  ## New Tables

  1. **fiuu_customers**
     - Links WonderStars users to Fiuu customer records
     - Stores customer_id from Fiuu API
     - One-to-one relationship with users table

  2. **payment_transactions**
     - Tracks all Fiuu payment transactions
     - Links to orders, products, or wallet top-ups
     - Stores Fiuu transaction IDs and status
     - Includes payment method and amount details

  ## Table Updates

  1. **users** - Add address fields for Fiuu customer creation (already added by previous migration)

  2. **wallet_transactions** - Add reference to payment gateway
     - payment_transaction_id for tracking Fiuu payments

  3. **shop_orders** - Add reference to payment gateway
     - payment_transaction_id for tracking Fiuu payments

  ## Security
  - RLS disabled for development (following existing pattern)
  - All tables indexed for performance
  - Foreign key constraints ensure data integrity
*/

-- =====================================================
-- FIUU CUSTOMERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS fiuu_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fiuu_customer_id text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text NOT NULL,
  customer_city text NOT NULL,
  customer_state text NOT NULL,
  customer_postcode text NOT NULL,
  customer_country text NOT NULL DEFAULT 'MY',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_fiuu_customers_user_id ON fiuu_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_fiuu_customers_fiuu_id ON fiuu_customers(fiuu_customer_id);

-- =====================================================
-- PAYMENT TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fiuu_customer_id uuid REFERENCES fiuu_customers(id) ON DELETE SET NULL,

  -- Transaction details
  amount decimal(10,2) NOT NULL,
  payment_method text NOT NULL,

  -- Link to internal records (wallet top-up or shop order)
  wallet_transaction_id uuid REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  shop_order_id uuid REFERENCES shop_orders(id) ON DELETE SET NULL,

  -- Fiuu API response data
  fiuu_transaction_id text,
  fiuu_status text,
  fiuu_payment_url text,
  fiuu_payment_data jsonb,
  fiuu_callback_data jsonb,

  -- Status tracking
  status text NOT NULL DEFAULT 'pending',
  error_message text,

  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz,

  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled')),
  CONSTRAINT valid_payment_method CHECK (payment_method IN ('credit', 'debit', 'fpx', 'grabpay', 'tng', 'boost', 'ewallet', 'card'))
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_fiuu_transaction_id ON payment_transactions(fiuu_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_wallet_tx ON payment_transactions(wallet_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_shop_order ON payment_transactions(shop_order_id);

-- =====================================================
-- UPDATE WALLET TRANSACTIONS - Add Payment Reference
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallet_transactions' AND column_name = 'payment_transaction_id'
  ) THEN
    ALTER TABLE wallet_transactions ADD COLUMN payment_transaction_id uuid REFERENCES payment_transactions(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_wallet_transactions_payment_tx ON wallet_transactions(payment_transaction_id);
  END IF;
END $$;

-- =====================================================
-- UPDATE SHOP ORDERS - Add Payment Reference
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'payment_transaction_id'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN payment_transaction_id uuid REFERENCES payment_transactions(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_shop_orders_payment_tx ON shop_orders(payment_transaction_id);
  END IF;

  -- Update payment_method column to support new payment types
  -- Remove old constraint and add new one with all valid payment methods
  ALTER TABLE shop_orders DROP CONSTRAINT IF EXISTS valid_payment_method;
  ALTER TABLE shop_orders ADD CONSTRAINT valid_payment_method
    CHECK (payment_method IN ('wonderstars', 'credit', 'debit', 'fpx', 'grabpay', 'tng', 'boost', 'card', 'free_reward'));
END $$;

-- =====================================================
-- RLS POLICIES (Disabled for Development)
-- =====================================================
ALTER TABLE fiuu_customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to update payment transaction status
CREATE OR REPLACE FUNCTION update_payment_transaction_status(
  p_transaction_id uuid,
  p_status text,
  p_fiuu_transaction_id text DEFAULT NULL,
  p_fiuu_status text DEFAULT NULL,
  p_callback_data jsonb DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE payment_transactions
  SET
    status = p_status,
    fiuu_transaction_id = COALESCE(p_fiuu_transaction_id, fiuu_transaction_id),
    fiuu_status = COALESCE(p_fiuu_status, fiuu_status),
    fiuu_callback_data = COALESCE(p_callback_data, fiuu_callback_data),
    updated_at = now(),
    completed_at = CASE WHEN p_status IN ('success', 'failed', 'cancelled') THEN now() ELSE completed_at END
  WHERE id = p_transaction_id;
END;
$$ LANGUAGE plpgsql;