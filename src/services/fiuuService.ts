const FIUU_BASE_URL = 'https://app.aigenius.com.my';

const FIUU_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'ngrok-skip-browser-warning': 'true'
};

export interface FiuuPaymentInitiation {
  customer_id: string;
  product_id: string;
  order_id: string;
  amount: number;
  payment_method: string;
  shop_order_id?: string;
  wallet_transaction_id?: string;
  user_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  product_name?: string;
  customer_country?: string;
}

export interface FiuuPaymentResponse {
  success: boolean;
  data: {
    payment_url: string;
    payment_data: Record<string, any>;
    transaction_id?: string;
  };
  message?: string;
}

class FiuuService {
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any,
    timeout: number = 30000
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const url = `${FIUU_BASE_URL}${endpoint}`;
      const options: RequestInit = {
        method,
        headers: FIUU_HEADERS,
        signal: controller.signal,
      };

      if (body && method === 'POST') {
        options.body = JSON.stringify(body);
      }

      console.log(`[Fiuu API] ${method} ${url}`);
      if (body) {
        console.log(`[Fiuu API] Request body:`, body);
      }

      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      const responseText = await response.text();
      console.log(`[Fiuu API] Response status:`, response.status);
      console.log(`[Fiuu API] Response body:`, responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[Fiuu API] Failed to parse response as JSON:`, responseText);
        throw new Error(`Invalid response from payment gateway: ${responseText.substring(0, 100)}`);
      }

      if (!response.ok) {
        const errorMessage = data.message || data.error || data.errors || `HTTP ${response.status}`;
        console.error(`[Fiuu API] Error response:`, data);
        throw new Error(`Payment Gateway Error: ${errorMessage}`);
      }

      console.log(`[Fiuu API] Success:`, endpoint);
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[Fiuu API] Request timeout (${endpoint})`);
        throw new Error('Payment request timed out. Please check your internet connection and try again.');
      }

      console.error(`[Fiuu API] Request failed (${method} ${endpoint}):`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      throw error instanceof Error ? error : new Error('Unknown error occurred during payment processing');
    }
  }

  async initiatePayment(paymentData: FiuuPaymentInitiation): Promise<FiuuPaymentResponse> {
    const response = await this.makeRequest<{
      success: boolean;
      data: {
        payment_url: string;
        payment_data: Record<string, any>;
        transaction_id?: string;
      };
    }>(
      '/payments/initiate',
      'POST',
      paymentData
    );

    return response;
  }

  async getPaymentTransaction(orderId: string): Promise<any> {
    const response = await this.makeRequest<{
      success: boolean;
      data: any;
    }>(
      `/payments/transaction/${orderId}`,
      'GET'
    );

    return response.data;
  }

 mapPaymentMethodToFiuu(method: string): string {
    // No conversion - pass through the exact payment method
    // So 'tng' stays 'tng', 'grabpay' stays 'grabpay', etc.
    return method;
  }

  async submitPaymentForm(paymentUrl: string, paymentData: Record<string, any>): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('[Fiuu] Creating payment form');
        console.log('[Fiuu] Payment URL:', paymentUrl);
        console.log('[Fiuu] Payment data keys:', Object.keys(paymentData));

        if (!paymentUrl || typeof paymentUrl !== 'string') {
          throw new Error('Invalid payment URL');
        }

        if (!paymentData || typeof paymentData !== 'object') {
          throw new Error('Invalid payment data');
        }

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = paymentUrl;
        form.style.display = 'none';
        form.setAttribute('id', 'fiuu-payment-form');

        Object.entries(paymentData).forEach(([key, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = String(value);
          form.appendChild(input);
        });

        document.body.appendChild(form);
        console.log('[Fiuu] Payment form created and appended to body');

        setTimeout(() => {
          console.log('[Fiuu] Submitting payment form');
          form.submit();
          resolve();
        }, 100);

      } catch (error) {
        console.error('[Fiuu] Error creating/submitting payment form:', error);
        reject(error instanceof Error ? error : new Error('Failed to submit payment form'));
      }
    });
  }
}

export const fiuuService = new FiuuService();