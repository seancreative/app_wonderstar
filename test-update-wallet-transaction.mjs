#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

// Test with ANON key (same as PaymentCallback uses)
const supabaseAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

// Test with SERVICE ROLE key
const supabaseService = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const TEST_TX_ID = '85936e72-2c57-43a5-b7be-a6bf4c82199e'; // The stuck transaction

console.log('🧪 Testing wallet_transactions UPDATE with different keys\n');
console.log('═══════════════════════════════════════════════════════\n');

async function testUpdate() {
  console.log('Test 1: UPDATE with ANON key (what PaymentCallback uses)');
  console.log('─────────────────────────────────────────────────────\n');

  const { error: anonError } = await supabaseAnon
    .from('wallet_transactions')
    .update({ status: 'success' })
    .eq('id', TEST_TX_ID);

  if (anonError) {
    console.log('❌ FAILED with ANON key');
    console.log('Error:', anonError.message);
    console.log('Code:', anonError.code);
    console.log('Details:', anonError.details);
    console.log('\n⚠️  THIS IS THE PROBLEM! RLS is blocking the UPDATE\n');
  } else {
    console.log('✅ SUCCESS with ANON key\n');
  }

  console.log('─────────────────────────────────────────────────────');
  console.log('Test 2: UPDATE with SERVICE ROLE key');
  console.log('─────────────────────────────────────────────────────\n');

  const { error: serviceError } = await supabaseService
    .from('wallet_transactions')
    .update({ status: 'success' })
    .eq('id', TEST_TX_ID);

  if (serviceError) {
    console.log('❌ FAILED with SERVICE ROLE');
    console.log('Error:', serviceError.message);
  } else {
    console.log('✅ SUCCESS with SERVICE ROLE');
    console.log('Transaction updated to success!\n');
  }

  // Verify the current status
  const { data: currentTx } = await supabaseService
    .from('wallet_transactions')
    .select('id, status, amount')
    .eq('id', TEST_TX_ID)
    .single();

  console.log('─────────────────────────────────────────────────────');
  console.log('Current transaction status:', currentTx?.status);
  console.log('Amount:', `RM ${currentTx?.amount}`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (currentTx?.status === 'success') {
    console.log('✅ Transaction is now marked as SUCCESS');
    console.log('💰 This RM 1.00 will now appear in the user\'s balance!\n');
  } else {
    console.log('❌ Transaction is still PENDING');
    console.log('⚠️  RLS policy is blocking the update\n');
  }
}

testUpdate().catch(console.error);
