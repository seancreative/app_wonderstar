import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { calculateMasterBalances, MasterBalances } from '../services/masterBalanceCalculator';
import { wpayService } from '../services/wpayService';

interface UseMasterBalancesOptions {
  userId: string | null;
  userEmail?: string | null;
  dateFilter?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  useWPayAPI?: boolean;
}

interface UseMasterBalancesReturn {
  balances: MasterBalances | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  source: 'wpay' | 'supabase' | null;
}

export function useMasterBalances({
  userId,
  userEmail,
  dateFilter,
  autoRefresh = false,
  refreshInterval = 30000,
  useWPayAPI = true
}: UseMasterBalancesOptions): UseMasterBalancesReturn {
  const [balances, setBalances] = useState<MasterBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [source, setSource] = useState<'wpay' | 'supabase' | null>(null);

  const loadBalances = useCallback(async () => {
    console.log('[useMasterBalances] loadBalances called with userId:', userId, 'email:', userEmail);

    if (!userId) {
      console.log('[useMasterBalances] No userId provided, setting balances to null');
      setBalances(null);
      setLoading(false);
      setSource(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Try WPay API first if enabled and email is available
      if (useWPayAPI && userEmail) {
        try {
          console.log('[useMasterBalances] Fetching from WPay API for email:', userEmail);
          const profileResponse = await wpayService.getProfile(userEmail);

          if (profileResponse.success && profileResponse.data) {
            console.log('[useMasterBalances] WPay API response:', profileResponse.data);

            // Convert WPay response to MasterBalances format
            const wpayBalances: MasterBalances = {
              wBalance: profileResponse.data.wbalance,
              bonusBalance: profileResponse.data.bonus,
              starsBalance: profileResponse.data.stars,
              lifetimeTopup: profileResponse.data.lifetime_topups,
              totalTransactions: 0, // Not provided by WPay API
              transactionHistory: [], // Not provided by WPay API
              calculatedAt: new Date().toISOString()
            };

            console.log('[useMasterBalances] Using WPay balances:', {
              wBalance: wpayBalances.wBalance,
              bonus: wpayBalances.bonusBalance,
              stars: wpayBalances.starsBalance
            });

            setBalances(wpayBalances);
            setSource('wpay');
            setLoading(false);
            return;
          }
        } catch (wpayError) {
          console.warn('[useMasterBalances] WPay API failed, falling back to Supabase:', wpayError);
          // Fall through to Supabase calculation
        }
      }

      // Fallback to Supabase transaction calculation
      console.log('[useMasterBalances] Calling calculateMasterBalances with userId:', userId);
      const result = await calculateMasterBalances(userId, dateFilter);
      console.log('[useMasterBalances] Received Supabase balances:', {
        wBalance: result.wBalance,
        bonus: result.bonusBalance,
        stars: result.starsBalance
      });
      setBalances(result);
      setSource('supabase');
    } catch (err) {
      console.error('[useMasterBalances] Error loading balances:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setSource(null);
    } finally {
      setLoading(false);
    }
  }, [userId, userEmail, dateFilter, useWPayAPI]);

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
    refresh: loadBalances,
    source
  };
}
