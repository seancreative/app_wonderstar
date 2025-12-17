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

async function fixTopup() {
  console.log('\n=== Fixing Topup TU-20251201-4086 ===\n');

  const orderNumber = 'TU-20251201-4086';
  const userId = 'b4952b90-bbb2-4e03-b6af-89acd1037bc4';

  // Step 1: Get shop_order
  const { data: order, error: orderError } = await supabase
    .from('shop_orders')
    .select('*')
    .eq('order_number', orderNumber)
    .single();

  if (orderError) {
    console.error('❌ Error fetching order:', orderError);
    return;
  }

  console.log('Order found:', {
    id: order.id,
    status: order.status,
    payment_status: order.payment_status,
    total_amount: order.total_amount
  });

  // Step 2: Get wallet_transaction
  const { data: walletTx, error: walletError } = await supabase
    .from('wallet_transactions')
    .select('*')
    .ilike('description', `%${orderNumber}%`)
    .maybeSingle();

  if (walletError || !walletTx) {
    console.error('❌ Error fetching wallet transaction:', walletError || 'Not found');

    // Try to find by user_id and order_id in metadata
    const { data: walletTxAlt, error: altError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!altError && walletTxAlt) {
      console.log('\n📋 Recent wallet transactions:');
      walletTxAlt.forEach(tx => {
        console.log(`  - ${tx.id}: ${tx.description} (${tx.status})`);
      });

      const found = walletTxAlt.find(tx =>
        tx.metadata?.order_number === orderNumber ||
        tx.metadata?.order_id === order.id ||
        tx.description?.includes(orderNumber)
      );

      if (found) {
        console.log('\n✓ Found matching transaction:', found.id);
        // Reassign the variable
        const walletTx = found;
        return { walletTx };
      } else {
        console.error('\n❌ No matching wallet transaction found');
        return;
      }
    } else {
      return;
    }
  }

  if (!walletTx) {
    console.error('❌ Wallet transaction is null');
    return;
  }

  console.log('\nWallet transaction found:', {
    id: walletTx.id,
    status: walletTx.status,
    amount: walletTx.amount
  });

  // Step 3: Update wallet_transaction to success
  console.log('\n📝 Updating wallet_transaction status to success...');

  const { error: walletUpdateError } = await supabase
    .from('wallet_transactions')
    .update({
      status: 'success',
      metadata: {
        ...walletTx.metadata,
        completed_at: new Date().toISOString(),
        manually_fixed: true,
        fixed_reason: 'Payment callback succeeded but status not updated',
        fixed_at: new Date().toISOString()
      }
    })
    .eq('id', walletTx.id);

  if (walletUpdateError) {
    console.error('❌ Failed to update wallet_transaction:', walletUpdateError);
    return;
  }

  console.log('✓ Wallet transaction updated to success');

  // Step 4: Award stars
  const metadata = walletTx.metadata || {};
  const baseStars = metadata.base_stars || 0;
  const extraStars = metadata.extra_stars || 0;
  const totalStars = baseStars + extraStars;

  if (totalStars > 0) {
    console.log(`\n⭐ Awarding ${totalStars} stars...`);

    // Check if stars already awarded
    const { data: existingStars } = await supabase
      .from('stars_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('metadata->>wallet_transaction_id', walletTx.id);

    if (existingStars && existingStars.length > 0) {
      console.log('ℹ️  Stars already awarded, skipping');
    } else {
      const { error: starsError } = await supabase
        .from('stars_transactions')
        .insert({
          user_id: userId,
          stars: totalStars,
          source: 'wallet_topup',
          description: `Top-up reward for ${orderNumber}`,
          metadata: {
            topup_amount: walletTx.amount,
            wallet_transaction_id: walletTx.id,
            package_id: metadata.package_id,
            base_stars: baseStars,
            extra_stars: extraStars,
            order_number: orderNumber
          }
        });

      if (starsError) {
        console.error('❌ Failed to award stars:', starsError);
      } else {
        console.log(`✓ ${totalStars} stars awarded`);
      }
    }
  }

  // Step 5: Award bonus if configured
  const bonusAmount = metadata.bonus_amount || 0;

  if (bonusAmount > 0) {
    console.log(`\n💰 Awarding bonus: RM${bonusAmount}...`);

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('bonus_balance')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('❌ Failed to fetch user:', userError);
    } else {
      const oldBonus = userData.bonus_balance || 0;
      const newBonus = oldBonus + bonusAmount;

      const { error: bonusError } = await supabase
        .from('users')
        .update({ bonus_balance: newBonus })
        .eq('id', userId);

      if (bonusError) {
        console.error('❌ Failed to update bonus:', bonusError);
      } else {
        console.log(`✓ Bonus updated: RM${oldBonus} -> RM${newBonus}`);
      }
    }
  }

  // Step 6: Update shop_order status
  console.log('\n📝 Updating shop_order status...');

  const { error: orderUpdateError } = await supabase
    .from('shop_orders')
    .update({
      status: 'completed',
      payment_status: 'paid',
      completed_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString()
    })
    .eq('id', order.id);

  if (orderUpdateError) {
    console.error('❌ Failed to update order:', orderUpdateError);
  } else {
    console.log('✓ Order status updated to completed/paid');
  }

  // Step 7: Verify balance
  console.log('\n=== Verification ===\n');

  const { data: allTx } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'success')
    .order('created_at', { ascending: true });

  let balance = 0;
  allTx?.forEach(tx => {
    if (tx.transaction_type === 'topup') {
      balance += parseFloat(tx.amount);
    } else if (tx.transaction_type === 'spend') {
      balance -= Math.abs(parseFloat(tx.amount));
    }
  });

  console.log(`User's W Balance: RM${balance.toFixed(2)}`);
  console.log(`Successful transactions: ${allTx?.length || 0}`);

  const { data: finalWallet } = await supabase
    .from('wallet_transactions')
    .select('status')
    .eq('id', walletTx.id)
    .single();

  const { data: finalOrder } = await supabase
    .from('shop_orders')
    .select('status, payment_status')
    .eq('id', order.id)
    .single();

  console.log(`\nWallet Transaction Status: ${finalWallet.status}`);
  console.log(`Order Status: ${finalOrder.status}`);
  console.log(`Payment Status: ${finalOrder.payment_status}`);

  console.log('\n✅ Fix Complete!\n');
}

fixTopup().catch(err => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});
