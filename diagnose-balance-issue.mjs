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

const TEST_USER_ID = 'b4952b90-bbb2-4e03-b6af-89acd1037bc4'; // Danson33@gmail.com

console.log('🔍 Diagnosing Wallet Balance Issue\n');
console.log('═══════════════════════════════════════════════════════\n');

async function diagnose() {
  // Get all wallet transactions
  const { data: transactions, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', TEST_USER_ID)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching transactions:', error);
    return;
  }

  console.log(`Total Transactions: ${transactions.length}\n`);

  // Calculate balance
  let balance = 0;
  let successCount = 0;
  let pendingCount = 0;

  console.log('Transaction History:');
  console.log('─────────────────────────────────────────────────────\n');

  transactions.forEach((tx, i) => {
    const status = tx.status === 'success' ? '✅' : '⏳';
    console.log(`${i + 1}. ${status} ${tx.transaction_type.toUpperCase()} - RM ${tx.amount}`);
    console.log(`   Status: ${tx.status}`);
    console.log(`   ID: ${tx.id}`);
    console.log(`   Order: ${tx.metadata?.order_number || 'N/A'}`);
    console.log(`   Created: ${new Date(tx.created_at).toLocaleString()}`);

    if (tx.status === 'success') {
      successCount++;
      if (tx.transaction_type === 'topup') {
        balance += parseFloat(tx.amount);
      } else if (tx.transaction_type === 'spend') {
        balance -= parseFloat(tx.amount);
      }
    } else {
      pendingCount++;
    }
    console.log('');
  });

  console.log('═══════════════════════════════════════════════════════');
  console.log('SUMMARY:');
  console.log('─────────────────────────────────────────────────────');
  console.log(`Total Transactions: ${transactions.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`⏳ Pending: ${pendingCount}`);
  console.log(`💰 Calculated Balance: RM ${balance.toFixed(2)}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Get user's bonus balance
  const { data: userData } = await supabase
    .from('users')
    .select('bonus_balance')
    .eq('id', TEST_USER_ID)
    .single();

  console.log(`🎁 Bonus Balance: RM ${userData?.bonus_balance || 0}\n`);

  // Check the specific transaction from the logs
  const latestTopup = transactions.find(tx =>
    tx.id === '85936e72-2c57-43a5-b7be-a6bf4c82199e'
  );

  if (latestTopup) {
    console.log('🔎 Latest Topup Transaction (from logs):');
    console.log('─────────────────────────────────────────────────────');
    console.log(`ID: ${latestTopup.id}`);
    console.log(`Status: ${latestTopup.status}`);
    console.log(`Amount: RM ${latestTopup.amount}`);
    console.log(`Type: ${latestTopup.transaction_type}`);
    console.log(`Created: ${new Date(latestTopup.created_at).toLocaleString()}`);
    console.log(`Order: ${latestTopup.metadata?.order_number || 'N/A'}`);
    console.log('');

    if (latestTopup.status === 'success') {
      console.log('✅ This transaction IS included in the balance calculation');
    } else {
      console.log('❌ This transaction is NOT included (status is not "success")');
      console.log('⚠️  This is the problem! The status needs to be "success"');
    }
  } else {
    console.log('❌ Could not find transaction ID from logs: 85936e72-2c57-43a5-b7be-a6bf4c82199e');
  }
}

diagnose().catch(console.error);
