/*
  # Remove Boost Payment Method

  1. Changes
    - Update existing boost orders to card payment method first
    - Remove 'boost' from valid payment methods constraint
    - Keep: credit, debit, card, fpx, grabpay, tng, wonderstars, stamps, free_reward
*/

-- =====================================================
-- UPDATE ANY EXISTING BOOST ORDERS TO CARD FIRST
-- =====================================================
DO $$
BEGIN
  -- Update any orders that use boost to use card instead
  UPDATE shop_orders
  SET payment_method = 'card'
  WHERE payment_method = 'boost';
  
  -- Update payment_transactions as well
  UPDATE payment_transactions
  SET payment_method = 'card'
  WHERE payment_method = 'boost';
  
  RAISE NOTICE 'Updated existing boost orders to card payment method';
END $$;

-- =====================================================
-- UPDATE PAYMENT_METHOD CONSTRAINT
-- =====================================================
ALTER TABLE shop_orders DROP CONSTRAINT IF EXISTS valid_payment_method;

-- Add updated constraint without boost
ALTER TABLE shop_orders ADD CONSTRAINT valid_payment_method
  CHECK (payment_method IN (
    'wonderstars', 
    'credit', 
    'debit', 
    'card', 
    'fpx', 
    'grabpay', 
    'tng', 
    'stamps', 
    'free_reward'
  ));
