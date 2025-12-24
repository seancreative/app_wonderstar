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
     * Uses caching to prevent excessive API calls
     */
    async getBalance(email: string, forceRefresh = false): Promise<GachaBalanceResult> {
        try {
            console.log('[GachaService] Fetching balance for:', email);

            // Use cached profile to prevent excessive API calls
            const { wpayCache } = await import('./wpayCache');
            const profileResponse = await wpayCache.getProfile(email, forceRefresh);

            if (profileResponse.wpay_status === 'success' && profileResponse.profile) {
                const profile = profileResponse.profile;

                console.log('[GachaService] Got balance from cache:', profileResponse.fromCache ? '(cached)' : '(fresh)');

                return {
                    success: true,
                    balances: {
                        wBalance: profile.wbalance || 0,
                        bonusBalance: profile.bonus || 0,
                        starsBalance: profile.stars || 0,
                        freeSpins: 0, // Free spins are stored in Supabase, fetch separately if needed
                        totalSpins: 0,
                    },
                    tier: {
                        name: (profile.tier_type || 'bronze').charAt(0).toUpperCase() + (profile.tier_type || 'bronze').slice(1),
                        type: profile.tier_type || 'bronze',
                        factor: profile.tier_factor || 1,
                        lifetime_topups: profile.lifetime_topups || 0,
                    },
                };
            }

            // Fallback: Direct API call if cache fails
            console.log('[GachaService] Cache failed, falling back to direct API call');

            const response = await fetch(`${this.baseUrl}/api/gacha/balance/${encodeURIComponent(email)}`, {
                method: 'GET',
                mode: 'cors',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                },
                credentials: 'omit',
            });

            console.log('[GachaService] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[GachaService] Error response:', errorText);
                return {
                    success: false,
                    error: `HTTP ${response.status}: ${errorText || 'Failed to get balance'}`,
                };
            }

            const data = await response.json();

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
