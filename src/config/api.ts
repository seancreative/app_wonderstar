// src/config/api.ts
// ============================================
// 🔧 API CONFIGURATION
// ============================================

// Reverting to local/env variable since proxy was removed.
// To test production from localhost, you would need the proxy.
// In production deployment, this will work if the backend allows your domain.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://artventure.test';

export const API_ENDPOINTS = {
    PASSWORD_FORGOT: `${API_BASE_URL}/password/forgot`,
    PASSWORD_RESET: `${API_BASE_URL}/password/reset`,
    PASSWORD_VERIFY_TOKEN: `${API_BASE_URL}/password/verify-token`,
    PASSWORD_SEND_RESET_LINK: `${API_BASE_URL}/password/send-reset-link`,

    // WPay Endpoints
    WPAY_PROCESS: `${API_BASE_URL}/wpay/process`,
    WPAY_PROFILE: `${API_BASE_URL}/wpay/profile`,
    WPAY_TRANSACTION: `${API_BASE_URL}/wpay/transaction`,
    WPAY_TIERS: `${API_BASE_URL}/wpay/tiers`,
} as const;

export default { API_BASE_URL, API_ENDPOINTS };