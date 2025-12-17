import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { activityTimelineService } from '../services/activityTimelineService';
import type { WalletTransaction, BonusTransaction } from '../types/database';
import { calculateWalletBalance, calculateBonusBalance } from '../utils/walletUtils';

export const useWallet = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [bonusTransactions, setBonusTransactions] = useState<BonusTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadWalletData();
    }
  }, [user]); // Removed user?.bonus_balance dependency since we calculate from transactions now

  // Real-time subscription to wallet_transactions changes
  useEffect(() => {
    if (!user) return;

    console.log('[useWallet] Setting up realtime subscription for user:', user.id);

    const channel = supabase
      .channel('wallet_transactions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallet_transactions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('[useWallet] Realtime update received:', payload.eventType);
          // Reload wallet data when any change occurs
          loadWalletData();
        }
      )
      .subscribe();

    return () => {
      console.log('[useWallet] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Real-time subscription to bonus_transactions changes
  useEffect(() => {
    if (!user) return;

    console.log('[useWallet] Setting up bonus_transactions realtime subscription for user:', user.id);

    const bonusChannel = supabase
      .channel('bonus_transactions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bonus_transactions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('[useWallet] Bonus transaction update received:', payload.eventType);
          // Reload wallet data to refresh bonus balance from transactions
          loadWalletData();
        }
      )
      .subscribe();

    return () => {
      console.log('[useWallet] Cleaning up bonus_transactions realtime subscription');
      supabase.removeChannel(bonusChannel);
    };
  }, [user]);

  // Auto-refresh wallet data when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        console.log('[useWallet] Page visible, refreshing wallet data');
        loadWalletData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  const loadWalletData = async () => {
    if (!user) return;

    try {
      // Load wallet transactions and bonus transactions in parallel
      const [walletResult, bonusResult] = await Promise.all([
        supabase
          .from('wallet_transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('bonus_transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      ]);

      if (walletResult.error) throw walletResult.error;
      if (bonusResult.error) throw bonusResult.error;

      const walletData = walletResult.data || [];
      const bonusData = bonusResult.data || [];

      setTransactions(walletData);
      setBonusTransactions(bonusData);

      // SINGLE SOURCE OF TRUTH: Calculate balances from transaction tables
      const walletBalanceResult = calculateWalletBalance(walletData);
      const bonusBalanceResult = calculateBonusBalance(bonusData);

      setBalance(walletBalanceResult.wBalance);
      setBonusBalance(bonusBalanceResult.bonusBalance);

      // Diagnostic logging for balance calculation
      console.log('[useWallet] Balance calculation (from transactions):', {
        walletTransactions: walletData.length,
        bonusTransactions: bonusData.length,
        successfulWalletTx: walletBalanceResult.successfulTransactions,
        pendingWalletTx: walletBalanceResult.pendingTransactions,
        calculatedWBalance: walletBalanceResult.wBalance,
        calculatedBonusBalance: bonusBalanceResult.bonusBalance,
        totalTopups: walletBalanceResult.totalTopups,
        bonusTotalEarned: bonusBalanceResult.totalEarned,
        bonusTotalSpent: bonusBalanceResult.totalSpent,
        latestWalletTx: walletData?.[0],
        latestBonusTx: bonusData?.[0]
      });
    } catch (error) {
      console.error('Error loading wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const topUp = async (amount: number, bonusAmount: number) => {
    if (!user) return;

    try {
      await supabase.from('wallet_transactions').insert({
        user_id: user.id,
        transaction_type: 'topup',
        amount,
        bonus_amount: bonusAmount,
        description: `Top up RM${amount}`,
      });

      await supabase
        .from('users')
        .update({ lifetime_topups: user.lifetime_topups + amount })
        .eq('id', user.id);

      // Log wallet topup activity
      try {
        await activityTimelineService.helpers.logWalletTopup(user.id, amount, bonusAmount);
      } catch (activityError) {
        console.warn('Failed to log wallet topup activity:', activityError);
      }

      await loadWalletData();
    } catch (error) {
      console.error('Error topping up:', error);
      throw error;
    }
  };

  const spend = async (amount: number, description: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('[useWallet] ===== SPEND OPERATION START =====');
      console.log('[useWallet] Requested spend:', {
        user_id: user.id,
        amount,
        description,
        cached_balance_in_state: balance,
        timestamp: new Date().toISOString()
      });

      // CRITICAL: ALWAYS fetch fresh balance from database (SINGLE SOURCE OF TRUTH)
      // Do NOT rely on cached state - it can be stale or include pending transactions
      console.log('[useWallet] Fetching FRESH balance from database with explicit status filter...');
      const { data: currentTransactions, error: fetchError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'success'); // CRITICAL: Only count successful transactions

      if (fetchError) {
        console.error('[useWallet] Database fetch error:', fetchError);
        throw new Error('Failed to verify balance');
      }

      const balanceResult = calculateWalletBalance(currentTransactions || []);
      const currentBalance = balanceResult.wBalance;

      console.log('[useWallet] Fresh balance calculated:', {
        current_balance: currentBalance,
        requested_amount: amount,
        successful_transactions: balanceResult.successfulTransactions,
        pending_transactions: balanceResult.pendingTransactions,
        total_topups: balanceResult.totalTopups,
        total_spends: balanceResult.totalSpends,
        sufficient_funds: currentBalance >= amount
      });

      // ATOMIC CHECK: Verify sufficient funds using FRESH database balance
      if (currentBalance < amount) {
        console.error('[useWallet] ❌ INSUFFICIENT BALANCE - Transaction blocked:', {
          fresh_db_balance: currentBalance,
          requested_amount: amount,
          shortfall: amount - currentBalance
        });
        throw new Error('Insufficient balance');
      }

      console.log('[useWallet] ✅ Balance check passed, proceeding with spend transaction...');

      const { data: result, error: insertError } = await supabase
        .from('wallet_transactions')
        .insert({
          user_id: user.id,
          transaction_type: 'spend',
          amount: -amount,
          bonus_amount: 0,
          description,
          status: 'success'
        })
        .select()
        .single();

      if (insertError) {
        console.error('[useWallet] ❌ Failed to insert spend transaction:', insertError);
        throw insertError;
      }

      console.log('[useWallet] ✅ Wallet spend successful:', {
        transaction_id: result?.id,
        amount_spent: amount,
        new_balance_estimate: currentBalance - amount
      });
      console.log('[useWallet] ===== SPEND OPERATION COMPLETE =====');

      await loadWalletData();
    } catch (error) {
      console.error('[useWallet] ===== SPEND OPERATION FAILED =====');
      console.error('[useWallet] Error details:', error);
      throw error;
    }
  };

  return {
    balance,
    bonusBalance,
    transactions,
    loading,
    topUp,
    spend,
    refresh: loadWalletData,
    reloadBalance: loadWalletData,
  };
};
