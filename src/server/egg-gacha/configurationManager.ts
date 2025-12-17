import { supabase } from '../../lib/supabase';

export interface PrizeTier {
  tier_order: number;
  prize_amount: number;
  prize_count: number;
}

export interface GachaConfiguration {
  id: number;
  config_name: string;
  total_lines: number;
  is_active: boolean;
  created_by_admin_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GachaConfigurationWithTiers extends GachaConfiguration {
  tiers: PrizeTier[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  configuredLines: number;
  expectedLines: number;
  totalValue: number;
}

export async function createGachaConfiguration(
  configName: string,
  totalLines: number,
  tiers: PrizeTier[],
  adminId: string
): Promise<{ success: boolean; configId?: number; error?: string }> {
  try {
    const validation = validateConfiguration(totalLines, tiers);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', '),
      };
    }

    const { data: config, error: configError } = await supabase
      .from('egg_gacha_configurations')
      .insert({
        config_name: configName,
        total_lines: totalLines,
        is_active: false,
        created_by_admin_id: adminId,
      })
      .select()
      .single();

    if (configError || !config) {
      throw new Error(configError?.message || 'Failed to create configuration');
    }

    const tierInserts = tiers.map((tier) => ({
      config_id: config.id,
      tier_order: tier.tier_order,
      prize_amount: tier.prize_amount,
      prize_count: tier.prize_count,
    }));

    const { error: tiersError } = await supabase
      .from('egg_gacha_prize_tiers')
      .insert(tierInserts);

    if (tiersError) {
      await supabase.from('egg_gacha_configurations').delete().eq('id', config.id);
      throw new Error(tiersError.message);
    }

    console.log(`[GachaConfig] Created configuration: ${configName} (ID: ${config.id})`);
    return { success: true, configId: config.id };
  } catch (error) {
    console.error('[GachaConfig] Error creating configuration:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getActiveConfiguration(): Promise<GachaConfigurationWithTiers | null> {
  try {
    const { data: config, error: configError } = await supabase
      .from('egg_gacha_configurations')
      .select('*')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      return null;
    }

    const { data: tiers, error: tiersError } = await supabase
      .from('egg_gacha_prize_tiers')
      .select('*')
      .eq('config_id', config.id)
      .order('tier_order');

    if (tiersError) {
      throw new Error(tiersError.message);
    }

    return {
      ...config,
      tiers: tiers || [],
    };
  } catch (error) {
    console.error('[GachaConfig] Error getting active configuration:', error);
    return null;
  }
}

export async function getConfigurationWithTiers(
  configId: number
): Promise<GachaConfigurationWithTiers | null> {
  try {
    const { data: config, error: configError } = await supabase
      .from('egg_gacha_configurations')
      .select('*')
      .eq('id', configId)
      .single();

    if (configError || !config) {
      return null;
    }

    const { data: tiers, error: tiersError } = await supabase
      .from('egg_gacha_prize_tiers')
      .select('*')
      .eq('config_id', config.id)
      .order('tier_order');

    if (tiersError) {
      throw new Error(tiersError.message);
    }

    return {
      ...config,
      tiers: tiers || [],
    };
  } catch (error) {
    console.error('[GachaConfig] Error getting configuration:', error);
    return null;
  }
}

export async function getAllConfigurations(): Promise<GachaConfiguration[]> {
  try {
    const { data, error } = await supabase
      .from('egg_gacha_configurations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  } catch (error) {
    console.error('[GachaConfig] Error getting configurations:', error);
    return [];
  }
}

export async function setActiveConfiguration(
  configId: number,
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('egg_gacha_configurations')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', configId);

    if (error) {
      throw new Error(error.message);
    }

    console.log(`[GachaConfig] Set configuration ${configId} as active by ${adminId}`);
    return { success: true };
  } catch (error) {
    console.error('[GachaConfig] Error setting active configuration:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function deleteConfiguration(
  configId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: config } = await supabase
      .from('egg_gacha_configurations')
      .select('is_active')
      .eq('id', configId)
      .single();

    if (config?.is_active) {
      return {
        success: false,
        error: 'Cannot delete active configuration',
      };
    }

    const { data: linesUsing } = await supabase
      .from('egg_prize_lines')
      .select('id')
      .eq('config_id', configId)
      .limit(1);

    if (linesUsing && linesUsing.length > 0) {
      return {
        success: false,
        error: 'Cannot delete configuration that has been used to generate prizes',
      };
    }

    const { error } = await supabase
      .from('egg_gacha_configurations')
      .delete()
      .eq('id', configId);

    if (error) {
      throw new Error(error.message);
    }

    console.log(`[GachaConfig] Deleted configuration ${configId}`);
    return { success: true };
  } catch (error) {
    console.error('[GachaConfig] Error deleting configuration:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function validateConfiguration(
  totalLines: number,
  tiers: PrizeTier[]
): ValidationResult {
  const errors: string[] = [];

  if (!totalLines || totalLines <= 0) {
    errors.push('Total lines must be greater than 0');
  }

  if (!tiers || tiers.length === 0) {
    errors.push('At least one prize tier is required');
  }

  let configuredLines = 0;
  let totalValue = 0;

  for (const tier of tiers) {
    if (tier.prize_count <= 0) {
      errors.push(`Tier ${tier.tier_order}: Prize count must be greater than 0`);
    }
    if (tier.prize_amount < 0) {
      errors.push(`Tier ${tier.tier_order}: Prize amount cannot be negative`);
    }
    configuredLines += tier.prize_count;
    totalValue += tier.prize_amount * tier.prize_count;
  }

  if (configuredLines !== totalLines) {
    errors.push(
      `Configured lines (${configuredLines}) must equal total lines (${totalLines})`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    configuredLines,
    expectedLines: totalLines,
    totalValue,
  };
}

export async function getConfigurationStats(
  configId: number
): Promise<{
  linesGenerated: number;
  totalClaimed: number;
  totalRevoked: number;
  valueDistributed: number;
} | null> {
  try {
    const { data: lines, error } = await supabase
      .from('egg_prize_lines')
      .select('is_claimed, is_revoked, reward_amount')
      .eq('config_id', configId);

    if (error) {
      throw new Error(error.message);
    }

    if (!lines) {
      return {
        linesGenerated: 0,
        totalClaimed: 0,
        totalRevoked: 0,
        valueDistributed: 0,
      };
    }

    const claimed = lines.filter((l) => l.is_claimed && !l.is_revoked);
    const revoked = lines.filter((l) => l.is_revoked);
    const valueDistributed = claimed.reduce(
      (sum, l) => sum + parseFloat(l.reward_amount),
      0
    );

    return {
      linesGenerated: lines.length,
      totalClaimed: claimed.length,
      totalRevoked: revoked.length,
      valueDistributed,
    };
  } catch (error) {
    console.error('[GachaConfig] Error getting configuration stats:', error);
    return null;
  }
}
