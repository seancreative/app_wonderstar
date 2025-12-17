import { supabase } from '../../lib/supabase';

export interface RevokePrizeResult {
  success: boolean;
  prizeLineId?: number;
  userId?: string;
  username?: string;
  amountDeducted?: number;
  revokedAt?: string;
  error?: string;
}

export async function revokePrize(
  prizeLineId: number,
  adminId: string,
  reason: string
): Promise<RevokePrizeResult> {
  try {
    console.log(`[GachaRevoke] Revoking prize ${prizeLineId} by admin ${adminId}`);

    if (!reason || reason.trim().length < 10) {
      return {
        success: false,
        error: 'Revocation reason must be at least 10 characters',
      };
    }

    const { data, error } = await supabase.rpc('revoke_prize_transaction', {
      p_prize_line_id: prizeLineId,
      p_admin_id: adminId,
      p_reason: reason.trim(),
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data || !data.success) {
      return {
        success: false,
        error: data?.error || 'Failed to revoke prize',
      };
    }

    console.log(`[GachaRevoke] Prize ${prizeLineId} revoked successfully`);

    return {
      success: true,
      prizeLineId: data.prize_line_id,
      userId: data.user_id,
      username: data.username,
      amountDeducted: parseFloat(data.amount_deducted),
      revokedAt: data.revoked_at,
    };
  } catch (error) {
    console.error('[GachaRevoke] Error revoking prize:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function canRevokePrize(prizeLineId: number): Promise<{
  canRevoke: boolean;
  reason?: string;
}> {
  try {
    const { data: prizeLine, error } = await supabase
      .from('egg_prize_lines')
      .select('is_claimed, is_revoked, claimed_by_user_id, reward_amount')
      .eq('id', prizeLineId)
      .single();

    if (error || !prizeLine) {
      return {
        canRevoke: false,
        reason: 'Prize not found',
      };
    }

    if (!prizeLine.is_claimed) {
      return {
        canRevoke: false,
        reason: 'Prize has not been claimed yet',
      };
    }

    if (prizeLine.is_revoked) {
      return {
        canRevoke: false,
        reason: 'Prize has already been revoked',
      };
    }

    const { data: user } = await supabase
      .from('users')
      .select('bonus_balance')
      .eq('id', prizeLine.claimed_by_user_id)
      .single();

    if (!user) {
      return {
        canRevoke: false,
        reason: 'User not found',
      };
    }

    if (user.bonus_balance < parseFloat(prizeLine.reward_amount)) {
      return {
        canRevoke: false,
        reason: `User has insufficient bonus balance (has: RM${user.bonus_balance}, needs: RM${prizeLine.reward_amount})`,
      };
    }

    return {
      canRevoke: true,
    };
  } catch (error) {
    console.error('[GachaRevoke] Error checking if can revoke:', error);
    return {
      canRevoke: false,
      reason: 'Error checking prize status',
    };
  }
}

export async function getPrizeRevocationHistory(prizeLineId: number): Promise<{
  isRevoked: boolean;
  revokedAt?: string;
  revokedBy?: string;
  reason?: string;
  adminName?: string;
} | null> {
  try {
    const { data: prizeLine, error } = await supabase
      .from('egg_prize_lines')
      .select(`
        is_revoked,
        revoked_at,
        revoked_by_admin_id,
        revoke_reason
      `)
      .eq('id', prizeLineId)
      .single();

    if (error || !prizeLine) {
      return null;
    }

    if (!prizeLine.is_revoked) {
      return {
        isRevoked: false,
      };
    }

    let adminName = 'Unknown';
    if (prizeLine.revoked_by_admin_id) {
      const { data: admin } = await supabase
        .from('admin_users')
        .select('name')
        .eq('id', prizeLine.revoked_by_admin_id)
        .single();

      if (admin) {
        adminName = admin.name;
      }
    }

    return {
      isRevoked: true,
      revokedAt: prizeLine.revoked_at,
      revokedBy: prizeLine.revoked_by_admin_id,
      reason: prizeLine.revoke_reason,
      adminName,
    };
  } catch (error) {
    console.error('[GachaRevoke] Error getting revocation history:', error);
    return null;
  }
}

export async function getAllRevokedPrizes(): Promise<Array<{
  id: number;
  line_number: number;
  username: string;
  reward_amount: number;
  revoked_at: string;
  revoke_reason: string;
  admin_name: string;
}>> {
  try {
    const { data: prizes, error } = await supabase
      .from('egg_prize_lines')
      .select(`
        id,
        line_number,
        claimed_by_username,
        reward_amount,
        revoked_at,
        revoke_reason,
        revoked_by_admin_id
      `)
      .eq('is_revoked', true)
      .order('revoked_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    if (!prizes || prizes.length === 0) {
      return [];
    }

    const adminIds = [...new Set(prizes.map(p => p.revoked_by_admin_id).filter(Boolean))];
    const { data: admins } = await supabase
      .from('admin_users')
      .select('id, name')
      .in('id', adminIds);

    const adminMap = new Map(admins?.map(a => [a.id, a.name]) || []);

    return prizes.map(prize => ({
      id: prize.id,
      line_number: prize.line_number,
      username: prize.claimed_by_username || 'Unknown',
      reward_amount: parseFloat(prize.reward_amount),
      revoked_at: prize.revoked_at!,
      revoke_reason: prize.revoke_reason || 'No reason provided',
      admin_name: adminMap.get(prize.revoked_by_admin_id!) || 'Unknown Admin',
    }));
  } catch (error) {
    console.error('[GachaRevoke] Error getting revoked prizes:', error);
    return [];
  }
}
