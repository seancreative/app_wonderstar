// WPay Laravel API Service
// Connects to the Laravel backend for WPay transaction and user management

const WPAY_API_BASE_URL = import.meta.env.VITE_WPAY_API_URL || 'https://app.aigenius.com.my';
const WPAY_APP_SOURCE = (import.meta.env.VITE_WPAY_APP_SOURCE || 'wonderstar').trim().toLowerCase();

interface WPayTransaction {
  id: string;
  wpay_user_id: string;
  email: string;
  app_source?: string;
  order_id: string;
  payment_category: 'topup' | 'checkout';
  payment_type: 'online' | 'wbalance' | 'free';
  amount: number;
  wbalance_used: number;
  bonus_used: number;
  online_paid: number;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled';
  topup_amount: number;
  bonus_awarded: number;
  stars_awarded: number;
  fiuu_transaction_id?: string;
  fiuu_status_code?: string;
  metadata?: any;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  wpay_user?: WPayUser;
}

interface WPayUser {
  id: string;
  email: string;
  app_source?: string;
  lifetime_topups: number;
  wbalance: number;
  bonus: number;
  stars: number;
  tier_type: 'bronze' | 'silver' | 'gold' | 'platinum' | 'vip';
  tier_factor: number;
  created_at: string;
  updated_at: string;
}

interface WPayStats {
  total_wallet_topups: number;
  total_topup_count: number;
  total_wallets: number;
  total_sales: number;
  total_spent: number;
  total_balance: number;
  total_bonus: number;
  total_transactions: number;
  successful_transactions: number;
  pending_transactions: number;
  sales_breakdown?: {
    wpay_wbalance_sales: number;
    supabase_online_payment_sales: number;
    supabase_wbalance_sales: number;
    duplicates_found: number;
  };
}

interface WPayResponse<T> {
  wpay_status: 'success' | 'failed' | 'pending';
  message?: string;
  data?: T;
  transactions?: T;
  users?: T;
  stats?: T;
  count?: number;
}

/**
 * Get all WPay transactions (excludes test emails)
 */
export async function getAllTransactions(filters?: {
  status?: string;
  payment_category?: string;
  from_date?: string;
  to_date?: string;
}): Promise<{ transactions: WPayTransaction[]; count: number }> {
  try {
    const params = new URLSearchParams();
    params.append('app_source', WPAY_APP_SOURCE);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.payment_category) params.append('payment_category', filters.payment_category);
    if (filters?.from_date) params.append('from_date', filters.from_date);
    if (filters?.to_date) params.append('to_date', filters.to_date);

    const url = `${WPAY_API_BASE_URL}/wpay/admin/transactions${params.toString() ? `?${params.toString()}` : ''}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: WPayResponse<WPayTransaction[]> = await response.json();

    if (data.wpay_status === 'success' && data.transactions) {
      return {
        transactions: data.transactions,
        count: data.count || 0
      };
    }

    throw new Error(data.message || 'Failed to fetch transactions');
  } catch (error) {
    console.error('Error fetching WPay transactions:', error);
    throw error;
  }
}

/**
 * Get all WPay users (excludes test emails)
 */
export async function getAllUsers(): Promise<{ users: WPayUser[]; count: number }> {
  try {
    const response = await fetch(`${WPAY_API_BASE_URL}/wpay/admin/users?app_source=${encodeURIComponent(WPAY_APP_SOURCE)}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: WPayResponse<WPayUser[]> = await response.json();

    if (data.wpay_status === 'success' && data.users) {
      return {
        users: data.users,
        count: data.count || 0
      };
    }

    throw new Error(data.message || 'Failed to fetch users');
  } catch (error) {
    console.error('Error fetching WPay users:', error);
    throw error;
  }
}

/**
 * Get aggregated financial statistics
 */
export async function getStats(): Promise<WPayStats> {
  try {
    const response = await fetch(`${WPAY_API_BASE_URL}/wpay/admin/stats?app_source=${encodeURIComponent(WPAY_APP_SOURCE)}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: WPayResponse<WPayStats> = await response.json();

    if (data.wpay_status === 'success' && data.stats) {
      return data.stats;
    }

    throw new Error(data.message || 'Failed to fetch stats');
  } catch (error) {
    console.error('Error fetching WPay stats:', error);
    throw error;
  }
}

/**
 * Update a transaction
 */
export async function updateTransaction(
  id: string,
  updates: {
    status?: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled';
    amount?: number;
    metadata?: any;
  }
): Promise<WPayTransaction> {
  try {
    const response = await fetch(`${WPAY_API_BASE_URL}/wpay/admin/transaction/${id}?app_source=${encodeURIComponent(WPAY_APP_SOURCE)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: WPayResponse<WPayTransaction> = await response.json();

    if (data.wpay_status === 'success' && data.data) {
      return data.data;
    }

    throw new Error(data.message || 'Failed to update transaction');
  } catch (error) {
    console.error('Error updating transaction:', error);
    throw error;
  }
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(id: string): Promise<void> {
  try {
    const response = await fetch(`${WPAY_API_BASE_URL}/wpay/admin/transaction/${id}?app_source=${encodeURIComponent(WPAY_APP_SOURCE)}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: WPayResponse<void> = await response.json();

    if (data.wpay_status !== 'success') {
      throw new Error(data.message || 'Failed to delete transaction');
    }
  } catch (error) {
    console.error('Error deleting transaction:', error);
    throw error;
  }
}

/**
 * Cleanup duplicate transactions synced from Supabase
 */
export async function cleanupDuplicates(): Promise<{
  deleted: number;
  message: string;
}> {
  try {
    const response = await fetch(`${WPAY_API_BASE_URL}/wpay/admin/cleanup-duplicates?app_source=${encodeURIComponent(WPAY_APP_SOURCE)}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: any = await response.json();

    if (data.wpay_status === 'success') {
      return {
        deleted: data.deleted || 0,
        message: data.message || 'Cleanup completed'
      };
    }

    throw new Error(data.message || 'Failed to cleanup');
  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
    throw error;
  }
}

/**
 * Sync transactions from Supabase to Laravel
 */
export async function syncFromSupabase(): Promise<{
  synced: number;
  skipped: number;
  errors: string[];
  message: string;
}> {
  try {
    const response = await fetch(`${WPAY_API_BASE_URL}/wpay/admin/sync?app_source=${encodeURIComponent(WPAY_APP_SOURCE)}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: any = await response.json();

    if (data.wpay_status === 'success') {
      return {
        synced: data.synced || 0,
        skipped: data.skipped || 0,
        errors: data.errors || [],
        message: data.message || 'Sync completed'
      };
    }

    throw new Error(data.message || 'Failed to sync');
  } catch (error) {
    console.error('Error syncing from Supabase:', error);
    throw error;
  }
}

/**
 * Get test user transactions (topup only)
 */
export async function getTestTransactions(): Promise<{ transactions: WPayTransaction[]; count: number }> {
  try {
    const response = await fetch(`${WPAY_API_BASE_URL}/wpay/admin/test-transactions?app_source=${encodeURIComponent(WPAY_APP_SOURCE)}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: WPayResponse<WPayTransaction[]> = await response.json();

    if (data.wpay_status === 'success' && data.transactions) {
      return {
        transactions: data.transactions,
        count: data.count || 0
      };
    }

    throw new Error(data.message || 'Failed to fetch test transactions');
  } catch (error) {
    console.error('Error fetching test transactions:', error);
    throw error;
  }
}

export type { WPayTransaction, WPayUser, WPayStats };
