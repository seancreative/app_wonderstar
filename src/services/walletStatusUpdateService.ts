import { supabase } from '../lib/supabase';

/**
 * Wallet Status Update Service
 *
 * Provides robust, retry-enabled functions for updating wallet transaction status.
 * Uses atomic database functions with comprehensive error handling and logging.
 */

interface StatusUpdateResult {
  success: boolean;
  message: string;
  old_status?: string;
  new_status?: string;
  transaction_id?: string;
  user_id?: string;
  amount?: number;
  audit_id?: string;
  idempotent?: boolean;
  race_condition?: boolean;
  error?: string;
  error_code?: string;
  error_message?: string;
  error_details?: any;
  attempt?: number;
  max_attempts?: number;
}

interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 5,
  initialDelayMs: 200,
  maxDelayMs: 5000,
  backoffMultiplier: 2
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(
  attempt: number,
  options: Required<RetryOptions>
): number {
  const delay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt - 1);
  return Math.min(delay, options.maxDelayMs);
}

/**
 * Update wallet transaction status with retry logic and comprehensive logging
 *
 * This function uses the database's atomic update function which provides:
 * - Idempotency (safe to call multiple times)
 * - Race condition handling
 * - Comprehensive error logging
 * - Audit trail
 *
 * @param walletTransactionId - UUID of the wallet transaction
 * @param newStatus - Target status ('success', 'failed', 'cancelled', etc.)
 * @param triggeredBy - Source of the update ('payment_callback', 'admin', etc.)
 * @param metadata - Additional metadata to store
 * @param options - Retry configuration
 * @returns StatusUpdateResult with success status and details
 */
export async function updateWalletTransactionStatus(
  walletTransactionId: string,
  newStatus: 'success' | 'failed' | 'cancelled' | 'pending' | 'processing',
  triggeredBy: string = 'payment_callback',
  metadata: Record<string, any> = {},
  options: RetryOptions = {}
): Promise<StatusUpdateResult> {
  const retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };

  console.log('[WalletStatusUpdate] ===== STARTING STATUS UPDATE =====');
  console.log('[WalletStatusUpdate] Transaction ID:', walletTransactionId);
  console.log('[WalletStatusUpdate] Target Status:', newStatus);
  console.log('[WalletStatusUpdate] Triggered By:', triggeredBy);
  console.log('[WalletStatusUpdate] Retry Config:', retryOptions);
  console.log('[WalletStatusUpdate] Metadata:', metadata);

  let lastError: any = null;

  for (let attempt = 1; attempt <= retryOptions.maxAttempts; attempt++) {
    console.log(`[WalletStatusUpdate] Attempt ${attempt}/${retryOptions.maxAttempts}`);

    try {
      // Call the atomic database function
      const { data, error } = await supabase.rpc('update_wallet_transaction_status', {
        p_wallet_transaction_id: walletTransactionId,
        p_new_status: newStatus,
        p_triggered_by: triggeredBy,
        p_metadata: metadata
      });

      if (error) {
        console.error(`[WalletStatusUpdate] Attempt ${attempt} - RPC Error:`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        lastError = error;

        // Check if this is a retryable error
        const isRetryable = isRetryableError(error);

        if (!isRetryable) {
          console.error('[WalletStatusUpdate] ❌ Non-retryable error, aborting');
          return {
            success: false,
            error: 'Database function call failed',
            error_code: error.code,
            error_message: error.message,
            error_details: error,
            attempt,
            max_attempts: retryOptions.maxAttempts
          };
        }

        // Wait before retry
        if (attempt < retryOptions.maxAttempts) {
          const delay = calculateBackoffDelay(attempt, retryOptions);
          console.log(`[WalletStatusUpdate] Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
      } else {
        // Success! Parse the result
        const result = data as StatusUpdateResult;

        console.log('[WalletStatusUpdate] ✅ Update successful:', {
          success: result.success,
          old_status: result.old_status,
          new_status: result.new_status,
          idempotent: result.idempotent,
          race_condition: result.race_condition,
          audit_id: result.audit_id,
          attempt
        });

        if (!result.success) {
          console.error('[WalletStatusUpdate] ❌ Function returned failure:', result);
          lastError = result;

          // If function says it's failed, retry
          if (attempt < retryOptions.maxAttempts) {
            const delay = calculateBackoffDelay(attempt, retryOptions);
            console.log(`[WalletStatusUpdate] Function failed, retrying in ${delay}ms...`);
            await sleep(delay);
            continue;
          }
        } else {
          // SUCCESS!
          console.log('[WalletStatusUpdate] ===== UPDATE COMPLETE (SUCCESS) =====');
          return {
            ...result,
            attempt,
            max_attempts: retryOptions.maxAttempts
          };
        }
      }
    } catch (exception: any) {
      console.error(`[WalletStatusUpdate] Attempt ${attempt} - Exception:`, {
        name: exception.name,
        message: exception.message,
        stack: exception.stack
      });
      lastError = exception;

      if (attempt < retryOptions.maxAttempts) {
        const delay = calculateBackoffDelay(attempt, retryOptions);
        console.log(`[WalletStatusUpdate] Exception caught, retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
    }
  }

  // All attempts failed
  console.error('[WalletStatusUpdate] ===== UPDATE FAILED (ALL ATTEMPTS EXHAUSTED) =====');
  console.error('[WalletStatusUpdate] Last Error:', lastError);

  return {
    success: false,
    error: 'All retry attempts failed',
    error_message: lastError?.message || 'Unknown error',
    error_details: lastError,
    attempt: retryOptions.maxAttempts,
    max_attempts: retryOptions.maxAttempts
  };
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network errors are retryable
  if (error.message?.includes('network') || error.message?.includes('timeout')) {
    return true;
  }

  // Certain PostgreSQL error codes are retryable
  const retryableCodes = [
    '40001', // serialization_failure
    '40P01', // deadlock_detected
    '53000', // insufficient_resources
    '53100', // disk_full
    '53200', // out_of_memory
    '53300', // too_many_connections
    '55006', // object_in_use
    '57P03', // cannot_connect_now
    '58000', // system_error
    '58030', // io_error
  ];

  if (error.code && retryableCodes.includes(error.code)) {
    return true;
  }

  // Default to not retrying unknown errors
  return false;
}

/**
 * Verify that a wallet transaction has the expected status
 *
 * @param walletTransactionId - UUID of the wallet transaction
 * @param expectedStatus - Expected status value
 * @returns true if status matches, false otherwise
 */
export async function verifyWalletTransactionStatus(
  walletTransactionId: string,
  expectedStatus: string
): Promise<{ verified: boolean; actualStatus: string | null; transaction: any }> {
  console.log('[WalletStatusUpdate] Verifying transaction status:', {
    transaction_id: walletTransactionId,
    expected_status: expectedStatus
  });

  try {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('id, status, amount, transaction_type, user_id, created_at, updated_at')
      .eq('id', walletTransactionId)
      .maybeSingle();

    if (error) {
      console.error('[WalletStatusUpdate] Verification failed - query error:', error);
      return { verified: false, actualStatus: null, transaction: null };
    }

    if (!data) {
      console.error('[WalletStatusUpdate] Verification failed - transaction not found');
      return { verified: false, actualStatus: null, transaction: null };
    }

    const verified = data.status === expectedStatus;

    console.log('[WalletStatusUpdate] Verification result:', {
      verified,
      expected: expectedStatus,
      actual: data.status,
      transaction_id: data.id
    });

    return {
      verified,
      actualStatus: data.status,
      transaction: data
    };
  } catch (exception: any) {
    console.error('[WalletStatusUpdate] Verification exception:', exception);
    return { verified: false, actualStatus: null, transaction: null };
  }
}

/**
 * Check for stuck wallet transactions and get details
 *
 * @param ageMinutes - Minimum age in minutes for a transaction to be considered stuck
 * @returns List of stuck transactions
 */
export async function checkStuckTransactions(
  ageMinutes: number = 10
): Promise<any[]> {
  console.log('[WalletStatusUpdate] Checking for stuck transactions older than', ageMinutes, 'minutes');

  try {
    const { data, error } = await supabase.rpc('check_stuck_wallet_transactions', {
      p_age_minutes: ageMinutes
    });

    if (error) {
      console.error('[WalletStatusUpdate] Failed to check stuck transactions:', error);
      return [];
    }

    console.log(`[WalletStatusUpdate] Found ${data?.length || 0} stuck transactions`);
    return data || [];
  } catch (exception: any) {
    console.error('[WalletStatusUpdate] Exception checking stuck transactions:', exception);
    return [];
  }
}

/**
 * Auto-fix stuck wallet transactions
 *
 * @param ageMinutes - Minimum age in minutes
 * @param dryRun - If true, only simulates the fix without actually updating
 * @returns Fix result summary
 */
export async function autoFixStuckTransactions(
  ageMinutes: number = 10,
  dryRun: boolean = false
): Promise<any> {
  console.log('[WalletStatusUpdate] Starting auto-fix for stuck transactions:', {
    age_minutes: ageMinutes,
    dry_run: dryRun
  });

  try {
    const { data, error } = await supabase.rpc('auto_fix_stuck_wallet_transactions', {
      p_age_minutes: ageMinutes,
      p_dry_run: dryRun
    });

    if (error) {
      console.error('[WalletStatusUpdate] Auto-fix failed:', error);
      return {
        success: false,
        error: error.message,
        error_details: error
      };
    }

    console.log('[WalletStatusUpdate] Auto-fix complete:', data);
    return data;
  } catch (exception: any) {
    console.error('[WalletStatusUpdate] Auto-fix exception:', exception);
    return {
      success: false,
      error: exception.message,
      error_details: exception
    };
  }
}
