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

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY
);

async function fixPendingTopup() {
  console.log('\n=== Fixing Pending Topup TU-20251201-4086 ===\n');

  const orderNumber = 'TU-20251201-4086';
  const userId = 'b4952b90-bbb2-4e03-b6af-89acd1037bc4';

  // Step 1: Get payment_transaction
  const { data: paymentTx, error: paymentError } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('order_id', orderNumber)
    .single();

  if (paymentError) {
    console.error('Error fetching payment transaction:', paymentError);
    return;
  }

  console.log('Payment Transaction:', {
    id: paymentTx.id,
    status: paymentTx.status,
    wallet_transaction_id: paymentTx.wallet_transaction_id,
    amount: paymentTx.amount
  });

  // Step 2: Get wallet_transaction
  const { data: walletTx, error: walletError } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('id', paymentTx.wallet_transaction_id)
    .single();

  if (walletError) {
    console.error('Error fetching wallet transaction:', walletError);
    return;
  }

  console.log('\nWallet Transaction:', {
    id: walletTx.id,
    status: walletTx.status,
    amount: walletTx.amount,
    payment_transaction_id: walletTx.payment_transaction_id
  });

  // Step 3: Fix payment_transaction_id link if missing
  if (!walletTx.payment_transaction_id) {
    console.log('\n⚠️  Wallet transaction missing payment_transaction_id link');
    console.log('Updating wallet_transaction to link payment_transaction...');

    const { error: linkError } = await supabase
      .from('wallet_transactions')
      .update({ payment_transaction_id: paymentTx.id })
      .eq('id', walletTx.id);

    if (linkError) {
      console.error('❌ Failed to link payment_transaction:', linkError);
      return;
    }
    console.log('✓ Linked payment_transaction to wallet_transaction');
  }

  // Step 4: Update payment_transaction to success (this will trigger the sync)
  console.log('\nUpdating payment_transaction status to completed...');

  const { error: updateError } = await supabase
    .from('payment_transactions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', paymentTx.id);

  if (updateError) {
    console.error('❌ Failed to update payment_transaction:', updateError);
    return;
  }

  console.log('✓ Payment transaction updated to completed');

  // Step 5: Manually update wallet_transaction status (in case trigger didn't fire)
  console.log('\nUpdating wallet_transaction status to success...');

  const { error: walletUpdateError } = await supabase
    .from('wallet_transactions')
    .update({
      status: 'success',
      metadata: {
        ...walletTx.metadata,
        completed_at: new Date().toISOString(),
        manually_fixed: true,
        fixed_at: new Date().toISOString()
      }
    })
    .eq('id', walletTx.id);

  if (walletUpdateError) {
    console.error('❌ Failed to update wallet_transaction:', walletUpdateError);
    return;
  }

  console.log('✓ Wallet transaction updated to success');

  // Step 6: Award stars if configured in metadata
  const metadata = walletTx.metadata || {};
  const baseStars = metadata.base_stars || 0;
  const extraStars = metadata.extra_stars || 0;
  const totalStars = baseStars + extraStars;

  if (totalStars > 0) {
    console.log(`\nAwarding ${totalStars} stars (${baseStars} base + ${extraStars} extra)...`);

    const { error: starsError } = await supabase
      .from('stars_transactions')
      .insert({
        user_id: userId,
        stars: totalStars,
        source: 'wallet_topup',
        description: `Top-up reward for ${orderNumber}`,
        metadata: {
          topup_amount: walletTx.amount,
          payment_transaction_id: paymentTx.id,
          wallet_transaction_id: walletTx.id,
          package_id: metadata.package_id,
          base_stars: baseStars,
          extra_stars: extraStars
        }
      });

    if (starsError) {
      console.error('⚠️  Failed to award stars:', starsError);
    } else {
      console.log('✓ Stars awarded successfully');
    }
  }

  // Step 7: Award bonus balance if configured
  const bonusAmount = metadata.bonus_amount || 0;

  if (bonusAmount > 0) {
    console.log(`\nAwarding bonus balance: RM${bonusAmount}...`);

    // Get current bonus balance
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('bonus_balance')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('⚠️  Failed to fetch user bonus balance:', userError);
    } else {
      const oldBonus = userData.bonus_balance || 0;
      const newBonus = oldBonus + bonusAmount;

      // Update bonus balance
      const { error: bonusError } = await supabase
        .from('users')
        .update({ bonus_balance: newBonus })
        .eq('id', userId);

      if (bonusError) {
        console.error('⚠️  Failed to update bonus balance:', bonusError);
      } else {
        console.log(`✓ Bonus balance updated: RM${oldBonus} -> RM${newBonus}`);

        // Create bonus transaction record
        const { error: bonusTxError } = await supabase
          .from('bonus_transactions')
          .insert({
            user_id: userId,
            amount: bonusAmount,
            transaction_type: 'topup_bonus',
            order_number: orderNumber,
            metadata: {
              payment_transaction_id: paymentTx.id,
              wallet_transaction_id: walletTx.id,
              package_id: metadata.package_id,
              topup_amount: walletTx.amount,
              manually_fixed: true,
              fixed_at: new Date().toISOString()
            }
          });

        if (bonusTxError) {
          console.error('⚠️  Failed to create bonus transaction record:', bonusTxError);
        } else {
          console.log('✓ Bonus transaction record created');
        }
      }
    }
  }

  // Step 8: Verify the fix
  console.log('\n=== Verification ===\n');

  const { data: finalWalletTx } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('id', walletTx.id)
    .single();

  const { data: finalPaymentTx } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('id', paymentTx.id)
    .single();

  console.log('Final Payment Transaction Status:', finalPaymentTx.status);
  console.log('Final Wallet Transaction Status:', finalWalletTx.status);
  console.log('Payment Transaction ID Link:', finalWalletTx.payment_transaction_id);

  // Check user's wallet balance
  const { data: allTransactions } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'success');

  let calculatedBalance = 0;
  allTransactions?.forEach(tx => {
    if (tx.transaction_type === 'topup') {
      calculatedBalance += parseFloat(tx.amount);
    } else if (tx.transaction_type === 'spend') {
      calculatedBalance -= Math.abs(parseFloat(tx.amount));
    }
  });

  console.log(`\nUser's W Balance: RM${calculatedBalance.toFixed(2)}`);
  console.log(`Number of successful transactions: ${allTransactions?.length || 0}`);

  console.log('\n✓ Fix Complete!\n');
}

fixPendingTopup().catch(err => {
  console.error('\n✗ Error:', err);
  process.exit(1);
});
