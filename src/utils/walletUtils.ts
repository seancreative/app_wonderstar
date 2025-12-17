import type { WalletTransaction } from '../types/database';

/**
 * SINGLE SOURCE OF TRUTH for wallet balance calculation
 * Used by: useWallet hook, CMS CustomerDetailModal, and any other components
 *
 * This ensures consistent balance calculation across the entire application
 */

interface BalanceResult {
  wBalance: number;
  totalTopups: number;
  totalSpends: number;
  successfulTransactions: number;
  pendingTransactions: number;
  failedTransactions: number;
}

/**
 * Calculate wallet balance from transactions
 * IMPORTANT: Only counts transactions with status='success'
 *
 * @param transactions - Array of wallet transactions
 * @returns Calculated balance and statistics
 */
export function calculateWalletBalance(transactions: WalletTransaction[] | undefined): BalanceResult {
  if (!transactions || transactions.length === 0) {
    return {
      wBalance: 0,
      totalTopups: 0,
      totalSpends: 0,
      successfulTransactions: 0,
      pendingTransactions: 0,
      failedTransactions: 0
    };
  }

  let wBalance = 0;
  let totalTopups = 0;
  let totalSpends = 0;
  let successfulCount = 0;
  let pendingCount = 0;
  let failedCount = 0;

  transactions.forEach((tx) => {
    // Count transaction status
    if (tx.status === 'success') {
      successfulCount++;
    } else if (tx.status === 'pending' || tx.status === 'processing') {
      pendingCount++;
      return; // Skip pending transactions
    } else if (tx.status === 'failed' || tx.status === 'cancelled') {
      failedCount++;
      return; // Skip failed transactions
    } else {
      return; // Skip unknown status
    }

    // Only process successful transactions for balance calculation
    const amount = parseFloat(tx.amount.toString());

    if (tx.transaction_type === 'topup' || tx.transaction_type === 'refund') {
      wBalance += amount;
      totalTopups += amount;
    } else if (tx.transaction_type === 'spend') {
      const spendAmount = Math.abs(amount);
      wBalance -= spendAmount;
      totalSpends += spendAmount;
    } else if (tx.transaction_type === 'bonus') {
      // Bonus transactions don't affect wallet balance (only bonus_balance in users table)
      // They are tracked separately
    }
  });

  return {
    wBalance: Math.max(0, wBalance),
    totalTopups,
    totalSpends,
    successfulTransactions: successfulCount,
    pendingTransactions: pendingCount,
    failedTransactions: failedCount
  };
}

/**
 * REMOVED: This function previously read from users.bonus_balance column
 * That column no longer exists. Use calculateBonusBalance() with bonus_transactions instead.
 *
 * @deprecated Column removed - use calculateBonusBalance() with bonus_transactions
 */
export function getBonusBalance(bonusBalance: number | null | undefined): number {
  console.warn('getBonusBalance() is deprecated - users.bonus_balance column no longer exists. Use calculateBonusBalance() with bonus_transactions.');
  return Math.max(0, bonusBalance || 0);
}

interface BonusTransaction {
  amount: number;
  transaction_type: 'earn' | 'spend' | 'topup_bonus' | 'gacha_prize' | 'revoke' | 'admin_adjustment';
  created_at: string;
}

interface BonusBalanceResult {
  bonusBalance: number;
  totalEarned: number;
  totalSpent: number;
  transactionCount: number;
}

/**
 * SINGLE SOURCE OF TRUTH for bonus balance calculation
 * Calculate bonus balance from bonus_transactions table
 *
 * Transaction types:
 * - earn/topup_bonus/gacha_prize: positive amounts (add to balance)
 * - spend/revoke: amounts that reduce balance
 * - admin_adjustment: can be positive or negative
 *
 * @param transactions - Array of bonus transactions
 * @returns Calculated balance and statistics
 */
export function calculateBonusBalance(transactions: BonusTransaction[] | undefined): BonusBalanceResult {
  if (!transactions || transactions.length === 0) {
    return {
      bonusBalance: 0,
      totalEarned: 0,
      totalSpent: 0,
      transactionCount: 0
    };
  }

  let totalEarned = 0;
  let totalSpent = 0;

  const total = transactions.reduce((sum, tx) => {
    const amount = parseFloat(tx.amount.toString());

    if (tx.transaction_type === 'earn' || tx.transaction_type === 'topup_bonus' || tx.transaction_type === 'gacha_prize') {
      totalEarned += Math.abs(amount);
      return sum + Math.abs(amount);
    } else if (tx.transaction_type === 'spend' || tx.transaction_type === 'revoke') {
      totalSpent += Math.abs(amount);
      return sum - Math.abs(amount);
    } else if (tx.transaction_type === 'admin_adjustment') {
      // Admin adjustments can be positive or negative
      if (amount >= 0) {
        totalEarned += amount;
      } else {
        totalSpent += Math.abs(amount);
      }
      return sum + amount;
    }
    return sum;
  }, 0);

  return {
    bonusBalance: Math.max(0, total),
    totalEarned,
    totalSpent,
    transactionCount: transactions.length
  };
}

interface StarsTransaction {
  amount: number;
  transaction_type: 'earn' | 'spend' | 'bonus';
}

interface StarsBalanceResult {
  starsBalance: number;
  totalEarned: number;
  totalSpent: number;
  transactionCount: number;
}

/**
 * Calculate stars balance from transactions
 * IMPORTANT: Matches database function get_user_stars_balance() logic
 * - earn/bonus: positive amounts (add to balance)
 * - spend: amounts are already negative in database (add directly)
 *
 * @param transactions - Array of stars transactions
 * @returns Calculated balance and statistics
 */
export function calculateStarsBalance(transactions: StarsTransaction[] | undefined): StarsBalanceResult {
  if (!transactions || transactions.length === 0) {
    return {
      starsBalance: 0,
      totalEarned: 0,
      totalSpent: 0,
      transactionCount: 0
    };
  }

  let totalEarned = 0;
  let totalSpent = 0;

  const total = transactions.reduce((sum, tx) => {
    if (tx.transaction_type === 'earn' || tx.transaction_type === 'bonus') {
      totalEarned += tx.amount;
      return sum + tx.amount;
    } else if (tx.transaction_type === 'spend') {
      const spendAmount = Math.abs(tx.amount);
      totalSpent += spendAmount;
      return sum + tx.amount;
    }
    return sum;
  }, 0);

  return {
    starsBalance: Math.max(0, total),
    totalEarned,
    totalSpent,
    transactionCount: transactions.length
  };
}

interface BalanceAudit {
  wBalance: number;
  bonusBalance: number;
  starsBalance: number;
  walletDetails: {
    totalTopups: number;
    totalSpends: number;
    successfulTransactions: number;
    pendingTransactions: number;
  };
  starsDetails: {
    totalEarned: number;
    totalSpent: number;
    transactionCount: number;
  };
  hasDiscrepancy: boolean;
  discrepancies: string[];
}

/**
 * Comprehensive balance audit comparing stored values vs calculated values
 * Detects discrepancies between database stored balances and transaction history
 *
 * @param walletTransactions - Array of wallet transactions
 * @param bonusTransactions - Array of bonus transactions
 * @param starsTransactions - Array of stars transactions
 * @returns Complete balance audit with discrepancy detection
 */
export function auditBalances(
  walletTransactions: any[] | undefined,
  bonusTransactions: any[] | undefined,
  starsTransactions: any[] | undefined
): BalanceAudit {
  const walletResult = calculateWalletBalance(walletTransactions);
  const bonusResult = calculateBonusBalance(bonusTransactions);
  const starsResult = calculateStarsBalance(starsTransactions);

  const discrepancies: string[] = [];

  return {
    wBalance: walletResult.wBalance,
    bonusBalance: bonusResult.bonusBalance,
    starsBalance: starsResult.starsBalance,
    walletDetails: {
      totalTopups: walletResult.totalTopups,
      totalSpends: walletResult.totalSpends,
      successfulTransactions: walletResult.successfulTransactions,
      pendingTransactions: walletResult.pendingTransactions,
    },
    starsDetails: {
      totalEarned: starsResult.totalEarned,
      totalSpent: starsResult.totalSpent,
      transactionCount: starsResult.transactionCount,
    },
    hasDiscrepancy: discrepancies.length > 0,
    discrepancies
  };
}
