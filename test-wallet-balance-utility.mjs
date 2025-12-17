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

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const TEST_USER_ID = 'b4952b90-bbb2-4e03-b6af-89acd1037bc4';

console.log('🧪 Testing Wallet Balance Utility Function\n');
console.log('═══════════════════════════════════════════════════════\n');

// Simulate the utility function
function calculateWalletBalance(transactions) {
  if (!transactions || transactions.length === 0) {
    return {
      walletBalance: 0,
      totalTopups: 0,
      totalSpends: 0,
      successfulTransactions: 0,
      pendingTransactions: 0,
      failedTransactions: 0
    };
  }

  let walletBalance = 0;
  let totalTopups = 0;
  let totalSpends = 0;
  let successfulCount = 0;
  let pendingCount = 0;
  let failedCount = 0;

  transactions.forEach((tx) => {
    if (tx.status === 'success') {
      successfulCount++;
    } else if (tx.status === 'pending' || tx.status === 'processing') {
      pendingCount++;
      return;
    } else if (tx.status === 'failed' || tx.status === 'cancelled') {
      failedCount++;
      return;
    } else {
      return;
    }

    const amount = parseFloat(tx.amount.toString());

    if (tx.transaction_type === 'topup' || tx.transaction_type === 'refund') {
      walletBalance += amount;
      totalTopups += amount;
    } else if (tx.transaction_type === 'spend') {
      const spendAmount = Math.abs(amount);
      walletBalance -= spendAmount;
      totalSpends += spendAmount;
    }
  });

  return {
    walletBalance: Math.max(0, walletBalance),
    totalTopups,
    totalSpends,
    successfulTransactions: successfulCount,
    pendingTransactions: pendingCount,
    failedTransactions: failedCount
  };
}

async function test() {
  console.log('📊 Fetching wallet transactions from database...\n');

  const { data: transactions, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', TEST_USER_ID)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  const { data: userData } = await supabase
    .from('users')
    .select('bonus_balance')
    .eq('id', TEST_USER_ID)
    .single();

  console.log(`Total Transactions Fetched: ${transactions.length}\n`);

  const result = calculateWalletBalance(transactions);

  console.log('✅ CALCULATION RESULTS:');
  console.log('─────────────────────────────────────────────────────');
  console.log(`💰 Wallet Balance:         RM ${result.walletBalance.toFixed(2)}`);
  console.log(`🎁 Bonus Balance:          RM ${(userData?.bonus_balance || 0).toFixed(2)}`);
  console.log(`📈 Total Topups:           RM ${result.totalTopups.toFixed(2)}`);
  console.log(`📉 Total Spends:           RM ${result.totalSpends.toFixed(2)}`);
  console.log(`✅ Successful:             ${result.successfulTransactions}`);
  console.log(`⏳ Pending:                ${result.pendingTransactions}`);
  console.log(`❌ Failed:                 ${result.failedTransactions}`);
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('📋 Transaction Breakdown:');
  console.log('─────────────────────────────────────────────────────\n');

  transactions.slice(0, 5).forEach((tx, i) => {
    const status = tx.status === 'success' ? '✅' : tx.status === 'pending' ? '⏳' : '❌';
    console.log(`${i + 1}. ${status} ${tx.transaction_type.toUpperCase()} - RM ${tx.amount}`);
    console.log(`   Status: ${tx.status}`);
    console.log(`   Order: ${tx.metadata?.order_number || 'N/A'}`);
    console.log(`   Date: ${new Date(tx.created_at).toLocaleString()}`);
    console.log('');
  });

  console.log('═══════════════════════════════════════════════════════');
  console.log('🎯 EXPECTED BEHAVIOR:');
  console.log('─────────────────────────────────────────────────────');
  console.log('✓ Homepage should show: RM ' + result.walletBalance.toFixed(2));
  console.log('✓ CMS should show: RM ' + result.walletBalance.toFixed(2));
  console.log('✓ Both should match this calculated value');
  console.log('═══════════════════════════════════════════════════════\n');
}

test().catch(console.error);
