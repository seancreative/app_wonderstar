import { API_BASE_URL } from '../config/api';

export interface GachaSpinResult {
    success: boolean;
    status?: 'ok' | 'no_prizes_left' | 'error';
    reward_amount?: number;
    reward_label?: string;
    line_number?: number;
    claimed_at?: string;
    balances?: {
        wBalance: number;
        bonusBalance: number;
        starsBalance: number;
        tier?: string;
        tierFactor?: number;
    };
    error?: string;
}

export interface GachaBalanceResult {
    success: boolean;
    balances?: {
        wBalance: number;
        bonusBalance: number;
        starsBalance: number;
        freeSpins: number;
        totalSpins: number;
    };
    tier?: {
        name: string;
        type: string;
        factor: number;
        lifetime_topups: number;
    };
    error?: string;
}

class GachaService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = API_BASE_URL;
    }

    /**
     * Process a gacha spin via the Laravel backend
     * Uses wpay_users as source of truth for stars/bonus
     */
    async spin(params: {
        email: string;
        spinType: 'stars' | 'free';
    }): Promise<GachaSpinResult> {
        try {
            console.log('[GachaService] Processing spin via backend:', params);

            const response = await fetch(`${this.baseUrl}/api/gacha/spin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    email: params.email,
                    spin_type: params.spinType,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('[GachaService] Spin failed:', data);
                return {
                    success: false,
                    status: 'error',
                    error: data.error || 'Spin failed',
                };
            }

            console.log('[GachaService] Spin successful:', data);
            return {
                success: true,
                status: data.status,
                reward_amount: data.reward_amount,
                reward_label: data.reward_label,
                line_number: data.line_number,
                claimed_at: data.claimed_at,
                balances: data.balances,
            };
        } catch (error) {
            console.error('[GachaService] Spin error:', error);
            return {
                success: false,
                status: 'error',
                error: error instanceof Error ? error.message : 'Network error',
            };
        }
    }

    /**
     * Get user's balances from the Laravel backend (wpay_users)
     * This is the source of truth for stars, bonus, and tier
     */
    async getBalance(email: string): Promise<GachaBalanceResult> {
        try {
            const response = await fetch(`${this.baseUrl}/api/gacha/balance/${encodeURIComponent(email)}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: data.error || 'Failed to get balance',
                };
            }

            return {
                success: true,
                balances: data.balances,
                tier: data.tier,
            };
        } catch (error) {
            console.error('[GachaService] Get balance error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error',
            };
        }
    }
}

export const gachaService = new GachaService();
