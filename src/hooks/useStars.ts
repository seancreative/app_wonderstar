import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { activityTimelineService } from '../services/activityTimelineService';
import { calculateStarsBalance } from '../utils/walletUtils';
import type { StarsTransaction, MembershipTier } from '../types/database';

export const useStars = () => {
  const { user } = useAuth();
  const [starsBalance, setStarsBalance] = useState(0);
  const [transactions, setTransactions] = useState<StarsTransaction[]>([]);
  const [currentTier, setCurrentTier] = useState<MembershipTier | null>(null);
  const [nextTier, setNextTier] = useState<MembershipTier | null>(null);
  const [previousTierName, setPreviousTierName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadStarsData();
      loadTierData();
    }
  }, [user]);

  // Auto-refresh stars data when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        console.log('[useStars] Page visible, refreshing stars data');
        loadStarsData();
        loadTierData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  const loadStarsData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('stars_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTransactions(data || []);

      const result = calculateStarsBalance(data);
      setStarsBalance(result.starsBalance);
    } catch (error) {
      console.error('Error loading stars:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTierData = async () => {
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

      // Calculate progress to next tier
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

        // Check if tier upgraded
        if (previousTierName && previousTierName !== current.name) {
          try {
            await activityTimelineService.helpers.logTierUpgrade(
              user.id,
              current.name,
              previousTierName
            );
          } catch (activityError) {
            console.warn('Failed to log tier upgrade:', activityError);
          }
        }

        setPreviousTierName(current.name);
        setCurrentTier(newTierData);
        setNextTier(next);
      } else {
        // User is at max tier
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
      console.error('Error loading tiers:', error);
    }
  };

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

      // Log activity
      await activityTimelineService.helpers.logStarsEarned(user.id, multipliedAmount, source);

      await loadStarsData();
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

      // Log activity
      await activityTimelineService.helpers.logStarsSpent(user.id, amount, source);

      await loadStarsData();
    } catch (error) {
      console.error('Error spending stars:', error);
      throw error;
    }
  };

  return {
    starsBalance,
    transactions,
    currentTier,
    nextTier,
    loading,
    earnStars,
    spendStars,
    refresh: loadStarsData,
  };
};
