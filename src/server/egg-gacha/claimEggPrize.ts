import { supabase } from '../../lib/supabase';
import { autoGenerateNextBatch } from './dynamicPrizeGenerator';

export interface ClaimResult {
  status: 'ok' | 'no_prizes_left' | 'error';
  line_number?: number;
  reward_amount?: number;
  reward_label?: string;
  claimed_at?: string;
  error?: string;
}

export async function claimEggPrize(
  userId: string,
  username: string
): Promise<ClaimResult> {
  try {
    console.log(`[EggGacha] Claim request from user: ${username} (${userId})`);

    const { data: prizeLine, error: selectError } = await supabase
      .from('egg_prize_lines')
      .select('*')
      .eq('is_claimed', false)
      .eq('is_revoked', false)
      .order('line_number', { ascending: true })
      .limit(1)
      .single();

    if (selectError || !prizeLine) {
      console.log('[EggGacha] No unclaimed prizes available');
      return { status: 'no_prizes_left' };
    }

    console.log(`[EggGacha] Claiming line ${prizeLine.line_number}...`);

    const { error: updateError } = await supabase
      .from('egg_prize_lines')
      .update({
        is_claimed: true,
        claimed_by_user_id: userId,
        claimed_by_username: username,
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', prizeLine.id)
      .eq('is_claimed', false);

    if (updateError) {
      throw new Error(`Failed to claim prize: ${updateError.message}`);
    }

    const { error: redemptionError } = await supabase
      .from('egg_redemptions')
      .insert({
        prize_line_id: prizeLine.id,
        user_id: userId,
        username: username,
        reward_amount: prizeLine.reward_amount,
        reward_label: prizeLine.reward_label,
        claimed_at: new Date().toISOString(),
      });

    if (redemptionError) {
      console.error('[EggGacha] Failed to log redemption:', redemptionError);
    }

    if (prizeLine.reward_amount > 0) {
      console.log(`[EggGacha] Awarding bonus atomically to ${username}`);

      const { data: result, error: atomicError } = await supabase
        .rpc('update_bonus_balance_atomic', {
          p_user_id: userId,
          p_amount: parseFloat(prizeLine.reward_amount),
          p_transaction_type: 'earn',
          p_description: `Won ${prizeLine.reward_label} from Egg Gacha`,
          p_order_number: `GACHA-${prizeLine.line_number}`,
          p_metadata: {
            prize_line_id: prizeLine.id,
            line_number: prizeLine.line_number,
            reward_label: prizeLine.reward_label,
            source: 'egg_gacha',
            claimed_by_username: username
          }
        });

      if (atomicError || !result?.[0]?.success) {
        console.error('[EggGacha] Failed to award bonus:', atomicError || result?.[0]?.message);
        throw new Error('Failed to award gacha prize bonus');
      }

      console.log(`[EggGacha] ✅ Bonus awarded successfully:`, {
        transaction_id: result[0].transaction_id,
        new_balance: result[0].new_balance,
        amount: parseFloat(prizeLine.reward_amount)
      });
    }

    setTimeout(() => {
      autoGenerateNextBatch().catch(console.error);
    }, 100);

    return {
      status: 'ok',
      line_number: prizeLine.line_number,
      reward_amount: parseFloat(prizeLine.reward_amount),
      reward_label: prizeLine.reward_label,
      claimed_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[EggGacha] Claim error:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
