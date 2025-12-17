import { supabase } from '../lib/supabase';

interface TierInfo {
  name: string;
  threshold: number;
  color: string;
  benefits: string[];
}

const TIERS: TierInfo[] = [
  {
    name: 'Bronze',
    threshold: 0,
    color: '#CD7F32',
    benefits: ['Basic member benefits', 'Earn WonderStars']
  },
  {
    name: 'Silver',
    threshold: 100,
    color: '#C0C0C0',
    benefits: ['5% shop discount', 'Priority support']
  },
  {
    name: 'Gold',
    threshold: 500,
    color: '#FFD700',
    benefits: ['10% shop discount', 'Exclusive events access']
  },
  {
    name: 'Platinum',
    threshold: 1000,
    color: '#E5E4E2',
    benefits: ['15% shop discount', 'VIP lounge access', 'Birthday surprises']
  },
  {
    name: 'Diamond',
    threshold: 2000,
    color: '#B9F2FF',
    benefits: ['20% shop discount', 'Concierge service', 'Premium gifts']
  }
];

export const tierUpgradeService = {
  calculateTier(lifetimeTopups: number): TierInfo {
    const sortedTiers = [...TIERS].sort((a, b) => b.threshold - a.threshold);
    const currentTier = sortedTiers.find(tier => lifetimeTopups >= tier.threshold);
    return currentTier || TIERS[0];
  },

  getNextTierProgress(lifetimeTopups: number): {
    currentTier: TierInfo;
    nextTier: TierInfo | null;
    progress: number;
    amountToNext: number;
  } {
    const currentTier = this.calculateTier(lifetimeTopups);
    const currentIndex = TIERS.findIndex(t => t.name === currentTier.name);
    const nextTier = currentIndex < TIERS.length - 1 ? TIERS[currentIndex + 1] : null;

    let progress = 100;
    let amountToNext = 0;

    if (nextTier) {
      const range = nextTier.threshold - currentTier.threshold;
      const current = lifetimeTopups - currentTier.threshold;
      progress = Math.min(100, (current / range) * 100);
      amountToNext = nextTier.threshold - lifetimeTopups;
    }

    return {
      currentTier,
      nextTier,
      progress,
      amountToNext
    };
  },

  async checkAndRecordUpgrade(
    userId: string,
    previousLifetimeTopups: number,
    newLifetimeTopups: number
  ): Promise<{ upgraded: boolean; newTier?: TierInfo; previousTier?: TierInfo }> {
    const previousTier = this.calculateTier(previousLifetimeTopups);
    const newTier = this.calculateTier(newLifetimeTopups);

    if (previousTier.name !== newTier.name) {
      console.log('[TierUpgrade] User tier upgraded!', {
        userId,
        from: previousTier.name,
        to: newTier.name,
        lifetimeTopups: newLifetimeTopups
      });

      try {
        const { error } = await supabase
          .from('tier_history')
          .insert({
            user_id: userId,
            previous_tier: previousTier.name,
            new_tier: newTier.name,
            lifetime_topups_at_upgrade: newLifetimeTopups,
            upgraded_at: new Date().toISOString()
          });

        if (error) {
          console.error('[TierUpgrade] Failed to record tier upgrade:', error);
        } else {
          console.log('[TierUpgrade] ✅ Tier upgrade recorded to database');
        }
      } catch (error) {
        console.error('[TierUpgrade] Error recording tier upgrade:', error);
      }

      return {
        upgraded: true,
        newTier,
        previousTier
      };
    }

    return { upgraded: false };
  },

  async getTierHistory(userId: string) {
    try {
      const { data, error } = await supabase
        .from('tier_history')
        .select('*')
        .eq('user_id', userId)
        .order('upgraded_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[TierUpgrade] Error fetching tier history:', error);
      return [];
    }
  },

  getAllTiers(): TierInfo[] {
    return TIERS;
  },

  getTierColor(tierName: string): string {
    const tier = TIERS.find(t => t.name === tierName);
    return tier?.color || '#CD7F32';
  }
};
