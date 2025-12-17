import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { calculateMasterBalances, MasterBalances } from '../services/masterBalanceCalculator';
import { wpayService, WPayProfile } from '../services/wpayService';

interface UseMasterBalancesOptions {
  userId: string | null;
  userEmail?: string | null; // Add email for WPay lookup
  dateFilter?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseMasterBalancesReturn {
  balances: MasterBalances | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useMasterBalances({
  userId,
  userEmail,
  dateFilter,
  autoRefresh = false,
  refreshInterval = 30000
}: UseMasterBalancesOptions): UseMasterBalancesReturn {
  const [balances, setBalances] = useState<MasterBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadBalances = useCallback(async () => {
    console.log('[useMasterBalances] loadBalances called with userId:', userId, 'email:', userEmail);

    if (!userId) {
      console.log('[useMasterBalances] No userId provided, setting balances to null');
      setBalances(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // ========== TRY WPAY FIRST (for most accurate real-time data) ==========
      if (userEmail) {
        try {
          console.log('[useMasterBalances] Fetching from WPay for email:', userEmail);
          const response = await wpayService.getProfile(userEmail);

          if (response && response.wpay_status === 'success' && response.profile) {
            const wpayProfile = response.profile;
            console.log('[useMasterBalances] Got WPay profile:', wpayProfile);

            // Create balances object from WPay data
            const wpayBalances: MasterBalances = {
              totalTransactions: 0, // WPay doesn't provide this
              lifetimeTopup: wpayProfile.lifetime_topups || 0,
              wBalance: wpayProfile.wbalance || 0,
              bonusBalance: wpayProfile.bonus || 0,
              starsBalance: wpayProfile.stars || 0,
              transactionHistory: [], // WPay doesn't provide detailed history
              calculatedAt: new Date().toISOString()
            };

            console.log('[useMasterBalances] Using WPay balances:', {
              wBalance: wpayBalances.wBalance,
              bonus: wpayBalances.bonusBalance,
              stars: wpayBalances.starsBalance
            });

            setBalances(wpayBalances);
            setLoading(false);
            return;
          }
        } catch (wpayError) {
          console.log('[useMasterBalances] WPay fetch failed, falling back to Supabase:', wpayError);
          // Fall through to Supabase calculation
        }
      }

      // ========== FALLBACK TO SUPABASE ==========
      console.log('[useMasterBalances] Calling calculateMasterBalances with userId:', userId);
      const result = await calculateMasterBalances(userId, dateFilter);
      console.log('[useMasterBalances] Received Supabase balances:', {
        wBalance: result.wBalance,
        bonus: result.bonusBalance,
        stars: result.starsBalance
      });
      setBalances(result);
    } catch (err) {
      console.error('[useMasterBalances] Error calculating master balances:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [userId, userEmail, dateFilter]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  useEffect(() => {
    if (!autoRefresh || !userId) return;

    const interval = setInterval(() => {
      loadBalances();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, userId, loadBalances]);

  // Real-time subscription to wallet_transactions changes
  useEffect(() => {
    if (!userId) return;

    console.log('[useMasterBalances] Setting up wallet_transactions realtime subscription for user:', userId);

    const walletChannel = supabase
      .channel('master_wallet_transactions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallet_transactions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('[useMasterBalances] Wallet transaction update received:', payload.eventType);
          loadBalances();
        }
      )
      .subscribe();

    return () => {
      console.log('[useMasterBalances] Cleaning up wallet_transactions realtime subscription');
      supabase.removeChannel(walletChannel);
    };
  }, [userId, loadBalances]);

  // Real-time subscription to bonus_transactions changes
  useEffect(() => {
    if (!userId) return;

    console.log('[useMasterBalances] Setting up bonus_transactions realtime subscription for user:', userId);

    const bonusChannel = supabase
      .channel('master_bonus_transactions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bonus_transactions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('[useMasterBalances] Bonus transaction update received:', payload.eventType);
          loadBalances();
        }
      )
      .subscribe();

    return () => {
      console.log('[useMasterBalances] Cleaning up bonus_transactions realtime subscription');
      supabase.removeChannel(bonusChannel);
    };
  }, [userId, loadBalances]);

  // Real-time subscription to stars_transactions changes
  useEffect(() => {
    if (!userId) return;

    console.log('[useMasterBalances] Setting up stars_transactions realtime subscription for user:', userId);

    const starsChannel = supabase
      .channel('master_stars_transactions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stars_transactions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('[useMasterBalances] Stars transaction update received:', payload.eventType);
          loadBalances();
        }
      )
      .subscribe();

    return () => {
      console.log('[useMasterBalances] Cleaning up stars_transactions realtime subscription');
      supabase.removeChannel(starsChannel);
    };
  }, [userId, loadBalances]);

  // Auto-refresh balances when page becomes visible
  useEffect(() => {
    if (!userId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[useMasterBalances] Page visible, refreshing balances');
        loadBalances();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId, loadBalances]);

  return {
    balances,
    loading,
    error,
    refresh: loadBalances
  };
}
