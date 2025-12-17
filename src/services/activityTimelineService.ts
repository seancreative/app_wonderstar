import { supabase } from '../lib/supabase';

export type ActivityType =
  | 'voucher_redeemed'
  | 'gacha_spin'
  | 'profile_updated'
  | 'child_added'
  | 'child_updated'
  | 'stars_earned'
  | 'stars_spent'
  | 'wallet_topup'
  | 'order_placed'
  | 'order_completed'
  | 'reward_redeemed'
  | 'tier_upgraded'
  | 'mission_completed'
  | 'badge_unlocked'
  | 'check_in'
  | 'workshop_booked';

export type ActivityCategory = 'transaction' | 'gamification' | 'profile' | 'social' | 'reward' | 'shop';

interface LogActivityParams {
  userId: string;
  activityType: ActivityType;
  activityCategory: ActivityCategory;
  title: string;
  description?: string;
  starsChange?: number;
  amountChange?: number;
  metadata?: Record<string, any>;
  icon?: string;
}

interface UserActivity {
  id: string;
  user_id: string;
  activity_type: ActivityType;
  activity_category: ActivityCategory;
  title: string;
  description?: string;
  stars_change: number;
  amount_change: number;
  metadata: Record<string, any>;
  icon: string;
  created_at: string;
}

export const activityTimelineService = {
  /**
   * Log a user activity to the timeline
   */
  async logActivity(params: LogActivityParams): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('user_activity_timeline').insert({
        user_id: params.userId,
        activity_type: params.activityType,
        activity_category: params.activityCategory,
        title: params.title,
        description: params.description || null,
        stars_change: params.starsChange || 0,
        amount_change: params.amountChange || 0,
        metadata: params.metadata || {},
        icon: params.icon || 'Activity',
      });

      if (error) {
        console.error('[ActivityTimeline] Error logging activity:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      console.error('[ActivityTimeline] Exception logging activity:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Get user activities with pagination
   */
  async getUserActivities(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      activityType?: ActivityType;
      activityCategory?: ActivityCategory;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ activities: UserActivity[]; error?: string }> {
    try {
      let query = supabase
        .from('user_activity_timeline')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (options?.activityType) {
        query = query.eq('activity_type', options.activityType);
      }

      if (options?.activityCategory) {
        query = query.eq('activity_category', options.activityCategory);
      }

      if (options?.startDate) {
        query = query.gte('created_at', options.startDate.toISOString());
      }

      if (options?.endDate) {
        query = query.lte('created_at', options.endDate.toISOString());
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[ActivityTimeline] Error fetching activities:', error);
        return { activities: [], error: error.message };
      }

      return { activities: (data as UserActivity[]) || [] };
    } catch (err: any) {
      console.error('[ActivityTimeline] Exception fetching activities:', err);
      return { activities: [], error: err.message };
    }
  },

  /**
   * Get activity counts by type for a user
   */
  async getActivityStats(userId: string): Promise<{ stats: Record<string, number>; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('user_activity_timeline')
        .select('activity_type')
        .eq('user_id', userId);

      if (error) {
        console.error('[ActivityTimeline] Error fetching activity stats:', error);
        return { stats: {}, error: error.message };
      }

      const stats: Record<string, number> = {};
      data?.forEach((activity) => {
        stats[activity.activity_type] = (stats[activity.activity_type] || 0) + 1;
      });

      return { stats };
    } catch (err: any) {
      console.error('[ActivityTimeline] Exception fetching activity stats:', err);
      return { stats: {}, error: err.message };
    }
  },

  /**
   * Helper methods for common activities
   */
  helpers: {
    async logVoucherRedemption(userId: string, voucherCode: string, voucherTitle: string) {
      return activityTimelineService.logActivity({
        userId,
        activityType: 'voucher_redeemed',
        activityCategory: 'reward',
        title: 'Redeemed Voucher',
        description: `Redeemed voucher: ${voucherTitle}`,
        metadata: { voucher_code: voucherCode, voucher_title: voucherTitle },
        icon: 'Ticket',
      });
    },

    async logGachaSpin(userId: string, prizeWon: string, starsSpent: number) {
      return activityTimelineService.logActivity({
        userId,
        activityType: 'gacha_spin',
        activityCategory: 'gamification',
        title: 'Spun Egg Gacha',
        description: `Won: ${prizeWon}`,
        starsChange: -starsSpent,
        metadata: { prize_won: prizeWon, stars_spent: starsSpent },
        icon: 'Sparkles',
      });
    },

    async logProfileUpdate(userId: string, fieldsUpdated: string[]) {
      return activityTimelineService.logActivity({
        userId,
        activityType: 'profile_updated',
        activityCategory: 'profile',
        title: 'Updated Profile',
        description: `Updated: ${fieldsUpdated.join(', ')}`,
        metadata: { fields_updated: fieldsUpdated },
        icon: 'User',
      });
    },

    async logChildAdded(userId: string, childName: string) {
      return activityTimelineService.logActivity({
        userId,
        activityType: 'child_added',
        activityCategory: 'profile',
        title: 'Added Child Profile',
        description: `Added child: ${childName}`,
        metadata: { child_name: childName },
        icon: 'Baby',
      });
    },

    async logStarsEarned(userId: string, amount: number, source: string) {
      return activityTimelineService.logActivity({
        userId,
        activityType: 'stars_earned',
        activityCategory: 'gamification',
        title: 'Earned Stars',
        description: `+${amount} stars from ${source}`,
        starsChange: amount,
        metadata: { source },
        icon: 'Star',
      });
    },

    async logStarsSpent(userId: string, amount: number, purpose: string) {
      return activityTimelineService.logActivity({
        userId,
        activityType: 'stars_spent',
        activityCategory: 'gamification',
        title: 'Spent Stars',
        description: `-${amount} stars on ${purpose}`,
        starsChange: -amount,
        metadata: { purpose },
        icon: 'Star',
      });
    },

    async logWalletTopup(userId: string, amount: number, bonusAmount: number) {
      return activityTimelineService.logActivity({
        userId,
        activityType: 'wallet_topup',
        activityCategory: 'transaction',
        title: 'Wallet Top-Up',
        description: `Topped up RM${amount.toFixed(2)}${bonusAmount > 0 ? ` (+RM${bonusAmount.toFixed(2)} bonus)` : ''}`,
        amountChange: amount + bonusAmount,
        metadata: { amount, bonus_amount: bonusAmount },
        icon: 'Wallet',
      });
    },

    async logOrderPlaced(userId: string, orderId: string, totalAmount: number) {
      return activityTimelineService.logActivity({
        userId,
        activityType: 'order_placed',
        activityCategory: 'shop',
        title: 'Placed Order',
        description: `Order total: RM${totalAmount.toFixed(2)}`,
        amountChange: -totalAmount,
        metadata: { order_id: orderId, total_amount: totalAmount },
        icon: 'ShoppingBag',
      });
    },

    async logTierUpgrade(userId: string, newTier: string, previousTier: string) {
      return activityTimelineService.logActivity({
        userId,
        activityType: 'tier_upgraded',
        activityCategory: 'gamification',
        title: 'Tier Upgraded!',
        description: `Upgraded from ${previousTier} to ${newTier}`,
        metadata: { new_tier: newTier, previous_tier: previousTier },
        icon: 'Trophy',
      });
    },
  },
};
