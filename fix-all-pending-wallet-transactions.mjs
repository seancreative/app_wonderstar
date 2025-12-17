#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = {};
readFileSync('.env', 'utf-8').split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key) env[key.trim()] = val.join('=').trim();
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function fixPendingTransactions() {
  console.log('🔧 Fixing Pending Wallet Transactions\n');
  console.log('═══════════════════════════════════════════════════════\n');

  // Step 1: Find all pending wallet transactions
  const { data: pendingWalletTxs, error: walletError } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (walletError) {
    console.error('❌ Error fetching pending wallet transactions:', walletError);
    return;
  }

  console.log(`📊 Found ${pendingWalletTxs.length} pending wallet transactions\n`);

  if (pendingWalletTxs.length === 0) {
    console.log('✅ No pending transactions to fix!\n');
    return;
  }

  // Step 2: For each pending transaction, check if there's a successful payment
  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const walletTx of pendingWalletTxs) {
    const orderNumber = walletTx.metadata?.order_number;
    console.log(`\n🔍 Checking: ${orderNumber || walletTx.id.substring(0, 8)}`);
    console.log(`   Amount: RM ${walletTx.amount}`);
    console.log(`   Created: ${new Date(walletTx.created_at).toLocaleString()}`);

    // Find corresponding payment transaction
    const { data: paymentTx, error: paymentError } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('wallet_transaction_id', walletTx.id)
      .single();

    if (paymentError || !paymentTx) {
      console.log('   ⏭️  No payment transaction found - skipping');
      skipped++;
      continue;
    }

    console.log(`   💳 Payment Status: ${paymentTx.status}`);
    console.log(`   💳 Payment Payment Status: ${paymentTx.payment_status}`);

    // If payment is successful, update wallet transaction
    if (paymentTx.status === 'success' || paymentTx.payment_status === 'success' || paymentTx.payment_status === 'completed') {
      console.log('   ✅ Payment successful - updating wallet transaction...');

      const { error: updateError } = await supabase
        .from('wallet_transactions')
        .update({
          status: 'success',
          metadata: {
            ...walletTx.metadata,
            completed_at: new Date().toISOString(),
            fixed_by_script: true,
            fixed_at: new Date().toISOString()
          }
        })
        .eq('id', walletTx.id);

      if (updateError) {
        console.error('   ❌ Failed to update:', updateError.message);
        errors++;
      } else {
        console.log('   ✅ Updated successfully!');
        fixed++;

        // Also update shop_order if exists
        const orderId = walletTx.metadata?.order_id;
        if (orderId) {
          const { error: orderError } = await supabase
            .from('shop_orders')
            .update({
              status: 'completed',
              payment_status: 'completed',
              confirmed_at: new Date().toISOString()
            })
            .eq('id', orderId);

          if (orderError) {
            console.log('   ⚠️  Failed to update shop order:', orderError.message);
          } else {
            console.log('   ✅ Shop order updated too!');
          }
        }
      }
    } else if (paymentTx.status === 'failed' || paymentTx.payment_status === 'failed') {
      console.log('   ❌ Payment failed - updating wallet transaction...');

      const { error: updateError } = await supabase
        .from('wallet_transactions')
        .update({
          status: 'failed',
          metadata: {
            ...walletTx.metadata,
            failed_at: new Date().toISOString(),
            fixed_by_script: true
          }
        })
        .eq('id', walletTx.id);

      if (updateError) {
        console.error('   ❌ Failed to update:', updateError.message);
        errors++;
      } else {
        console.log('   ✅ Marked as failed');
        fixed++;
      }
    } else {
      console.log(`   ⏳ Payment still pending (${paymentTx.payment_status}) - skipping`);
      skipped++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 SUMMARY:');
  console.log('─────────────────────────────────────────────────────');
  console.log(`Total Pending: ${pendingWalletTxs.length}`);
  console.log(`✅ Fixed: ${fixed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (fixed > 0) {
    console.log('🎉 Success! Run diagnose-balance-issue.mjs to verify balances.\n');
  }
}

fixPendingTransactions().catch(console.error);
