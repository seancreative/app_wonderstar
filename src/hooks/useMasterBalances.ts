import { useState, useEffect, useCallback, useRef } from 'react';
import { calculateMasterBalances, MasterBalances } from '../services/masterBalanceCalculator';
import { wpayService } from '../services/wpayService';

interface UseMasterBalancesOptions {
  userId: string | null;
  userEmail?: string | null;
  dateFilter?: string;
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
}: UseMasterBalancesOptions): UseMasterBalancesReturn {
  const [balances, setBalances] = useState<MasterBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track if already fetched to prevent duplicate calls
  const hasFetchedRef = useRef(false);

  const loadBalances = useCallback(async (force = false) => {
    // Only fetch once unless forced (manual refresh)
    if (hasFetchedRef.current && !force) {
      console.log('[useMasterBalances] Already fetched, skipping...');
      return;
    }

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

      // ========== TRY WPAY API FIRST ==========
      if (userEmail) {
        try {
          console.log('[useMasterBalances] Fetching from WPay API for:', userEmail);
          const response = await wpayService.getProfile(userEmail);

          if (response && response.wpay_status === 'success' && response.profile) {
            const wpayProfile = response.profile;
            console.log('[useMasterBalances] Got WPay profile:', wpayProfile);

            const wpayBalances: MasterBalances = {
              totalTransactions: 0,
              lifetimeTopup: wpayProfile.lifetime_topups || 0,
              wBalance: wpayProfile.wbalance || 0,
              bonusBalance: wpayProfile.bonus || 0,
              starsBalance: wpayProfile.stars || 0,
              transactionHistory: [],
              calculatedAt: new Date().toISOString()
            };

            console.log('[useMasterBalances] Using WPay balances:', {
              wBalance: wpayBalances.wBalance,
              bonus: wpayBalances.bonusBalance,
              stars: wpayBalances.starsBalance
            });

            setBalances(wpayBalances);
            hasFetchedRef.current = true;
            setLoading(false);
            return;
          } else {
            console.warn('[useMasterBalances] WPay response invalid:', response);
          }
        } catch (wpayError) {
          console.error('[useMasterBalances] WPay API failed:', wpayError);
          // Fall through to Supabase
        }
      }

      // ========== FALLBACK TO SUPABASE ==========
      console.log('[useMasterBalances] Using Supabase fallback for userId:', userId);
      const result = await calculateMasterBalances(userId, dateFilter);
      console.log('[useMasterBalances] Supabase balances:', {
        wBalance: result.wBalance,
        bonus: result.bonusBalance,
        stars: result.starsBalance
      });
      setBalances(result);
      hasFetchedRef.current = true;
    } catch (err) {
      console.error('[useMasterBalances] Error:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [userId, userEmail, dateFilter]);

  // Only fetch ONCE on initial mount
  useEffect(() => {
    hasFetchedRef.current = false; // Reset when deps change
    loadBalances();
  }, [userId, userEmail, dateFilter]);

  // Manual refresh function (for use after payments, etc.)
  const manualRefresh = useCallback(async () => {
    await loadBalances(true); // Force refresh
  }, [loadBalances]);

  return {
    balances,
    loading,
    error,
    refresh: manualRefresh
  };
}
