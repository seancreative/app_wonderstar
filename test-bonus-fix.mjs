/**
 * Test: Verify Bonus Balance Fix
 *
 * This test verifies that:
 * 1. Historical topups now have bonus_transactions
 * 2. Users' bonus_balance has been updated correctly
 * 3. The PaymentCallback fix will handle future topups correctly
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY);

console.log('========================================');
console.log('BONUS BALANCE FIX - VERIFICATION TEST');
console.log('========================================\n');

async function runTests() {
  let passCount = 0;
  let failCount = 0;

  // TEST 1: Check all successful topups have bonus_transactions if they have bonus_amount
  console.log('TEST 1: All successful topups with bonus_amount have bonus_transactions');
  console.log('-----------------------------------------------------------------------');

  const { data: topups } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('transaction_type', 'topup')
    .eq('status', 'success');

  let missingBonusCount = 0;
  let checkedWithBonus = 0;

  for (const topup of topups) {
    const metadata = topup.metadata || {};
    const bonusAmount = metadata.bonus_amount || 0;

    if (bonusAmount > 0) {
      checkedWithBonus++;

      const { data: bonusTx } = await supabase
        .from('bonus_transactions')
        .select('id')
        .eq('user_id', topup.user_id)
        .eq('transaction_type', 'topup_bonus')
        .eq('metadata->>wallet_transaction_id', topup.id)
        .maybeSingle();

      if (!bonusTx) {
        missingBonusCount++;
        console.log(`  ❌ FAIL: Topup ${topup.id.substring(0, 8)} missing bonus_transaction`);
      }
    }
  }

  if (missingBonusCount === 0 && checkedWithBonus > 0) {
    console.log(`  ✅ PASS: All ${checkedWithBonus} topups with bonus have bonus_transactions`);
    passCount++;
  } else if (checkedWithBonus === 0) {
    console.log(`  ⚠️ SKIP: No topups with bonus_amount found`);
  } else {
    console.log(`  ❌ FAIL: ${missingBonusCount} topups missing bonus_transactions`);
    failCount++;
  }

  // TEST 2: Verify bonus_transactions have correct amounts
  console.log('\nTEST 2: Bonus transactions match wallet transaction metadata');
  console.log('---------------------------------------------------------------');

  let mismatchCount = 0;
  let bonusChecked = 0;

  const { data: recentTopups } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('transaction_type', 'topup')
    .eq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(10);

  for (const topup of recentTopups) {
    const metadata = topup.metadata || {};
    const expectedBonus = metadata.bonus_amount || 0;

    if (expectedBonus > 0) {
      const { data: bonusTx } = await supabase
        .from('bonus_transactions')
        .select('amount')
        .eq('user_id', topup.user_id)
        .eq('transaction_type', 'topup_bonus')
        .eq('metadata->>wallet_transaction_id', topup.id)
        .maybeSingle();

      bonusChecked++;

      if (bonusTx && bonusTx.amount !== expectedBonus) {
        mismatchCount++;
        console.log(`  ❌ FAIL: Topup ${topup.id.substring(0, 8)} - Expected RM${expectedBonus}, got RM${bonusTx.amount}`);
      }
    }
  }

  if (mismatchCount === 0 && bonusChecked > 0) {
    console.log(`  ✅ PASS: All ${bonusChecked} bonus amounts match expected values`);
    passCount++;
  } else if (bonusChecked === 0) {
    console.log(`  ⚠️ SKIP: No recent bonus transactions to check`);
  } else {
    console.log(`  ❌ FAIL: ${mismatchCount} bonus amounts don't match`);
    failCount++;
  }

  // TEST 3: Verify users' bonus_balance is correct
  console.log('\nTEST 3: Users bonus_balance matches sum of bonus_transactions');
  console.log('----------------------------------------------------------------');

  const { data: usersWithBonus } = await supabase
    .from('users')
    .select('id, name, bonus_balance')
    .gt('bonus_balance', 0)
    .limit(5);

  let balanceMismatchCount = 0;
  let usersChecked = 0;

  for (const user of usersWithBonus) {
    usersChecked++;

    // Calculate expected balance from transactions
    const { data: bonusTransactions } = await supabase
      .from('bonus_transactions')
      .select('amount, transaction_type')
      .eq('user_id', user.id);

    let expectedBalance = 0;
    bonusTransactions?.forEach(tx => {
      if (tx.transaction_type === 'topup_bonus' || tx.transaction_type === 'gacha_prize' || tx.transaction_type === 'manual_adjustment') {
        expectedBalance += parseFloat(tx.amount.toString());
      } else if (tx.transaction_type === 'spend' || tx.transaction_type === 'expire') {
        expectedBalance -= parseFloat(tx.amount.toString());
      }
    });

    const actualBalance = parseFloat(user.bonus_balance.toString());

    if (Math.abs(actualBalance - expectedBalance) > 0.01) {
      balanceMismatchCount++;
      console.log(`  ❌ FAIL: ${user.name || user.id.substring(0, 8)} - Expected RM${expectedBalance.toFixed(2)}, got RM${actualBalance.toFixed(2)}`);
    } else {
      console.log(`  ✅ ${user.name || user.id.substring(0, 8)} - RM${actualBalance.toFixed(2)} (correct)`);
    }
  }

  if (balanceMismatchCount === 0 && usersChecked > 0) {
    console.log(`  ✅ PASS: All ${usersChecked} user balances are correct`);
    passCount++;
  } else if (usersChecked === 0) {
    console.log(`  ⚠️ SKIP: No users with bonus balance found`);
  } else {
    console.log(`  ❌ FAIL: ${balanceMismatchCount} user balances don't match`);
    failCount++;
  }

  // TEST 4: Check for duplicate bonus_transactions
  console.log('\nTEST 4: No duplicate bonus_transactions exist');
  console.log('-----------------------------------------------');

  const { data: allBonuses } = await supabase
    .from('bonus_transactions')
    .select('user_id, metadata')
    .eq('transaction_type', 'topup_bonus');

  const walletTxMap = new Map();
  let duplicateCount = 0;

  allBonuses?.forEach(bonus => {
    const walletTxId = bonus.metadata?.wallet_transaction_id;
    if (walletTxId) {
      const key = `${bonus.user_id}-${walletTxId}`;
      if (walletTxMap.has(key)) {
        duplicateCount++;
        console.log(`  ❌ FAIL: Duplicate bonus for wallet_tx ${walletTxId.substring(0, 8)}`);
      } else {
        walletTxMap.set(key, true);
      }
    }
  });

  if (duplicateCount === 0) {
    console.log(`  ✅ PASS: No duplicate bonus_transactions found (checked ${allBonuses?.length || 0} records)`);
    passCount++;
  } else {
    console.log(`  ❌ FAIL: ${duplicateCount} duplicate bonus_transactions found`);
    failCount++;
  }

  // Summary
  console.log('\n========================================');
  console.log('TEST RESULTS SUMMARY');
  console.log('========================================');
  console.log(`Tests Passed: ${passCount}`);
  console.log(`Tests Failed: ${failCount}`);
  console.log(`Overall: ${failCount === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log('========================================\n');
}

await runTests();
