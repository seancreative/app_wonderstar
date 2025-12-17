import { supabase } from '../lib/supabase';
import type { WalletTransaction, StarsTransaction, BonusTransaction } from '../types/database';

export interface UnifiedTransaction {
  id: string;
  created_at: string;
  transaction_type: string;
  source_table: 'wallet' | 'bonus' | 'stars';
  description: string;
  order_id: string | null;
  wallet_balance: number;
  bonus_balance: number;
  stars_balance: number;
  lifetime_topup: number;
  wallet_change: number;
  bonus_change: number;
  stars_change: number;
  raw_transaction: WalletTransaction | BonusTransaction | StarsTransaction;
}

export interface MasterBalances {
  totalTransactions: number;
  lifetimeTopup: number;
  wBalance: number;
  bonusBalance: number;
  starsBalance: number;
  transactionHistory: UnifiedTransaction[];
  calculatedAt: string;
}

export async function calculateMasterBalances(
  userId: string,
  dateFilter?: string
): Promise<MasterBalances> {
  console.log('[MasterBalanceCalculator] ===== STARTING BALANCE CALCULATION =====');
  console.log('[MasterBalanceCalculator] User ID:', userId);
  console.log('[MasterBalanceCalculator] userId type:', typeof userId, 'length:', userId?.length);

  // CRITICAL FIX: Only use dateFilter if explicitly provided for reports
  // Default behavior should fetch ALL transactions to ensure accurate balance
  const filterDate = dateFilter; // Removed default date that could exclude old transactions

  if (filterDate) {
    console.log('[MasterBalanceCalculator] ⚠️ Date filter applied (report mode):', filterDate);
  } else {
    console.log('[MasterBalanceCalculator] ✅ No date filter - fetching ALL transactions (balance mode)');
  }

  const [walletResult, bonusResult, starsResult] = await Promise.all([
    dateFilter
      ? supabase
          .from('wallet_transactions')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', dateFilter)
          .order('created_at', { ascending: false })
      : supabase
          .from('wallet_transactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
    dateFilter
      ? supabase
          .from('bonus_transactions')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', dateFilter)
          .order('created_at', { ascending: false })
      : supabase
          .from('bonus_transactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
    dateFilter
      ? supabase
          .from('stars_transactions')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', dateFilter)
          .order('created_at', { ascending: false })
      : supabase
          .from('stars_transactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
  ]);

  if (walletResult.error) {
    console.error('[MasterBalanceCalculator] Wallet query error:', walletResult.error);
    throw walletResult.error;
  }
  if (bonusResult.error) {
    console.error('[MasterBalanceCalculator] Bonus query error:', bonusResult.error);
    throw bonusResult.error;
  }

  console.log('[MasterBalanceCalculator] Bonus query result:', {
    dataLength: bonusResult.data?.length || 0,
    status: bonusResult.status,
    statusText: bonusResult.statusText
  });
  if (starsResult.error) {
    console.error('[MasterBalanceCalculator] Stars query error:', starsResult.error);
    throw starsResult.error;
  }

  const walletTransactions = walletResult.data || [];
  const bonusTransactions = bonusResult.data || [];
  const starsTransactions = starsResult.data || [];

  // Count transactions by status
  const walletByStatus = {
    success: walletTransactions.filter(t => t.status === 'success').length,
    pending: walletTransactions.filter(t => t.status === 'pending').length,
    failed: walletTransactions.filter(t => t.status === 'failed').length,
    other: walletTransactions.filter(t => t.status !== 'success' && t.status !== 'pending' && t.status !== 'failed').length
  };

  console.log('[MasterBalanceCalculator] 📊 FETCHED TRANSACTIONS:', {
    wallet_total: walletTransactions.length,
    wallet_by_status: walletByStatus,
    bonus_total: bonusTransactions.length,
    stars_total: starsTransactions.length
  });

  if (bonusTransactions.length > 0) {
    console.log('[MasterBalanceCalculator] 💰 BONUS TRANSACTIONS (first 5):', bonusTransactions.slice(0, 5).map(t => ({
      id: t.id,
      amount: t.amount,
      type: t.transaction_type,
      description: t.description,
      created_at: t.created_at,
      balance_after: t.balance_after
    })));
  } else {
    console.log('[MasterBalanceCalculator] ⚠️ NO BONUS TRANSACTIONS FOUND for user:', userId);
  }

  if (starsTransactions.length > 0) {
    console.log('[MasterBalanceCalculator] ⭐ STARS TRANSACTIONS (first 5):', starsTransactions.slice(0, 5).map(t => ({
      id: t.id,
      amount: t.amount,
      type: t.transaction_type,
      source: t.source,
      created_at: t.created_at,
      balance_after: t.balance_after
    })));
  } else {
    console.log('[MasterBalanceCalculator] ⚠️ NO STARS TRANSACTIONS FOUND for user:', userId);
  }

  const allTransactions = [
    ...walletTransactions.map(t => ({ ...t, source: 'wallet' as const })),
    ...bonusTransactions.map(t => ({ ...t, source: 'bonus' as const })),
    ...starsTransactions.map(t => ({ ...t, source: 'stars' as const }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  let wBalance = 0;
  let bonusBalance = 0;
  let starsBalance = 0;
  let lifetimeTopup = 0;

  const sortedAscending = [...allTransactions].reverse();
  const balanceSnapshots = new Map<string, { wallet: number; bonus: number; stars: number; topup: number }>();

  for (const transaction of sortedAscending) {
    if (transaction.source === 'wallet') {
      const wt = transaction as WalletTransaction & { source: 'wallet' };

      // CRITICAL: Only process successful transactions
      if (wt.status !== 'success') {
        console.log('[MasterBalanceCalculator] Skipping non-success wallet transaction:', wt.id, wt.status);
        continue;
      }

      const change = wt.transaction_type === 'spend' ? -Math.abs(wt.amount) : Math.abs(wt.amount);
      wBalance += change;

      if (wt.transaction_type === 'topup') {
        lifetimeTopup += Math.abs(wt.amount);
      }
    } else if (transaction.source === 'bonus') {
      const bt = transaction as BonusTransaction & { source: 'bonus' };

      // Note: bonus_transactions don't have a status column - all records are valid
      const change = bt.transaction_type === 'spend' || bt.transaction_type === 'revoke' ? -Math.abs(bt.amount) : Math.abs(bt.amount);
      const previousBalance = bonusBalance;
      bonusBalance += change;

      if (bonusTransactions.length > 0 && sortedAscending.indexOf(transaction) < 5) {
        console.log('[MasterBalanceCalculator] 💰 Processing bonus tx:', {
          id: bt.id,
          amount: bt.amount,
          type: bt.transaction_type,
          change,
          previousBalance: previousBalance.toFixed(2),
          newBalance: bonusBalance.toFixed(2),
          created_at: bt.created_at
        });
      }
    } else if (transaction.source === 'stars') {
      const st = transaction as StarsTransaction & { source: 'stars' };

      // Note: stars_transactions don't have a status column - all records are valid
      const change = st.transaction_type === 'spend' ? -Math.abs(st.amount) : Math.abs(st.amount);
      const previousBalance = starsBalance;
      starsBalance += change;

      if (starsTransactions.length > 0 && sortedAscending.indexOf(transaction) < 5) {
        console.log('[MasterBalanceCalculator] ⭐ Processing stars tx:', {
          id: st.id,
          amount: st.amount,
          type: st.transaction_type,
          change,
          previousBalance: previousBalance,
          newBalance: starsBalance,
          created_at: st.created_at
        });
      }
    }

    balanceSnapshots.set(transaction.id, {
      wallet: wBalance,
      bonus: bonusBalance,
      stars: starsBalance,
      topup: lifetimeTopup
    });
  }

  const unifiedTransactions: UnifiedTransaction[] = [];

  for (const transaction of allTransactions) {
    const snapshot = balanceSnapshots.get(transaction.id) || {
      wallet: 0,
      bonus: 0,
      stars: 0,
      topup: 0
    };

    let orderId: string | null = null;
    let description = '';
    let walletChange = 0;
    let bonusChange = 0;
    let starsChange = 0;

    if (transaction.source === 'wallet') {
      const wt = transaction as WalletTransaction & { source: 'wallet' };
      orderId = wt.metadata?.order_id || wt.payment_transaction_id || null;
      description = wt.description || wt.transaction_type;
      walletChange = wt.transaction_type === 'spend' ? -Math.abs(wt.amount) : Math.abs(wt.amount);
    } else if (transaction.source === 'bonus') {
      const bt = transaction as BonusTransaction & { source: 'bonus' };
      orderId = bt.metadata?.order_id || null;
      description = bt.description || bt.source || bt.transaction_type;
      bonusChange = bt.transaction_type === 'spend' || bt.transaction_type === 'revoke' ? -Math.abs(bt.amount) : Math.abs(bt.amount);
    } else if (transaction.source === 'stars') {
      const st = transaction as StarsTransaction & { source: 'stars' };
      orderId = st.metadata?.order_id || null;
      description = st.description || st.source || st.transaction_type;
      starsChange = st.transaction_type === 'spend' ? -Math.abs(st.amount) : Math.abs(st.amount);
    }

    unifiedTransactions.push({
      id: transaction.id,
      created_at: transaction.created_at,
      transaction_type: transaction.transaction_type,
      source_table: transaction.source,
      description,
      order_id: orderId,
      wallet_balance: snapshot.wallet,
      bonus_balance: snapshot.bonus,
      stars_balance: snapshot.stars,
      lifetime_topup: snapshot.topup,
      wallet_change: walletChange,
      bonus_change: bonusChange,
      stars_change: starsChange,
      raw_transaction: transaction
    });
  }

  console.log('[MasterBalanceCalculator] ===== CALCULATION COMPLETE =====');
  console.log('[MasterBalanceCalculator] Final balances:', {
    wBalance: wBalance.toFixed(2),
    bonusBalance: bonusBalance.toFixed(2),
    starsBalance: starsBalance,
    lifetimeTopup: lifetimeTopup.toFixed(2),
    total_transactions_processed: allTransactions.length,
    wallet_success_count: walletByStatus.success,
    wallet_pending_count: walletByStatus.pending
  });
  console.log('[MasterBalanceCalculator] ==========================================');

  return {
    totalTransactions: allTransactions.length,
    lifetimeTopup,
    wBalance,
    bonusBalance,
    starsBalance,
    transactionHistory: unifiedTransactions,
    calculatedAt: new Date().toISOString()
  };
}

export async function verifyUserBalances(userId: string): Promise<{
  calculated: MasterBalances;
  stored: {
    wBalance: number | null;
    bonusBalance: number | null;
    starsBalance: number | null;
    lifetimeTopup: number;
  };
  discrepancies: {
    wallet: boolean;
    bonus: boolean;
    stars: boolean;
    lifetime: boolean;
  };
}> {
  const calculated = await calculateMasterBalances(userId);

  // Get lifetime_topups from users table (only stored value now)
  const { data: userData, error } = await supabase
    .from('users')
    .select('lifetime_topups')
    .eq('id', userId)
    .single();

  if (error) throw error;

  // All balances are calculated from transactions - no stored balances anymore
  const stored = {
    wBalance: null, // Not stored, calculated from wallet_transactions
    bonusBalance: null, // Not stored, calculated from bonus_transactions
    starsBalance: null, // Not stored, calculated from stars_transactions
    lifetimeTopup: userData.lifetime_topups || 0
  };

  // Check for discrepancies (only lifetime_topups is stored, others are calculated)
  // Use a tolerance of 0.01 to account for floating point precision
  const TOLERANCE = 0.01;
  const discrepancies = {
    wallet: false, // Not stored, always calculated from transactions
    bonus: false, // Not stored, always calculated from transactions
    stars: false, // Not stored, always calculated from transactions
    lifetime: Math.abs(calculated.lifetimeTopup - stored.lifetimeTopup) > TOLERANCE
  };

  return {
    calculated,
    stored,
    discrepancies
  };
}

export async function syncUserBalancesToDatabase(userId: string): Promise<void> {
  const balances = await calculateMasterBalances(userId);

  // Only sync lifetime_topups - all other balances are calculated from transactions
  const { error } = await supabase
    .from('users')
    .update({
      lifetime_topups: balances.lifetimeTopup,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (error) throw error;

  console.log('[MasterBalanceCalculator] Synced lifetime_topups for user:', userId);
  console.log('[MasterBalanceCalculator] Note: Balances are calculated from transactions (single source of truth)');
}
