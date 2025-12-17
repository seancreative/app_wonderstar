/**
 * API Configuration
 * Centralized configuration for API endpoints
 */

// Backend API Base URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://app.aigenius.com.my';

// API Endpoints
export const API_ENDPOINTS = {
    // Password Reset
    PASSWORD_FORGOT: `${API_BASE_URL}/password/forgot`,
    PASSWORD_RESET: `${API_BASE_URL}/password/reset`,
    PASSWORD_VERIFY_TOKEN: `${API_BASE_URL}/password/verify-token`,
    PASSWORD_SEND_RESET_LINK: `${API_BASE_URL}/password/send-reset-link`,

    // WPay Endpoints
    WPAY_PROCESS: `${API_BASE_URL}/wpay/process`,
    WPAY_PROFILE: `${API_BASE_URL}/wpay/profile`,
    WPAY_TRANSACTION: `${API_BASE_URL}/wpay/transaction`,
    WPAY_COMPLETE: `${API_BASE_URL}/wpay/complete`,
    WPAY_TIERS: `${API_BASE_URL}/wpay/tiers`,
} as const;

export default {
    API_BASE_URL,
    API_ENDPOINTS,
};