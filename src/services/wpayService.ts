import { API_BASE_URL } from '../config/api';

const WPAY_BASE_URL = API_BASE_URL;

const WPAY_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'ngrok-skip-browser-warning': 'true',
};

let debugLogger: ((log: any) => void) | null = null;

export const setWPayDebugLogger = (logger: (log: any) => void) => {
  debugLogger = logger;
};

export type TierType = 'bronze' | 'silver' | 'gold' | 'platinum' | 'vip';
export type PaymentCategory = 'topup' | 'checkout';
export type PaymentType = 'online' | 'wbalance' | 'free';
export type PaymentMethod = 'card' | 'fpx' | 'grabpay' | 'tng';
export type WPayStatus = 'success' | 'pending' | 'failed';

export interface WPayTier {
  name: string;
  threshold: number;
  earn_multiplier: number;
  shop_discount_pct: number;
  benefits: string[];
}

export interface WPayProfile {
  email: string;
  lifetime_topups: number;
  wbalance: number;
  bonus: number;
  stars: number;
  tier_type: TierType;
  tier_factor: number;
}

export interface WPayProcessRequest {
  email: string;
  payment_category: PaymentCategory;
  payment_type: PaymentType;
  order_id: string;
  amount: number;
  payment_method?: PaymentMethod;
  customer_name?: string;
  customer_phone?: string;
  product_name?: string;
  customer_country?: string;
  metadata?: Record<string, any>;
}

export interface WPayTransactionDetails {
  amount: number;
  wbalance_used: number;
  bonus_used: number;
  stars_awarded: number;
}

export interface WPayResponse {
  wpay_status: WPayStatus;
  message?: string;
  email?: string;
  order_id?: string;
  transaction_id?: string;
  profile?: WPayProfile;
  payment_url?: string;
  payment_data?: Record<string, any>;
  transaction_details?: WPayTransactionDetails;
  expected_bonus?: number;
  errors?: Record<string, string[]>;
}

export interface WPayTransaction {
  id: string;
  order_id: string;
  email: string;
  payment_category: PaymentCategory;
  payment_type: PaymentType;
  amount: number;
  status: string;
  wbalance_used: number;
  bonus_used: number;
  stars_awarded: number;
  completed_at: string | null;
  created_at: string;
  metadata?: Record<string, any> | string;
}

class WPayService {
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any,
    timeout: number = 15000
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const startTime = Date.now();

    try {
      const url = `${WPAY_BASE_URL}${endpoint}`;
      const options: RequestInit = {
        method,
        headers: WPAY_HEADERS,
        signal: controller.signal,
      };

      if (body && method === 'POST') {
        options.body = JSON.stringify(body);
      }

      console.log(`[WPay API] ${method} ${url}`);
      if (body) {
        console.log(`[WPay API] Request body:`, body);
      }

      if (debugLogger) {
        debugLogger({
          type: 'request',
          method,
          endpoint,
          request: body,
        });
      }

      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      const responseText = await response.text();
      const duration = Date.now() - startTime;

      console.log(`[WPay API] Response status:`, response.status);
      console.log(`[WPay API] Response body:`, responseText.substring(0, 500));

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[WPay API] Failed to parse response as JSON:`, responseText);
        const errorMsg = `Invalid response from WPay backend: ${responseText.substring(0, 100)}`;

        if (debugLogger) {
          debugLogger({
            type: 'error',
            method,
            endpoint,
            request: body,
            error: errorMsg,
            duration,
          });
        }

        throw new Error(errorMsg);
      }

      if (!response.ok) {
        const errorMessage = data.message || data.error || data.errors || `HTTP ${response.status}`;
        console.error(`[WPay API] Error response:`, data);

        if (debugLogger) {
          debugLogger({
            type: 'error',
            method,
            endpoint,
            request: body,
            response: data,
            error: `WPay Error: ${errorMessage}`,
            duration,
          });
        }

        throw new Error(`WPay Error: ${errorMessage}`);
      }

      console.log(`[WPay API] Success:`, endpoint);

      if (debugLogger) {
        debugLogger({
          type: 'response',
          method,
          endpoint,
          request: body,
          response: data,
          duration,
        });
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[WPay API] Request timeout (${endpoint})`);
        const errorMsg = 'WPay request timed out. Please check your internet connection and try again.';

        if (debugLogger) {
          debugLogger({
            type: 'error',
            method,
            endpoint,
            request: body,
            error: errorMsg,
            duration,
          });
        }

        throw new Error(errorMsg);
      }

      console.error(`[WPay API] Request failed (${method} ${endpoint}):`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      if (debugLogger && !(error instanceof Error && error.message.startsWith('WPay Error:'))) {
        debugLogger({
          type: 'error',
          method,
          endpoint,
          request: body,
          error: error instanceof Error ? error.message : String(error),
          duration,
        });
      }

      throw error instanceof Error ? error : new Error('Unknown error occurred during WPay processing');
    }
  }

  /**
   * Process a payment (Main Entry Point)
   * POST /wpay/process
   */
  async processPayment(data: WPayProcessRequest): Promise<WPayResponse> {
    console.log('[WPay] Processing payment:', {
      email: data.email,
      category: data.payment_category,
      type: data.payment_type,
      order_id: data.order_id,
      amount: data.amount,
      use_bonus: data.metadata?.use_bonus
    });

    return this.request<WPayResponse>(
      '/wpay/process',
      'POST',
      data,
      30000
    );
  }

  /**
   * Get user profile by email
   * GET /wpay/profile/{email}
   */
  async getProfile(email: string): Promise<{
    wpay_status: WPayStatus;
    profile?: WPayProfile;
    message?: string;
  }> {
    console.log('[WPay] Fetching profile for:', email);

    return this.request(
      `/wpay/profile/${encodeURIComponent(email)}`,
      'GET'
    );
  }

  /**
   * Get transaction by order ID
   * GET /wpay/transaction/{orderId}
   */
  async getTransaction(orderId: string): Promise<{
    wpay_status: WPayStatus;
    transaction?: WPayTransaction;
    profile?: WPayProfile;
    message?: string;
  }> {
    console.log('[WPay] Fetching transaction:', orderId);

    return this.request(
      `/wpay/transaction/${orderId}`,
      'GET'
    );
  }

  /**
   * Get all tier information
   * GET /wpay/tiers
   */
  async getTiers(): Promise<{
    wpay_status: WPayStatus;
    tiers: WPayTier[];
  }> {
    console.log('[WPay] Fetching tiers configuration');

    return this.request(
      '/wpay/tiers',
      'GET'
    );
  }

  /**
   * Complete a pending transaction
   * POST /wpay/complete/:orderId
   */
  async completeTransaction(orderId: string): Promise<{
    wpay_status: WPayStatus;
    transaction?: WPayTransaction;
    message?: string;
  }> {
    console.log('[WPay] Completing transaction:', orderId);

    return this.request(
      `/wpay/complete/${orderId}`,
      'POST'
    );
  }

  /**
   * Get tier color for UI display
   */
  getTierColor(tier: TierType): string {
    const colors: Record<TierType, string> = {
      bronze: '#CD7F32',
      silver: '#C0C0C0',
      gold: '#FFD700',
      platinum: '#E5E4E2',
      vip: '#8B0000',
    };
    return colors[tier] || colors.bronze;
  }

  /**
   * Helper method to check if WPay API is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${WPAY_BASE_URL}/health`, {
        method: 'GET',
        headers: WPAY_HEADERS,
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      console.error('[WPay] Health check failed:', error);
      return false;
    }
  }
}

export const wpayService = new WPayService();
