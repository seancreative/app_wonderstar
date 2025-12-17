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

async function fixAllStuckTopups() {
  console.log('\n=== Fixing All Stuck Wallet Topups ===\n');

  // Find all pending wallet transactions that have corresponding completed shop orders
  const { data: pendingTx, error: fetchError } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('transaction_type', 'topup')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('❌ Error fetching pending transactions:', fetchError);
    return;
  }

  console.log(`Found ${pendingTx?.length || 0} pending topup transactions\n`);

  if (!pendingTx || pendingTx.length === 0) {
    console.log('✅ No stuck topups found!\n');
    return;
  }

  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const tx of pendingTx) {
    const orderId = tx.metadata?.order_id;
    const orderNumber = tx.metadata?.order_number;

    console.log(`\n📋 Checking transaction ${tx.id}`);
    console.log(`   Order: ${orderNumber || 'N/A'}`);
    console.log(`   Amount: RM${tx.amount}`);
    console.log(`   Created: ${new Date(tx.created_at).toLocaleString()}`);

    if (!orderId) {
      console.log('   ⚠️  No order_id in metadata, skipping');
      skipped++;
      continue;
    }

    // Check if related shop_order exists and what its status is
    const { data: order, error: orderError } = await supabase
      .from('shop_orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) {
      console.log('   ⚠️  Order not found, skipping');
      skipped++;
      continue;
    }

    console.log(`   Order Status: ${order.status} / Payment: ${order.payment_status}`);

    // Check if payment was actually made (heuristic: order created more than 5 minutes ago but still pending)
    const orderAge = Date.now() - new Date(order.created_at).getTime();
    const fiveMinutes = 5 * 60 * 1000;

    // If order is very old and still pending, likely abandoned
    if (orderAge > 24 * 60 * 60 * 1000 && order.payment_status === 'pending') {
      console.log('   ⏰ Order older than 24 hours and still pending, likely abandoned');
      skipped++;
      continue;
    }

    // Try to determine if payment was successful
    // Check if there are any successful indicators
    let shouldFix = false;

    // Heuristic 1: Order has been updated recently (within last hour) but wallet tx still pending
    const orderUpdatedAge = Date.now() - new Date(order.updated_at).getTime();
    if (orderUpdatedAge < 60 * 60 * 1000 && order.payment_status !== 'paid') {
      console.log('   🔍 Order recently updated but payment not marked as paid');
      shouldFix = true;
    }

    // Heuristic 2: User manually confirmed (this would be from user report)
    if (orderNumber === 'TU-20251201-4086') {
      console.log('   ✅ User confirmed payment success');
      shouldFix = true;
    }

    if (!shouldFix) {
      console.log('   ⏭️  No clear indication of successful payment, skipping');
      skipped++;
      continue;
    }

    // Fix the transaction
    console.log('   🔧 Fixing transaction...');

    try {
      // Update wallet_transaction
      const { error: updateError } = await supabase
        .from('wallet_transactions')
        .update({
          status: 'success',
          metadata: {
            ...tx.metadata,
            completed_at: new Date().toISOString(),
            manually_fixed: true,
            fixed_reason: 'Auto-fix for stuck topup',
            fixed_at: new Date().toISOString()
          }
        })
        .eq('id', tx.id);

      if (updateError) {
        console.error('   ❌ Failed to update wallet transaction:', updateError);
        errors++;
        continue;
      }

      console.log('   ✓ Wallet transaction updated');

      // Award stars if configured
      const metadata = tx.metadata || {};
      const baseStars = metadata.base_stars || 0;
      const extraStars = metadata.extra_stars || 0;
      const totalStars = baseStars + extraStars;

      if (totalStars > 0) {
        // Check if already awarded
        const { data: existingStars } = await supabase
          .from('stars_transactions')
          .select('id')
          .eq('user_id', tx.user_id)
          .eq('metadata->>wallet_transaction_id', tx.id);

        if (!existingStars || existingStars.length === 0) {
          const { error: starsError } = await supabase
            .from('stars_transactions')
            .insert({
              user_id: tx.user_id,
              transaction_type: 'earn',
              amount: totalStars,
              source: 'wallet_topup',
              metadata: {
                topup_amount: tx.amount,
                wallet_transaction_id: tx.id,
                package_id: metadata.package_id,
                base_stars: baseStars,
                extra_stars: extraStars,
                order_number: orderNumber,
                auto_fixed: true
              }
            });

          if (starsError) {
            console.error('   ⚠️  Failed to award stars:', starsError.message);
          } else {
            console.log(`   ✓ Awarded ${totalStars} stars`);
          }
        } else {
          console.log('   ℹ️  Stars already awarded');
        }
      }

      // Update shop_order (trigger should handle this, but double-check)
      const { error: orderUpdateError } = await supabase
        .from('shop_orders')
        .update({
          status: 'completed',
          payment_status: 'paid',
          completed_at: new Date().toISOString(),
          confirmed_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .eq('payment_status', 'pending'); // Only if still pending

      if (!orderUpdateError) {
        console.log('   ✓ Order status updated');
      }

      console.log('   ✅ Transaction fixed successfully');
      fixed++;
    } catch (err) {
      console.error('   ❌ Error fixing transaction:', err);
      errors++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total pending: ${pendingTx.length}`);
  console.log(`Fixed: ${fixed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log('');
}

fixAllStuckTopups().then(() => {
  console.log('✅ Fix complete\n');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});
