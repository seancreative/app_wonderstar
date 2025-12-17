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

// All missing stars transactions for all affected users
const affectedUsersData = [
  {
    user_id: '6030d878-61e3-4095-82c9-936951601369',
    email: 'Dansonhar8@gmail.com',
    transactions: [
      {
        wallet_transaction_id: '48372f46-0f2b-4b27-bbd0-67e9ee543723',
        amount: 1,
        stars: 5,
        base_stars: 5,
        extra_stars: 0,
        payment_transaction_id: 'TU-20251212-8539',
        created_at: '2025-12-12T01:17:47.641315+00:00'
      },
      {
        wallet_transaction_id: '72a951ea-04c5-44b3-a0ac-d63323584ac3',
        amount: 1,
        stars: 1,
        base_stars: 1,
        extra_stars: 0,
        payment_transaction_id: 'TU-20251212-5308',
        created_at: '2025-12-12T01:15:28.794636+00:00'
      }
    ]
  },
  {
    user_id: 'b4952b90-bbb2-4e03-b6af-89acd1037bc4',
    email: 'Danson33@gmail.com',
    transactions: [
      {
        wallet_transaction_id: '9550a279-7b3f-4a5b-8505-db36ce320424',
        amount: 1,
        stars: 1,
        base_stars: 1,
        extra_stars: 0,
        payment_transaction_id: 'TU-20251212-6676',
        created_at: '2025-12-12T01:10:00.901874+00:00'
      }
    ]
  },
  {
    user_id: '65496799-70d3-4d7d-a81b-67bd75668d48',
    email: 'izzulfitreee@gmail.com',
    transactions: [
      {
        wallet_transaction_id: '21c69467-87f1-4a76-918f-0410add10912',
        amount: 1,
        stars: 1,
        base_stars: 1,
        extra_stars: 0,
        payment_transaction_id: 'TU-20251211-1075',
        created_at: '2025-12-11T11:49:45.738965+00:00'
      },
      {
        wallet_transaction_id: 'a46586f2-8db9-4151-97df-ce863800b529',
        amount: 1,
        stars: 23,
        base_stars: 11,
        extra_stars: 12,
        payment_transaction_id: 'TU-20251211-8097',
        created_at: '2025-12-11T05:51:54.474275+00:00'
      }
    ]
  },
  {
    user_id: '6f7c1102-25db-4bc8-aa12-47bec52dc723',
    email: 'nabilah.akram@gmail.com',
    transactions: [
      {
        wallet_transaction_id: 'c81f0ba0-891f-4320-9bdb-5988c8df5690',
        amount: 1,
        stars: 23,
        base_stars: 11,
        extra_stars: 12,
        payment_transaction_id: 'TU-20251211-8279',
        created_at: '2025-12-11T07:22:31.892909+00:00'
      },
      {
        wallet_transaction_id: 'de5627d3-eab1-4b13-b634-baabe2827d82',
        amount: 1,
        stars: 23,
        base_stars: 11,
        extra_stars: 12,
        payment_transaction_id: 'TU-20251211-8314',
        created_at: '2025-12-11T06:42:04.533802+00:00'
      },
      {
        wallet_transaction_id: 'ed18dbfb-13d8-4faa-8ce7-e53820c799c2',
        amount: 1,
        stars: 23,
        base_stars: 11,
        extra_stars: 12,
        payment_transaction_id: 'TU-20251211-5958',
        created_at: '2025-12-11T06:13:05.193001+00:00'
      },
      {
        wallet_transaction_id: '733ec432-8f67-4ed6-a53b-b8b2b518b687',
        amount: 1,
        stars: 23,
        base_stars: 11,
        extra_stars: 12,
        payment_transaction_id: 'TU-20251211-1933',
        created_at: '2025-12-11T05:53:50.720202+00:00'
      },
      {
        wallet_transaction_id: 'f09eb32e-535f-4115-aa0e-ed4b9bbda777',
        amount: 1,
        stars: 23,
        base_stars: 11,
        extra_stars: 12,
        payment_transaction_id: 'TU-20251211-4812',
        created_at: '2025-12-11T05:50:17.722302+00:00'
      }
    ]
  }
];

async function awardAllMissingStars() {
  console.log('\n🌟 Awarding Missing Stars to ALL Affected Users\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const totalUsers = affectedUsersData.length;
  const totalTransactions = affectedUsersData.reduce((sum, user) => sum + user.transactions.length, 0);
  const totalStars = affectedUsersData.reduce((sum, user) =>
    sum + user.transactions.reduce((txSum, tx) => txSum + tx.stars, 0), 0
  );

  console.log(`Total Users: ${totalUsers}`);
  console.log(`Total Transactions: ${totalTransactions}`);
  console.log(`Total Stars to Award: ${totalStars}\n`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  let userSuccessCount = 0;
  let totalSuccessCount = 0;
  let totalFailCount = 0;

  for (const userData of affectedUsersData) {
    console.log(`\n👤 Processing: ${userData.email}`);
    console.log(`   User ID: ${userData.user_id}`);
    console.log(`   Transactions to process: ${userData.transactions.length}\n`);

    // Get current stars balance
    const { data: currentBalance } = await supabase
      .rpc('get_user_stars_balance', { p_user_id: userData.user_id });

    console.log(`   Current Balance: ${currentBalance || 0} stars`);

    let userStarsAwarded = 0;
    let userSuccessful = 0;
    let userFailed = 0;

    for (const tx of userData.transactions) {
      console.log(`\n   📝 Transaction: ${tx.wallet_transaction_id}`);
      console.log(`      Payment: ${tx.payment_transaction_id}`);
      console.log(`      Stars: ${tx.stars} (${tx.base_stars} base + ${tx.extra_stars} extra)`);

      // Check if already awarded
      const { data: existing } = await supabase
        .from('stars_transactions')
        .select('id')
        .eq('user_id', userData.user_id)
        .eq('source', 'wallet_topup')
        .eq('metadata->>wallet_transaction_id', tx.wallet_transaction_id)
        .maybeSingle();

      if (existing) {
        console.log(`      ⏭️  Already awarded (ID: ${existing.id})`);
        continue;
      }

      // Award the stars
      const { data: result, error } = await supabase
        .from('stars_transactions')
        .insert({
          user_id: userData.user_id,
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
        console.error(`      ❌ Failed:`, error.message);
        userFailed++;
        totalFailCount++;
      } else {
        console.log(`      ✅ Success (ID: ${result[0].id})`);
        userStarsAwarded += tx.stars;
        userSuccessful++;
        totalSuccessCount++;
      }
    }

    // Get final stars balance
    const { data: finalBalance } = await supabase
      .rpc('get_user_stars_balance', { p_user_id: userData.user_id });

    console.log(`\n   📊 User Summary:`);
    console.log(`      Successful: ${userSuccessful}`);
    console.log(`      Failed: ${userFailed}`);
    console.log(`      Balance: ${currentBalance || 0} → ${finalBalance || 0} (+${userStarsAwarded})`);

    if (userFailed === 0) {
      userSuccessCount++;
    }

    console.log('\n   ───────────────────────────────────────────────────────────');
  }

  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('🎉 FINAL SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`✅ Users Processed Successfully: ${userSuccessCount}/${totalUsers}`);
  console.log(`✅ Transactions Successful: ${totalSuccessCount}/${totalTransactions}`);
  console.log(`❌ Transactions Failed: ${totalFailCount}/${totalTransactions}`);
  console.log(`\n💫 Total Stars Awarded: ${totalStars - (totalFailCount * 5)}`); // Rough estimate
  console.log('═══════════════════════════════════════════════════════════════\n');
}

awardAllMissingStars().catch(console.error);
