import { supabase } from '../../lib/supabase';
import { getActiveConfiguration, GachaConfigurationWithTiers } from './configurationManager';

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function getNextAvailableLineNumber(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('egg_prize_lines')
      .select('line_number')
      .order('line_number', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }

    return data ? data.line_number + 1 : 1;
  } catch (error) {
    console.error('[DynamicGacha] Error getting next line number:', error);
    return 1;
  }
}

export async function generateLinesFromConfig(
  config: GachaConfigurationWithTiers,
  startLineNumber?: number
): Promise<{ success: boolean; linesGenerated: number; error?: string }> {
  try {
    console.log(`[DynamicGacha] Generating ${config.total_lines} lines from config ${config.id}`);

    const startLine = startLineNumber || (await getNextAvailableLineNumber());

    const prizes: { label: string; amount: number }[] = [];
    for (const tier of config.tiers) {
      const label = tier.prize_amount > 0
        ? `RM${tier.prize_amount.toFixed(2)} Bonus`
        : 'No Bonus';

      for (let i = 0; i < tier.prize_count; i++) {
        prizes.push({
          label,
          amount: tier.prize_amount
        });
      }
    }

    const shuffledPrizes = shuffleArray(prizes);

    const rows = shuffledPrizes.map((prize, index) => ({
      line_number: startLine + index,
      batch_number: Math.ceil((startLine + index) / config.total_lines),
      reward_label: prize.label,
      reward_amount: prize.amount,
      is_claimed: false,
      config_id: config.id,
    }));

    const chunkSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error: insertError } = await supabase
        .from('egg_prize_lines')
        .insert(chunk);

      if (insertError) {
        throw new Error(`Failed to insert batch: ${insertError.message}`);
      }
      totalInserted += chunk.length;
    }

    console.log(
      `[DynamicGacha] Generated ${totalInserted} lines (${startLine} to ${startLine + totalInserted - 1})`
    );

    return { success: true, linesGenerated: totalInserted };
  } catch (error) {
    console.error('[DynamicGacha] Error generating lines:', error);
    return {
      success: false,
      linesGenerated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function checkIfNewLinesNeeded(): Promise<{
  needsGeneration: boolean;
  unclaimedCount: number;
  threshold: number;
}> {
  try {
    const { count, error } = await supabase
      .from('egg_prize_lines')
      .select('*', { count: 'exact', head: true })
      .eq('is_claimed', false)
      .eq('is_revoked', false);

    if (error) {
      throw new Error(error.message);
    }

    const unclaimedCount = count || 0;
    const threshold = 10;

    return {
      needsGeneration: unclaimedCount < threshold,
      unclaimedCount,
      threshold,
    };
  } catch (error) {
    console.error('[DynamicGacha] Error checking if new lines needed:', error);
    return {
      needsGeneration: false,
      unclaimedCount: 0,
      threshold: 10,
    };
  }
}

export async function autoGenerateNextBatch(): Promise<{
  success: boolean;
  linesGenerated: number;
  error?: string;
}> {
  try {
    console.log('[DynamicGacha] Checking if auto-generation needed...');

    const check = await checkIfNewLinesNeeded();
    if (!check.needsGeneration) {
      console.log(
        `[DynamicGacha] No generation needed. Unclaimed: ${check.unclaimedCount}`
      );
      return { success: true, linesGenerated: 0 };
    }

    const config = await getActiveConfiguration();
    if (!config) {
      console.error('[DynamicGacha] No active configuration found');
      return {
        success: false,
        linesGenerated: 0,
        error: 'No active configuration',
      };
    }

    console.log(
      `[DynamicGacha] Auto-generating using config: ${config.config_name}`
    );

    const result = await generateLinesFromConfig(config);
    return result;
  } catch (error) {
    console.error('[DynamicGacha] Error in auto-generation:', error);
    return {
      success: false,
      linesGenerated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function initializeWithDefaultConfig(): Promise<{
  success: boolean;
  configId?: number;
  linesGenerated?: number;
  error?: string;
}> {
  try {
    const existingConfig = await getActiveConfiguration();
    if (existingConfig) {
      console.log('[DynamicGacha] Active configuration already exists');
      return { success: true, configId: existingConfig.id };
    }

    const { count } = await supabase
      .from('egg_prize_lines')
      .select('*', { count: 'exact', head: true });

    if (count && count > 0) {
      console.log('[DynamicGacha] Prize lines exist but no active config');
      return {
        success: false,
        error: 'Prize lines exist without configuration. Please set up a configuration in CMS.',
      };
    }

    console.log('[DynamicGacha] No configuration or lines found. System ready for setup.');
    return {
      success: true,
      linesGenerated: 0,
    };
  } catch (error) {
    console.error('[DynamicGacha] Error initializing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
