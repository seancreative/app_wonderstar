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

const userId = '65496799-70d3-4d7d-a81b-67bd75668d48';

const missingStarsTransactions = [
  {
    wallet_transaction_id: '66308968-211c-45c9-bd02-810342424adc',
    amount: 1,
    stars: 10001,
    base_stars: 1,
    extra_stars: 10000,
    payment_transaction_id: 'TU-20251212-5472',
    created_at: '2025-12-12T03:21:44.743294+00:00'
  },
  {
    wallet_transaction_id: 'f300d83a-3c2a-4c82-860c-04c0542a0856',
    amount: 1,
    stars: 10001,
    base_stars: 1,
    extra_stars: 10000,
    payment_transaction_id: 'TU-20251212-5222',
    created_at: '2025-12-12T02:19:27.828055+00:00'
  },
  {
    wallet_transaction_id: '3d3d79e1-2827-4072-9a90-1e27d29b7ee0',
    amount: 1,
    stars: 5,
    base_stars: 5,
    extra_stars: 0,
    payment_transaction_id: 'TU-20251212-9070',
    created_at: '2025-12-12T02:06:01.242281+00:00'
  },
  {
    wallet_transaction_id: '1492f08c-6515-4ba6-a4b0-fbe5f923f357',
    amount: 1,
    stars: 5,
    base_stars: 5,
    extra_stars: 0,
    payment_transaction_id: 'TU-20251212-8903',
    created_at: '2025-12-12T01:24:43.293128+00:00'
  }
];

async function awardMissingStars() {
  console.log('\n🌟 Awarding Missing Stars to izzulfitreee@gmail.com\n');
  console.log(`User ID: ${userId}`);
  console.log(`Total Missing Stars: ${missingStarsTransactions.reduce((sum, tx) => sum + tx.stars, 0)}\n`);

  // Get current stars balance
  const { data: currentBalance } = await supabase
    .rpc('get_user_stars_balance', { p_user_id: userId });

  console.log(`Current Stars Balance: ${currentBalance || 0}\n`);

  let successCount = 0;
  let failCount = 0;

  for (const tx of missingStarsTransactions) {
    console.log(`\n📝 Processing transaction ${tx.wallet_transaction_id}`);
    console.log(`   Payment: ${tx.payment_transaction_id}`);
    console.log(`   Stars to award: ${tx.stars} (${tx.base_stars} base + ${tx.extra_stars} extra)`);

    // Check if already awarded
    const { data: existing } = await supabase
      .from('stars_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('source', 'wallet_topup')
      .eq('metadata->>wallet_transaction_id', tx.wallet_transaction_id)
      .maybeSingle();

    if (existing) {
      console.log(`   ⏭️  Already awarded (transaction: ${existing.id})`);
      continue;
    }

    // Award the stars
    const { data: result, error } = await supabase
      .from('stars_transactions')
      .insert({
        user_id: userId,
        transaction_type: 'earn',
        amount: tx.stars,
        source: 'wallet_topup',
        metadata: {
          topup_amount: tx.amount,
          payment_transaction_id: tx.payment_transaction_id,
          wallet_transaction_id: tx.wallet_transaction_id,
          base_stars: tx.base_stars,
          extra_stars: tx.extra_stars,
          retroactive_award: true,
          awarded_at: new Date().toISOString(),
          original_transaction_date: tx.created_at,
          reason: 'Retroactive award due to balance_after column bug in PaymentCallback.tsx'
        }
      })
      .select();

    if (error) {
      console.error(`   ❌ Failed to award stars:`, error.message);
      failCount++;
    } else {
      console.log(`   ✅ Stars awarded successfully! (Transaction ID: ${result[0].id})`);
      successCount++;
    }
  }

  // Get final stars balance
  const { data: finalBalance } = await supabase
    .rpc('get_user_stars_balance', { p_user_id: userId });

  console.log('\n\n═══════════════════════════════════════');
  console.log('📊 Summary');
  console.log('═══════════════════════════════════════');
  console.log(`✅ Successfully awarded: ${successCount} transactions`);
  console.log(`❌ Failed: ${failCount} transactions`);
  console.log(`\n💫 Stars Balance:`);
  console.log(`   Before: ${currentBalance || 0}`);
  console.log(`   After:  ${finalBalance || 0}`);
  console.log(`   Awarded: +${(finalBalance || 0) - (currentBalance || 0)}`);
  console.log('═══════════════════════════════════════\n');
}

awardMissingStars().catch(console.error);
