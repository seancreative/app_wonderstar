/**
 * WPay Cache Service
 * 
 * Centralized caching for WPay API responses to prevent excessive API calls.
 * Uses a TTL-based cache that persists across component/page navigations.
 * 
 * Default TTL: 5 minutes (300000ms)
 * This prevents IP bans from excessive API calls while still keeping data fresh.
 */

import { wpayService, WPayProfile } from './wpayService';

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

// Minimum time between API calls even on forced refresh (2 seconds)
const MIN_REFRESH_INTERVAL = 2000;

interface CacheEntry {
    profile: WPayProfile | null;
    fetchedAt: number;
    email: string;
}

interface ProfileResponse {
    wpay_status: 'success' | 'pending' | 'failed';
    profile?: WPayProfile;
    message?: string;
    fromCache?: boolean;
}

class WPayCacheService {
    private cache: Map<string, CacheEntry> = new Map();
    private pendingRequests: Map<string, Promise<ProfileResponse>> = new Map();
    private lastApiCall: number = 0;

    /**
     * Get cached profile or fetch from API if stale
     * @param email User email
     * @param forceRefresh Force API call (still respects MIN_REFRESH_INTERVAL)
     */
    async getProfile(email: string, forceRefresh = false): Promise<ProfileResponse> {
        const normalizedEmail = email.toLowerCase().trim();
        const cacheKey = normalizedEmail;
        const now = Date.now();

        // Check if we have a valid cached entry
        const cachedEntry = this.cache.get(cacheKey);
        if (cachedEntry && !forceRefresh) {
            const age = now - cachedEntry.fetchedAt;
            if (age < CACHE_TTL) {
                console.log(`[WPayCache] Using cached profile for ${normalizedEmail} (age: ${Math.round(age / 1000)}s)`);
                return {
                    wpay_status: 'success',
                    profile: cachedEntry.profile || undefined,
                    fromCache: true
                };
            }
            console.log(`[WPayCache] Cache expired for ${normalizedEmail} (age: ${Math.round(age / 1000)}s)`);
        }

        // Check if there's already a pending request for this email
        const pendingRequest = this.pendingRequests.get(cacheKey);
        if (pendingRequest) {
            console.log(`[WPayCache] Waiting for pending request for ${normalizedEmail}`);
            return pendingRequest;
        }

        // Throttle API calls to prevent rapid successive requests
        const timeSinceLastCall = now - this.lastApiCall;
        if (timeSinceLastCall < MIN_REFRESH_INTERVAL && forceRefresh) {
            console.log(`[WPayCache] Throttling - last call was ${timeSinceLastCall}ms ago`);
            // Return cached data if available, even if expired
            if (cachedEntry) {
                return {
                    wpay_status: 'success',
                    profile: cachedEntry.profile || undefined,
                    fromCache: true
                };
            }
        }

        // Create new request
        const requestPromise = this.fetchAndCache(normalizedEmail, cacheKey);
        this.pendingRequests.set(cacheKey, requestPromise);

        try {
            const result = await requestPromise;
            return result;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    }

    /**
     * Internal method to fetch from API and cache the result
     */
    private async fetchAndCache(email: string, cacheKey: string): Promise<ProfileResponse> {
        this.lastApiCall = Date.now();
        console.log(`[WPayCache] Fetching fresh profile for ${email}`);

        try {
            const response = await wpayService.getProfile(email);

            if (response.wpay_status === 'success' && response.profile) {
                this.cache.set(cacheKey, {
                    profile: response.profile,
                    fetchedAt: Date.now(),
                    email
                });
                console.log(`[WPayCache] Cached fresh profile for ${email}`);
            }

            return { ...response, fromCache: false };
        } catch (error) {
            console.error(`[WPayCache] Error fetching profile for ${email}:`, error);

            // On error, return cached data if available (even if expired)
            const cachedEntry = this.cache.get(cacheKey);
            if (cachedEntry) {
                console.log(`[WPayCache] Returning stale cache on error for ${email}`);
                return {
                    wpay_status: 'success',
                    profile: cachedEntry.profile || undefined,
                    fromCache: true
                };
            }

            throw error;
        }
    }

    /**
     * Force refresh the cache for a specific email
     * Use after transactions that modify balances
     */
    async forceRefresh(email: string): Promise<ProfileResponse> {
        return this.getProfile(email, true);
    }

    /**
     * Invalidate cache for a specific email
     * Useful when you know the data has changed
     */
    invalidate(email: string): void {
        const normalizedEmail = email.toLowerCase().trim();
        this.cache.delete(normalizedEmail);
        console.log(`[WPayCache] Invalidated cache for ${normalizedEmail}`);
    }

    /**
     * Clear all cached data
     */
    clearAll(): void {
        this.cache.clear();
        console.log('[WPayCache] Cleared all cached data');
    }

    /**
     * Get cache stats for debugging
     */
    getStats(): { entries: number; oldestEntry: number | null } {
        let oldest: number | null = null;
        this.cache.forEach(entry => {
            if (oldest === null || entry.fetchedAt < oldest) {
                oldest = entry.fetchedAt;
            }
        });

        return {
            entries: this.cache.size,
            oldestEntry: oldest ? Date.now() - oldest : null
        };
    }
}

// Export singleton instance
export const wpayCache = new WPayCacheService();
