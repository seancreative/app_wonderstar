import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load environment variables
const envFile = readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY);

console.log('🧪 Testing Wallet Topup Duplicate Prevention\n');
console.log('=============================================\n');

const testUserId = '6f7c1102-25db-4bc8-aa12-47bec52dc723'; // Nabilah
const testWalletTransactionId = '00000000-0000-0000-0000-' + Date.now().toString().padStart(12, '0');

// Check current balance
const { data: user } = await supabase
  .from('users')
  .select('bonus_balance')
  .eq('id', testUserId)
  .single();

console.log(`Current balance: RM${user.bonus_balance}\n`);

console.log('Test: Attempt to award topup bonus twice with same wallet_transaction_id');
console.log('--------------------------------------------------------------------------\n');

// First attempt
console.log('Attempt 1: Award RM10 bonus for wallet topup...');
const { data: first, error: firstError } = await supabase
  .rpc('update_bonus_balance_atomic', {
    p_user_id: testUserId,
    p_amount: 10,
    p_transaction_type: 'topup_bonus',
    p_description: 'Test wallet topup bonus - first attempt',
    p_order_id: null,
    p_order_number: `TEST-TOPUP-${Date.now()}`,
    p_metadata: {
      wallet_transaction_id: testWalletTransactionId,
      test: true,
      attempt: 1
    }
  });

if (firstError) {
  console.log(`❌ First attempt failed: ${firstError.message}\n`);
} else if (first && first.length > 0 && first[0].success) {
  console.log(`✅ First attempt succeeded`);
  console.log(`   New balance: RM${first[0].new_balance}\n`);
}

// Wait a moment to ensure database commit
await new Promise(resolve => setTimeout(resolve, 500));

// Second attempt with SAME wallet_transaction_id
console.log('Attempt 2: Try to award RM10 bonus again with same wallet_transaction_id...');
const { data: second, error: secondError } = await supabase
  .rpc('update_bonus_balance_atomic', {
    p_user_id: testUserId,
    p_amount: 10,
    p_transaction_type: 'topup_bonus',
    p_description: 'Test wallet topup bonus - second attempt (SHOULD FAIL)',
    p_order_id: null,
    p_order_number: `TEST-TOPUP-2-${Date.now()}`, // Different order number
    p_metadata: {
      wallet_transaction_id: testWalletTransactionId, // SAME wallet_transaction_id
      test: true,
      attempt: 2
    }
  });

if (secondError) {
  if (secondError.code === '23505') {
    console.log('✅ PERFECT! Duplicate prevented by database constraint!');
    console.log(`   Error code: ${secondError.code} (unique_violation)`);
    console.log(`   Message: ${secondError.message}\n`);
  } else {
    console.log(`⚠️  Failed with different error: ${secondError.message}\n`);
  }
} else if (second && second.length > 0) {
  if (!second[0].success) {
    console.log('✅ Duplicate prevented by atomic function');
    console.log(`   Message: ${second[0].message}\n`);
  } else {
    console.log('❌ WARNING: Second attempt succeeded - duplicate prevention FAILED!');
    console.log(`   New balance: RM${second[0].new_balance}\n`);
  }
}

// Verify final balance
const { data: finalUser } = await supabase
  .from('users')
  .select('bonus_balance')
  .eq('id', testUserId)
  .single();

const expectedBalance = user.bonus_balance + 10; // Should only add once
console.log('Final Balance Check');
console.log('-------------------');
console.log(`Expected balance: RM${expectedBalance} (only one bonus award)`);
console.log(`Actual balance: RM${finalUser.bonus_balance}`);

if (finalUser.bonus_balance === expectedBalance) {
  console.log('✅ Balance is correct - duplicate was prevented!\n');
} else if (finalUser.bonus_balance === user.bonus_balance + 20) {
  console.log('❌ Balance is DOUBLE - duplicate prevention FAILED!\n');
} else {
  console.log('⚠️  Unexpected balance\n');
}

// Check transaction count
const { data: transactions, count } = await supabase
  .from('bonus_transactions')
  .select('*', { count: 'exact' })
  .eq('user_id', testUserId)
  .eq('metadata->>wallet_transaction_id', testWalletTransactionId);

console.log('Transaction Count');
console.log('-----------------');
console.log(`Transactions with wallet_transaction_id ${testWalletTransactionId}: ${count}`);
if (count === 1) {
  console.log('✅ Only one transaction created - duplicate prevention works!\n');
} else if (count === 2) {
  console.log('❌ Two transactions created - duplicate prevention FAILED!\n');
} else {
  console.log(`⚠️  Unexpected count: ${count}\n`);
}

console.log('=============================================');
console.log('Test Complete\n');

console.log('Critical Security Check:');
console.log('- If user refreshes payment callback page');
console.log('- Database constraint prevents duplicate bonus');
console.log('- User cannot exploit the system to get free money');
