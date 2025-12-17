import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file manually
const envFile = readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length > 0) {
    env[key.trim()] = value.join('=').trim();
  }
});

const supabase = createClient(
  env.SUPABASE_URL || env.VITE_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseIzzulStars() {
  console.log('\n🔍 Diagnosing missing stars for izzulfitreee@gmail.com\n');

  // 1. Find the user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, name, phone')
    .eq('email', 'izzulfitreee@gmail.com')
    .maybeSingle();

  if (userError || !user) {
    console.error('❌ User not found:', userError);
    return;
  }

  console.log('✅ User found:', {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone
  });

  // Get wallet balance
  const { data: walletBalance, error: walletBalError } = await supabase
    .from('user_wallet_balances')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (walletBalance) {
    console.log('💰 Wallet Balance:', {
      w_balance: walletBalance.w_balance,
      bonus_balance: walletBalance.bonus_balance
    });
  }

  // 2. Get current stars balance
  const { data: starsBalance, error: starsError } = await supabase
    .rpc('get_user_stars_balance', { p_user_id: user.id });

  console.log('\n⭐ Current Stars Balance:', starsBalance || 0);

  // 3. Find the RM1 topup transaction
  const { data: topups, error: topupError } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', user.id)
    .eq('transaction_type', 'topup')
    .eq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(5);

  if (topupError) {
    console.error('❌ Error fetching topups:', topupError);
    return;
  }

  console.log('\n💰 Recent Topup Transactions:');
  for (const topup of topups) {
    const baseStars = topup.metadata?.base_stars || 0;
    const extraStars = topup.metadata?.extra_stars || 0;
    const totalStars = baseStars + extraStars;

    console.log(`\n  Transaction ID: ${topup.id}`);
    console.log(`  Amount: RM${topup.amount}`);
    console.log(`  Created: ${topup.created_at}`);
    console.log(`  Base Stars: ${baseStars}`);
    console.log(`  Extra Stars: ${extraStars}`);
    console.log(`  Total Stars: ${totalStars}`);
    console.log(`  Payment TX: ${topup.metadata?.payment_transaction_id || 'N/A'}`);

    // Check if stars were awarded for this topup
    const { data: starsTx, error: starsTxError } = await supabase
      .from('stars_transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('source', 'wallet_topup')
      .eq('metadata->>wallet_transaction_id', topup.id)
      .maybeSingle();

    if (starsTxError && starsTxError.code !== 'PGRST116') {
      console.log(`  ⚠️  Error checking stars: ${starsTxError.message}`);
    } else if (starsTx) {
      console.log(`  ✅ Stars awarded: ${starsTx.amount} (Transaction: ${starsTx.id})`);
    } else {
      console.log(`  ❌ NO STARS AWARDED - This is the problem!`);
    }
  }

  // 4. Check all stars transactions
  console.log('\n\n⭐ All Stars Transactions:');
  const { data: allStars, error: allStarsError } = await supabase
    .from('stars_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (allStarsError) {
    console.error('❌ Error fetching stars:', allStarsError);
  } else {
    for (const star of allStars) {
      console.log(`\n  ID: ${star.id}`);
      console.log(`  Type: ${star.transaction_type}`);
      console.log(`  Amount: ${star.amount}`);
      console.log(`  Source: ${star.source}`);
      console.log(`  Created: ${star.created_at}`);
      console.log(`  Balance After: ${star.balance_after || 'N/A'}`);
    }
  }

  // 5. Find topups missing stars
  console.log('\n\n🔍 Identifying ALL topups missing stars...\n');

  const { data: allSuccessfulTopups, error: allTopupsError } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', user.id)
    .eq('transaction_type', 'topup')
    .eq('status', 'success')
    .order('created_at', { ascending: false });

  if (allTopupsError) {
    console.error('❌ Error fetching all topups:', allTopupsError);
    return;
  }

  const missingStars = [];
  for (const topup of allSuccessfulTopups) {
    const baseStars = topup.metadata?.base_stars || 0;
    const extraStars = topup.metadata?.extra_stars || 0;
    const totalStars = baseStars + extraStars;

    if (totalStars > 0) {
      const { data: starsTx } = await supabase
        .from('stars_transactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('source', 'wallet_topup')
        .eq('metadata->>wallet_transaction_id', topup.id)
        .maybeSingle();

      if (!starsTx) {
        missingStars.push({
          transaction_id: topup.id,
          amount: topup.amount,
          stars: totalStars,
          base_stars: baseStars,
          extra_stars: extraStars,
          created_at: topup.created_at,
          metadata: topup.metadata
        });
      }
    }
  }

  if (missingStars.length > 0) {
    console.log(`⚠️  Found ${missingStars.length} topup(s) missing stars:\n`);
    for (const missing of missingStars) {
      console.log(`  - Transaction: ${missing.transaction_id}`);
      console.log(`    Amount: RM${missing.amount}`);
      console.log(`    Missing Stars: ${missing.stars} (${missing.base_stars} base + ${missing.extra_stars} extra)`);
      console.log(`    Date: ${missing.created_at}\n`);
    }
  } else {
    console.log('✅ No missing stars found!');
  }
}

diagnoseIzzulStars().catch(console.error);
