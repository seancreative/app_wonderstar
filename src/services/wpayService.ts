/**
 * WPay Service - Fixed for CORS issues
 * 
 * Avoids triggering CORS preflight by:
 * 1. Using simple requests (GET with no custom headers)
 * 2. Removing Content-Type from GET requests
 */

import { API_BASE_URL } from '../config/api';

const WPAY_BASE_URL = API_BASE_URL;

// Simple headers that don't trigger preflight
const SIMPLE_HEADERS = {
    'Accept': 'application/json',
};

// Full headers for POST (will trigger preflight, but needed)
const WPAY_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
};

// ============================================
// Types (unchanged)
// ============================================

export type TierType = 'bronze' | 'silver' | 'gold' | 'platinum' | 'vip';
export type PaymentCategory = 'topup' | 'checkout';
export type PaymentType = 'online' | 'wbalance' | 'free';
export type PaymentMethod = 'card' | 'fpx' | 'grabpay' | 'tng';
export type WPayStatus = 'success' | 'pending' | 'failed';

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

export interface WPayTopupPreview {
    topup_amount: number;
    bonus_to_award: number;
    stars_to_award: number;
    current_tier: TierType;
    current_tier_factor: number;
    new_tier: TierType;
    new_tier_factor: number;
    tier_upgrade: boolean;
    current_lifetime_topups: number;
    new_lifetime_topups: number;
}

export interface WPayTier {
    name: string;
    key: TierType;
    min_topups: number;
    max_topups: number | null;
    tier_factor: number;
    bonus_percentage: number;
    benefits: string[];
}

// ============================================
// Service Class
// ============================================

class WPayService {
    private async request<T>(
        endpoint: string,
        method: 'GET' | 'POST' = 'GET',
        body?: any,
        timeout: number = 30000
    ): Promise<T> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const url = `${WPAY_BASE_URL}${endpoint}`;
            
            // Use simple headers for GET to avoid preflight
            const headers = method === 'GET' ? SIMPLE_HEADERS : WPAY_HEADERS;
            
            const options: RequestInit = {
                method,
                headers,
                signal: controller.signal,
                // Important: use 'cors' mode explicitly
                mode: 'cors',
                // Don't send credentials to avoid preflight
                credentials: 'omit',
            };

            if (body && method === 'POST') {
                options.body = JSON.stringify(body);
            }

            console.log(`[WPay] ${method} ${url}`, body ? body : '');

            const response = await fetch(url, options);
            clearTimeout(timeoutId);

            const responseText = await response.text();
            console.log(`[WPay] Response (${response.status}):`, responseText.substring(0, 500));

            let data;
            try {
                data = JSON.parse(responseText);
            } catch {
                console.error('[WPay] Failed to parse response:', responseText);
                throw new Error('Invalid response from WPay server');
            }

            return data;
        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Request timeout. Please check your connection.');
            }

            // Better error message for CORS
            if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                throw new Error('Network error. Please check your connection or contact support.');
            }

            throw error;
        }
    }

    /**
     * Process a payment
     */
    async processPayment(data: WPayProcessRequest): Promise<WPayResponse> {
        return this.request<WPayResponse>('/wpay/process', 'POST', data);
    }

    /**
     * Get user profile by email
     * Uses simple GET request to avoid preflight
     */
    async getProfile(email: string): Promise<{ wpay_status: WPayStatus; profile?: WPayProfile; message?: string }> {
        return this.request(`/wpay/profile/${encodeURIComponent(email)}`);
    }

    /**
     * Get transaction by order ID
     */
    async getTransaction(orderId: string): Promise<{
        wpay_status: WPayStatus;
        transaction?: WPayTransaction;
        profile?: WPayProfile;
        message?: string;
    }> {
        return this.request(`/wpay/transaction/${orderId}`);
    }

    /**
     * Preview topup rewards before processing
     */
    async getTopupPreview(email: string, amount: number): Promise<{
        wpay_status: WPayStatus;
        preview?: WPayTopupPreview;
        profile?: WPayProfile;
        message?: string;
    }> {
        return this.request('/wpay/topup-preview', 'POST', { email, amount });
    }

    /**
     * Get all tier information
     */
    async getTiers(): Promise<{ wpay_status: WPayStatus; tiers: WPayTier[] }> {
        return this.request('/wpay/tiers');
    }

    /**
     * Manually complete a pending transaction
     */
    async completeTransaction(orderId: string): Promise<{
        wpay_status: WPayStatus;
        transaction?: WPayTransaction;
        profile?: WPayProfile;
        message?: string;
    }> {
        return this.request(`/wpay/complete/${orderId}`, 'POST');
    }

    /**
     * Submit payment form to Fiuu gateway
     */
    submitPaymentForm(paymentUrl: string, paymentData: Record<string, any>): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                console.log('[WPay] Creating payment form');
                console.log('[WPay] Payment URL:', paymentUrl);

                const form = document.createElement('form');
                form.method = 'POST';
                form.action = paymentUrl;
                form.style.display = 'none';
                form.id = 'wpay-payment-form';

                Object.entries(paymentData).forEach(([key, value]) => {
                    const input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = key;
                    input.value = String(value);
                    form.appendChild(input);
                });

                document.body.appendChild(form);
                console.log('[WPay] Submitting payment form');

                setTimeout(() => {
                    form.submit();
                    resolve();
                }, 100);
            } catch (error) {
                console.error('[WPay] Error submitting payment form:', error);
                reject(error);
            }
        });
    }

    /**
     * Generate a unique order ID
     */
    generateOrderId(prefix: string = 'ORD'): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 11);
        return `${prefix}-${timestamp}-${random}`;
    }

    /**
     * Check if user has sufficient balance for payment
     */
    checkBalanceAvailability(profile: WPayProfile, amount: number): {
        canPayWithWBalance: boolean;
        canPayFree: boolean;
        totalAvailable: number;
        wbalanceToUse: number;
        bonusToUse: number;
        shortfall: number;
    } {
        const bonusAvailable = profile.bonus;
        const wbalanceAvailable = profile.wbalance;
        const totalAvailable = bonusAvailable + wbalanceAvailable;

        const bonusToUse = Math.min(bonusAvailable, amount);
        const remaining = amount - bonusToUse;
        const wbalanceToUse = Math.min(wbalanceAvailable, remaining);

        return {
            canPayWithWBalance: totalAvailable >= amount,
            canPayFree: bonusAvailable >= amount,
            totalAvailable,
            wbalanceToUse,
            bonusToUse,
            shortfall: Math.max(0, amount - totalAvailable),
        };
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
     * Get tier gradient for UI display
     */
    getTierGradient(tier: TierType): string {
        const gradients: Record<TierType, string> = {
            bronze: 'linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)',
            silver: 'linear-gradient(135deg, #C0C0C0 0%, #808080 100%)',
            gold: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
            platinum: 'linear-gradient(135deg, #E5E4E2 0%, #B0C4DE 100%)',
            vip: 'linear-gradient(135deg, #8B0000 0%, #DC143C 100%)',
        };
        return gradients[tier] || gradients.bronze;
    }
}

export const wpayService = new WPayService();