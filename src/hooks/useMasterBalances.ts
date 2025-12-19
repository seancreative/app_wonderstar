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

  // Track last fetched params to prevent duplicate calls/loops
  const lastFetchedParamsRef = useRef<string>('');

  const loadBalances = useCallback(async (force = false) => {
    const currentParams = JSON.stringify({ userId, userEmail, dateFilter });

    // Skip if already fetched with same params, unless forced
    if (lastFetchedParamsRef.current === currentParams && !force) {
      console.log('[useMasterBalances] Already fetched for these params, skipping...');
      return;
    }

    console.log('[useMasterBalances] loadBalances called with userId:', userId, 'email:', userEmail);

    if (!userId) {
      console.log('[useMasterBalances] No userId provided, setting balances to null');
      setBalances(null);
      setLoading(false);
      lastFetchedParamsRef.current = currentParams; // Mark as handled
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
            lastFetchedParamsRef.current = currentParams; // Mark success
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
      lastFetchedParamsRef.current = currentParams; // Mark success
    } catch (err) {
      console.error('[useMasterBalances] Error:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      // Do NOT update lastFetchedParamsRef on error so it can retry? 
      // Or update it to prevent loop on persistent error? 
      // Better to NOT update so it retries if dependencies change/re-mount. 
      // But if loop connects to error, we might want to back off.
      // For now, assume error allows retry.
    } finally {
      setLoading(false);
    }
  }, [userId, userEmail, dateFilter]);

  // Only fetch when dependencies check logic permits
  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

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
