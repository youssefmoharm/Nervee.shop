/**
 * Centralized Edge Function endpoint configuration
 * All frontend → Edge Function communication routes are defined here
 * Makes it easy to update endpoints globally without searching codebase
 */

import { SUPABASE_URL } from './supabase';

// Base path for all Edge Functions
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

export const API_ENDPOINTS = {
  // Chat & Support
  CHAT_AI: `${FUNCTIONS_BASE}/chat-ai`,
  CREATE_SUPPORT_TICKET: `${FUNCTIONS_BASE}/create-support-ticket`,

  // Email & Unsubscribe
  SEND_EMAIL: `${FUNCTIONS_BASE}/send-email`,
  HANDLE_UNSUBSCRIBE: `${FUNCTIONS_BASE}/handle-unsubscribe`,

  // Guest Orders
  VERIFY_GUEST_ORDER: `${FUNCTIONS_BASE}/verify-guest-order`,

  // Account & Orders
  REQUEST_RETURN: `${FUNCTIONS_BASE}/request-return`,

  // Payment (if enabled via backend)
  CREATE_PAYMENT: `${FUNCTIONS_BASE}/create-payment`,
};

/**
 * Get endpoint URL with proper error handling
 * Throws if SUPABASE_URL is not configured
 */
export function getEndpoint(key: keyof typeof API_ENDPOINTS): string {
  if (!SUPABASE_URL || SUPABASE_URL.includes('placeholder')) {
    throw new Error(
      `Supabase is not configured. Please set VITE_SUPABASE_URL in your environment variables.`,
    );
  }
  return API_ENDPOINTS[key];
}
