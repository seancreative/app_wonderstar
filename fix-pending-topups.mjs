import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUxNjM5MiwiZXhwIjoyMDc4MDkyMzkyfQ.lBi3z7dl1Od1uzEZlAwWw619LnojGJQzbeBnvDa4cN4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const emails = ['seancreative@gmail.com', 'danson3@gmail.com'];

console.log('\n========================================');
console.log('FIXING PENDING TOPUP TRANSACTIONS');
console.log('========================================');

for (const email of emails) {
  console.log('\n---------------------------------------');
  console.log('USER:', email);
  console.log('---------------------------------------');

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (!user) {
    console.log('User not found');
    continue;
  }

  // Get pending wallet transactions
  const { data: pendingWalletTxs } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .eq('transaction_type', 'topup')
    .order('created_at', { ascending: false });

  if (!pendingWalletTxs || pendingWalletTxs.length === 0) {
    console.log('No pending topup transactions');
    continue;
  }

  console.log('\nFound', pendingWalletTxs.length, 'pending topup transactions');

  for (const walletTx of pendingWalletTxs) {
    console.log('\n  Processing TX:', walletTx.id.slice(0, 8));
    console.log('  Amount: RM' + walletTx.amount);
    console.log('  Bonus: RM' + (walletTx.bonus_amount || 0));

    // Get related payment transaction
    const { data: payment } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('wallet_transaction_id', walletTx.id)
      .maybeSingle();

    if (!payment) {
      console.log('  No payment transaction found - skipping');
      continue;
    }

    console.log('  Payment Order:', payment.unique_order_id || 'N/A');
    console.log('  Payment Status:', payment.status);

    const metadata = payment.metadata || {};
    const baseStars = metadata.base_stars || 0;
    const extraStars = metadata.extra_stars || 0;
    const bonusAmount = metadata.bonus_amount || 0;

    console.log('  Expected: Stars=' + (baseStars + extraStars) + ', Bonus=RM' + bonusAmount);

    // Update wallet transaction to success
    console.log('\n  Updating wallet transaction to SUCCESS...');
    const { error: walletUpdateError } = await supabase
      .from('wallet_transactions')
      .update({ status: 'success' })
      .eq('id', walletTx.id);

    if (walletUpdateError) {
      console.log('  ERROR:', walletUpdateError.message);
      continue;
    }
    console.log('  ✓ Wallet transaction updated');

    // Update payment transaction to success
    console.log('  Updating payment transaction to SUCCESS...');
    const { error: paymentUpdateError } = await supabase
      .from('payment_transactions')
      .update({ status: 'success' })
      .eq('id', payment.id);

    if (paymentUpdateError) {
      console.log('  ERROR:', paymentUpdateError.message);
    } else {
      console.log('  ✓ Payment transaction updated');
    }

    // Create stars transaction if needed
    if (baseStars + extraStars > 0) {
      console.log('  Creating stars transaction...');
      
      const { error: starsError } = await supabase
        .from('stars_transactions')
        .insert({
          user_id: user.id,
          transaction_type: 'earn',
          amount: baseStars + extraStars,
          multiplier: 1.0,
          source: 'wallet_topup',
          metadata: {
            topup_amount: walletTx.amount,
            payment_transaction_id: payment.id,
            wallet_transaction_id: walletTx.id,
            package_id: metadata.package_id,
            base_stars: baseStars,
            extra_stars: extraStars
          }
        });

      if (starsError) {
        console.log('  ERROR creating stars:', starsError.message);
      } else {
        console.log('  ✓ Stars transaction created (' + (baseStars + extraStars) + ' stars)');
      }
    }

    // Create bonus transaction if needed
    if (bonusAmount > 0) {
      console.log('  Creating bonus transaction...');

      // First get current bonus balance
      const { data: currentUser } = await supabase
        .from('users')
        .select('bonus_balance')
        .eq('id', user.id)
        .single();

      const oldBonus = currentUser?.bonus_balance || 0;
      const newBonus = oldBonus + bonusAmount;

      // Update users.bonus_balance
      const { error: bonusUpdateError } = await supabase
        .from('users')
        .update({ bonus_balance: newBonus })
        .eq('id', user.id);

      if (bonusUpdateError) {
        console.log('  ERROR updating bonus balance:', bonusUpdateError.message);
      } else {
        console.log('  ✓ Bonus balance updated (RM' + oldBonus + ' -> RM' + newBonus + ')');
      }

      // Create bonus_transactions record
      const { error: bonusTxError } = await supabase
        .from('bonus_transactions')
        .insert({
          user_id: user.id,
          transaction_type: 'topup_bonus',
          amount: bonusAmount,
          source: 'wallet_topup',
          description: 'Topup bonus from RM' + walletTx.amount + ' package',
          metadata: {
            topup_amount: walletTx.amount,
            payment_transaction_id: payment.id,
            wallet_transaction_id: walletTx.id,
            package_id: metadata.package_id
          }
        });

      if (bonusTxError) {
        console.log('  ERROR creating bonus transaction:', bonusTxError.message);
      } else {
        console.log('  ✓ Bonus transaction created (RM' + bonusAmount + ')');
      }
    }

    console.log('  ✓ TRANSACTION FIXED!');
  }
}

console.log('\n========================================');
console.log('COMPLETE - Please verify balances');
console.log('========================================\n');
