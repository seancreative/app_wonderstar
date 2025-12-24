import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { wpayCache } from '../services/wpayCache';
import { supabase } from '../lib/supabase';
import { activityTimelineService } from '../services/activityTimelineService';
import type { StarsTransaction, MembershipTier } from '../types/database';

export const useStars = (options: { enabled?: boolean } = {}) => {
  const { enabled = true } = options;
  const { user } = useAuth();
  const [starsBalance, setStarsBalance] = useState(0);
  const [transactions, setTransactions] = useState<StarsTransaction[]>([]);
  const [currentTier, setCurrentTier] = useState<MembershipTier | null>(null);
  const [nextTier, setNextTier] = useState<MembershipTier | null>(null);
  const [lifetimeTopups, setLifetimeTopups] = useState(0);
  const [previousTierName, setPreviousTierName] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const hasFetchedRef = useRef(false);

  const loadStarsFromWPay = useCallback(async (force = false) => {
    if (!user?.email) return;

    // Only fetch once unless forced (cache handles TTL)
    if (hasFetchedRef.current && !force) {
      console.log('[useStars] Already fetched this session, skipping...');
      return;
    }

    try {
      setLoading(true);
      console.log('[useStars] Getting profile for:', user.email);

      // Use cached profile (only makes API call if cache is stale)
      const response = await wpayCache.getProfile(user.email, force);

      if (response && response.wpay_status === 'success' && response.profile) {
        const wpayProfile = response.profile;
        console.log('[useStars] Got profile:', wpayProfile, response.fromCache ? '(cached)' : '(fresh)');

        // Use stars from wpay_users (source of truth)
        setStarsBalance(wpayProfile.stars || 0);
        setLifetimeTopups(wpayProfile.lifetime_topups || 0);

        // Set tier data from wpay_users
        const tierType = wpayProfile.tier_type || 'bronze';
        const tierFactor = wpayProfile.tier_factor || 1.0;

        // Create tier object matching MembershipTier interface
        const currentTierData: any = {
          id: tierType,
          name: tierType.charAt(0).toUpperCase() + tierType.slice(1),
          threshold: getTierThreshold(tierType),
          earn_multiplier: tierFactor,
          topup_bonus_pct: getTierBonusPct(tierType),
          workshop_discount_pct: 0,
          redemption_discount_pct: 0,
          shop_discount_pct: 0,
          mission_bonus_stars: 0,
          color: getTierColor(tierType),
          sort_order: getTierSortOrder(tierType),
        };

        // Calculate next tier
        const nextTierType = getNextTier(tierType);
        if (nextTierType) {
          const nextTierData: any = {
            id: nextTierType,
            name: nextTierType.charAt(0).toUpperCase() + nextTierType.slice(1),
            threshold: getTierThreshold(nextTierType),
            earn_multiplier: getTierFactor(nextTierType),
            topup_bonus_pct: getTierBonusPct(nextTierType),
            color: getTierColor(nextTierType),
            sort_order: getTierSortOrder(nextTierType),
          };

          const lifetimeTopups = wpayProfile.lifetime_topups || 0;
          const amountToNextTier = nextTierData.threshold - lifetimeTopups;
          const tierRange = nextTierData.threshold - currentTierData.threshold;
          const userProgress = lifetimeTopups - currentTierData.threshold;
          const progressPercent = tierRange > 0 ? (userProgress / tierRange) * 100 : 0;

          currentTierData.next_tier_name = nextTierData.name;
          currentTierData.amount_to_next_tier = Math.max(0, amountToNextTier);
          currentTierData.progress_to_next = Math.min(100, Math.max(0, progressPercent));

          setNextTier(nextTierData);
        } else {
          // At max tier
          currentTierData.next_tier_name = currentTierData.name;
          currentTierData.amount_to_next_tier = 0;
          currentTierData.progress_to_next = 100;
          setNextTier(null);
        }

        setCurrentTier(currentTierData);
        hasFetchedRef.current = true;

        console.log('[useStars] Set stars:', wpayProfile.stars, 'tier:', tierType);
      } else {
        console.warn('[useStars] WPay response invalid, falling back to Supabase');
        await loadStarsFromSupabase();
      }
    } catch (error) {
      console.error('[useStars] WPay fetch failed, falling back to Supabase:', error);
      await loadStarsFromSupabase();
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadStarsFromSupabase = async () => {
    if (!user) return;

    try {
      // Get transactions for history
      const { data, error } = await supabase
        .from('stars_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTransactions(data || []);

      // Calculate balance from transactions
      const balance = (data || []).reduce((sum, tx) => sum + (tx.amount || 0), 0);
      setStarsBalance(balance);

      // Load tier from Supabase
      await loadTierFromSupabase();
    } catch (error) {
      console.error('[useStars] Supabase fallback error:', error);
    }
  };

  const loadTierFromSupabase = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('membership_tiers')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const tiers = data || [];
      const userLifetimeTopups = user.lifetime_topups || 0;

      let current = tiers[0];
      let next = null;

      for (let i = 0; i < tiers.length; i++) {
        if (userLifetimeTopups >= tiers[i].threshold) {
          current = tiers[i];
          if (i + 1 < tiers.length) {
            next = tiers[i + 1];
          }
        } else {
          break;
        }
      }

      if (next) {
        const amountToNextTier = next.threshold - userLifetimeTopups;
        const tierRange = next.threshold - current.threshold;
        const userProgress = userLifetimeTopups - current.threshold;
        const progressPercent = tierRange > 0 ? (userProgress / tierRange) * 100 : 0;

        const newTierData = {
          ...current,
          next_tier_name: next.name,
          amount_to_next_tier: amountToNextTier,
          progress_to_next: Math.min(100, Math.max(0, progressPercent)),
          stars_to_next_tier: 0
        } as any;

        setCurrentTier(newTierData);
        setNextTier(next);
      } else {
        setCurrentTier({
          ...current,
          next_tier_name: current.name,
          amount_to_next_tier: 0,
          progress_to_next: 100,
          stars_to_next_tier: 0
        } as any);
        setNextTier(null);
      }
    } catch (error) {
      console.error('[useStars] Error loading tiers from Supabase:', error);
    }
  };

  useEffect(() => {
    if (user && enabled) {
      loadStarsFromWPay();
    } else if (!enabled) {
      setLoading(false);
    }
  }, [user, loadStarsFromWPay, enabled]);



  const earnStars = async (amount: number, source: string, metadata: Record<string, any> = {}) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const multiplier = currentTier?.earn_multiplier || 1.0;
      const multipliedAmount = Math.floor(amount * multiplier);

      await supabase.from('stars_transactions').insert({
        user_id: user.id,
        transaction_type: 'earn',
        amount: multipliedAmount,
        multiplier,
        source,
        metadata,
      });

      await activityTimelineService.helpers.logStarsEarned(user.id, multipliedAmount, source);
      await loadStarsFromWPay(true);
      return multipliedAmount;
    } catch (error) {
      console.error('Error earning stars:', error);
      throw error;
    }
  };

  const spendStars = async (amount: number, source: string, metadata: Record<string, any> = {}) => {
    if (!user) return;

    if (starsBalance < amount) {
      throw new Error('Insufficient stars');
    }

    try {
      await supabase.from('stars_transactions').insert({
        user_id: user.id,
        transaction_type: 'spend',
        amount: -amount,
        multiplier: 1.0,
        source,
        metadata,
      });

      await activityTimelineService.helpers.logStarsSpent(user.id, amount, source);
      await loadStarsFromWPay(true);
    } catch (error) {
      console.error('Error spending stars:', error);
      throw error;
    }
  };

  const refresh = useCallback(() => loadStarsFromWPay(true), [loadStarsFromWPay]);

  return {
    starsBalance,
    transactions,
    currentTier,
    nextTier,
    loading,
    earnStars,
    spendStars,
    refresh,
    lifetimeTopups,
  };
};

// Helper functions for tier data
function getTierThreshold(tier: string): number {
  const thresholds: Record<string, number> = {
    bronze: 0,
    silver: 300,
    gold: 1000,
    platinum: 2500,
    vip: 5000,
  };
  return thresholds[tier] || 0;
}

function getTierFactor(tier: string): number {
  const factors: Record<string, number> = {
    bronze: 1.0,
    silver: 1.2,
    gold: 1.5,
    platinum: 2.0,
    vip: 3.0,
  };
  return factors[tier] || 1.0;
}

function getTierBonusPct(tier: string): number {
  const bonuses: Record<string, number> = {
    bronze: 0,
    silver: 5,
    gold: 10,
    platinum: 15,
    vip: 20,
  };
  return bonuses[tier] || 0;
}

function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2',
    vip: '#9966CC',
  };
  return colors[tier] || '#666666';
}

function getTierSortOrder(tier: string): number {
  const orders: Record<string, number> = {
    bronze: 0,
    silver: 1,
    gold: 2,
    platinum: 3,
    vip: 4,
  };
  return orders[tier] || 0;
}

function getNextTier(currentTier: string): string | null {
  const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'vip'];
  const currentIndex = tierOrder.indexOf(currentTier);
  if (currentIndex >= 0 && currentIndex < tierOrder.length - 1) {
    return tierOrder[currentIndex + 1];
  }
  return null;
}
