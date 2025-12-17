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

async function checkAllUsersMissingStars() {
  console.log('\n🔍 Checking ALL users for missing stars from wallet topups\n');

  // Get all successful topups that should have awarded stars
  const { data: allTopups, error: topupsError } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('transaction_type', 'topup')
    .eq('status', 'success')
    .gte('created_at', '2025-12-11T00:00:00')  // Check from Dec 11 onwards
    .order('created_at', { ascending: false });

  if (topupsError) {
    console.error('❌ Error fetching topups:', topupsError);
    return;
  }

  console.log(`Found ${allTopups.length} successful topup transactions since Dec 11\n`);

  const affectedUsers = new Map();

  for (const topup of allTopups) {
    const baseStars = topup.metadata?.base_stars || 0;
    const extraStars = topup.metadata?.extra_stars || 0;
    const totalStars = baseStars + extraStars;

    // Only check topups that should have awarded stars
    if (totalStars > 0) {
      // Check if stars were awarded
      const { data: starsTx } = await supabase
        .from('stars_transactions')
        .select('id, metadata')
        .eq('user_id', topup.user_id)
        .eq('source', 'wallet_topup')
        .eq('metadata->>wallet_transaction_id', topup.id)
        .maybeSingle();

      // If no stars transaction found, or if it's not a retroactive award
      if (!starsTx || !starsTx.metadata?.retroactive_award) {
        if (!affectedUsers.has(topup.user_id)) {
          // Get user info
          const { data: user } = await supabase
            .from('users')
            .select('id, email, name, phone')
            .eq('id', topup.user_id)
            .maybeSingle();

          if (user) {
            affectedUsers.set(topup.user_id, {
              user,
              missingTransactions: []
            });
          }
        }

        const userData = affectedUsers.get(topup.user_id);
        if (userData) {
          userData.missingTransactions.push({
            transaction_id: topup.id,
            amount: topup.amount,
            stars: totalStars,
            base_stars: baseStars,
            extra_stars: extraStars,
            payment_transaction_id: topup.metadata?.payment_transaction_id,
            created_at: topup.created_at,
            already_awarded_retroactively: !!starsTx?.metadata?.retroactive_award
          });
        }
      }
    }
  }

  if (affectedUsers.size === 0) {
    console.log('✅ No users found with missing stars!\n');
    return;
  }

  console.log(`⚠️  Found ${affectedUsers.size} user(s) with missing stars:\n`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  let totalMissingStars = 0;

  for (const [userId, userData] of affectedUsers.entries()) {
    const userMissingStars = userData.missingTransactions.reduce((sum, tx) => sum + tx.stars, 0);
    totalMissingStars += userMissingStars;

    console.log(`👤 User: ${userData.user.name || 'N/A'} (${userData.user.email})`);
    console.log(`   ID: ${userId}`);
    console.log(`   Phone: ${userData.user.phone || 'N/A'}`);
    console.log(`   Total Missing Stars: ${userMissingStars}`);
    console.log(`   Missing from ${userData.missingTransactions.length} transaction(s):\n`);

    for (const tx of userData.missingTransactions) {
      console.log(`   - Transaction: ${tx.transaction_id}`);
      console.log(`     Payment: ${tx.payment_transaction_id || 'N/A'}`);
      console.log(`     Amount: RM${tx.amount}`);
      console.log(`     Missing Stars: ${tx.stars} (${tx.base_stars} base + ${tx.extra_stars} extra)`);
      console.log(`     Date: ${tx.created_at}`);
      console.log(`     Retroactive Award: ${tx.already_awarded_retroactively ? '✅' : '❌'}\n`);
    }

    console.log('───────────────────────────────────────────────────────────────\n');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total Affected Users: ${affectedUsers.size}`);
  console.log(`Total Missing Stars: ${totalMissingStars}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

checkAllUsersMissingStars().catch(console.error);
