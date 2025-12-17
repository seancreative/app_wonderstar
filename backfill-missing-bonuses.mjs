/**
 * Backfill Missing Bonus Balances from Historical Topups
 *
 * This script finds all successful wallet topups that have bonus_amount in metadata
 * but no corresponding bonus_transaction, and awards the missing bonuses.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY);

console.log('========================================');
console.log('BACKFILL MISSING BONUS BALANCES');
console.log('========================================\n');

async function backfillMissingBonuses() {
  try {
    // Step 1: Find all successful topup transactions
    console.log('Step 1: Finding all successful wallet topups...\n');
    const { data: topups, error: topupsError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('transaction_type', 'topup')
      .eq('status', 'success')
      .order('created_at', { ascending: true });

    if (topupsError) {
      console.error('Error fetching topups:', topupsError);
      return;
    }

    console.log(`Found ${topups.length} successful topup transactions\n`);

    // Step 2: Check which ones have bonus_amount but no bonus_transaction
    let processedCount = 0;
    let skippedCount = 0;
    let awardedCount = 0;
    let totalBonusAwarded = 0;

    for (const topup of topups) {
      processedCount++;
      const metadata = topup.metadata || {};
      const bonusAmount = metadata.bonus_amount || 0;

      if (bonusAmount <= 0) {
        skippedCount++;
        continue;
      }

      // Check if bonus_transaction exists
      const { data: existingBonus } = await supabase
        .from('bonus_transactions')
        .select('id')
        .eq('user_id', topup.user_id)
        .eq('transaction_type', 'topup_bonus')
        .eq('metadata->>wallet_transaction_id', topup.id)
        .maybeSingle();

      if (existingBonus) {
        console.log(`✓ Topup ${topup.id.substring(0, 8)} - Bonus already exists`);
        skippedCount++;
        continue;
      }

      // Bonus is missing, award it now
      console.log(`\n⚠️ Topup ${topup.id.substring(0, 8)} - MISSING BONUS of RM${bonusAmount}`);
      console.log(`   User: ${topup.user_id}`);
      console.log(`   Date: ${topup.created_at}`);
      console.log(`   Amount: RM${topup.amount}`);

      try {
        // Get current bonus balance
        const { data: currentUser } = await supabase
          .from('users')
          .select('bonus_balance')
          .eq('id', topup.user_id)
          .single();

        const currentBonusBalance = currentUser?.bonus_balance || 0;
        const newBonusBalance = currentBonusBalance + bonusAmount;

        console.log(`   Current balance: RM${currentBonusBalance}`);
        console.log(`   New balance: RM${newBonusBalance}`);

        // Insert bonus_transaction
        const { data: bonusTxData, error: bonusTxError } = await supabase
          .from('bonus_transactions')
          .insert({
            user_id: topup.user_id,
            order_id: metadata.order_id || null,
            amount: bonusAmount,
            transaction_type: 'topup_bonus',
            order_number: metadata.order_number || metadata.payment_transaction_id || `BACKFILL-${topup.id.substring(0, 8)}`,
            description: `Bonus from wallet top-up: RM${topup.amount.toFixed(2)} (backfilled)`,
            created_at: topup.created_at, // Use original topup date
            metadata: {
              payment_transaction_id: metadata.payment_transaction_id,
              wallet_transaction_id: topup.id,
              package_id: metadata.package_id,
              topup_amount: topup.amount,
              completed_at: metadata.completed_at || topup.created_at,
              backfilled: true,
              backfill_date: new Date().toISOString()
            }
          })
          .select()
          .single();

        if (bonusTxError) {
          if (bonusTxError.code === '23505') {
            console.log('   ⚠️ Duplicate constraint - bonus already exists');
            skippedCount++;
          } else {
            console.error('   ❌ Failed to create bonus transaction:', bonusTxError);
            skippedCount++;
          }
          continue;
        }

        // Update user bonus balance
        const { error: updateError } = await supabase
          .from('users')
          .update({ bonus_balance: newBonusBalance })
          .eq('id', topup.user_id);

        if (updateError) {
          console.error('   ❌ Failed to update user balance:', updateError);
          // Rollback - delete the bonus transaction
          await supabase
            .from('bonus_transactions')
            .delete()
            .eq('id', bonusTxData.id);
          skippedCount++;
          continue;
        }

        // Update bonus_transaction with balance_after
        await supabase
          .from('bonus_transactions')
          .update({ balance_after: newBonusBalance })
          .eq('id', bonusTxData.id);

        console.log(`   ✅ Bonus awarded successfully!`);
        awardedCount++;
        totalBonusAwarded += bonusAmount;

      } catch (error) {
        console.error(`   ❌ Error processing topup:`, error);
        skippedCount++;
      }
    }

    // Summary
    console.log('\n========================================');
    console.log('BACKFILL COMPLETE');
    console.log('========================================');
    console.log(`Total topups processed: ${processedCount}`);
    console.log(`Bonuses awarded: ${awardedCount}`);
    console.log(`Already existed/skipped: ${skippedCount}`);
    console.log(`Total bonus amount awarded: RM${totalBonusAwarded.toFixed(2)}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

await backfillMissingBonuses();
