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

async function fixStuckTopup() {
  console.log('\n=== Fixing Stuck Topup TU-20251201-4086 ===\n');

  const walletTxId = '688c611c-9377-4e41-b1f9-842548fc9ec0';
  const orderId = '7f68fb2a-09d9-4462-a762-fd6b1a13d00c';
  const userId = 'b4952b90-bbb2-4e03-b6af-89acd1037bc4';
  const orderNumber = 'TU-20251201-4086';

  // Step 1: Update wallet_transaction to success
  console.log('📝 Updating wallet_transaction to success...');

  const { data: walletTx, error: fetchError } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('id', walletTxId)
    .single();

  if (fetchError) {
    console.error('❌ Error fetching wallet transaction:', fetchError);
    return;
  }

  console.log('Current status:', walletTx.status);

  const { error: updateError } = await supabase
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
    .eq('id', walletTxId);

  if (updateError) {
    console.error('❌ Failed to update:', updateError);
    return;
  }

  console.log('✅ Wallet transaction updated to success\n');

  // Step 2: Award stars
  const metadata = walletTx.metadata || {};
  const baseStars = metadata.base_stars || 0;
  const extraStars = metadata.extra_stars || 0;
  const totalStars = baseStars + extraStars;

  if (totalStars > 0) {
    console.log(`⭐ Awarding ${totalStars} stars (${baseStars} base + ${extraStars} extra)...`);

    const { data: existing } = await supabase
      .from('stars_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('metadata->>wallet_transaction_id', walletTxId);

    if (existing && existing.length > 0) {
      console.log('ℹ️  Stars already awarded\n');
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
            wallet_transaction_id: walletTxId,
            package_id: metadata.package_id,
            base_stars: baseStars,
            extra_stars: extraStars,
            order_number: orderNumber
          }
        });

      if (starsError) {
        console.error('❌ Failed to award stars:', starsError);
      } else {
        console.log(`✅ ${totalStars} stars awarded\n`);
      }
    }
  }

  // Step 3: Update shop_order
  console.log('📝 Updating shop_order status...');

  const { error: orderError } = await supabase
    .from('shop_orders')
    .update({
      status: 'completed',
      payment_status: 'paid',
      completed_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString()
    })
    .eq('id', orderId);

  if (orderError) {
    console.error('❌ Failed to update order:', orderError);
  } else {
    console.log('✅ Order updated to completed/paid\n');
  }

  // Step 4: Verify
  console.log('=== Verification ===\n');

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

  console.log(`✅ User's W Balance: RM${balance.toFixed(2)}`);
  console.log(`✅ Successful transactions: ${allTx?.length || 0}`);

  const { data: finalWallet } = await supabase
    .from('wallet_transactions')
    .select('status')
    .eq('id', walletTxId)
    .single();

  const { data: finalOrder } = await supabase
    .from('shop_orders')
    .select('status, payment_status')
    .eq('id', orderId)
    .single();

  console.log(`\n✅ Wallet Transaction: ${finalWallet?.status}`);
  console.log(`✅ Order Status: ${finalOrder?.status}`);
  console.log(`✅ Payment Status: ${finalOrder?.payment_status}`);

  console.log('\n🎉 Fix Complete!\n');
}

fixStuckTopup().catch(err => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});
