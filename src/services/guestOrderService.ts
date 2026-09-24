import { logError } from '../lib/sentry';
import { SUPABASE_ANON_KEY } from '../lib/supabase';
import { getEndpoint } from '../lib/apiEndpoints';
import type { GuestOrder } from '../types';

export interface GuestOrderLookup {
  email: string;
  orderNumber: string;
  verificationToken?: string;
}

export const guestOrderService = {
  /**
   * Securely lookup a guest order via the verify-guest-order edge function.
   * Never queries guest_orders directly (RLS is deny-all for anon).
   */
  async lookup(email: string, orderNumber: string, verificationToken?: string) {
    try {
      const response = await fetch(getEndpoint('VERIFY_GUEST_ORDER'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          orderNumber: orderNumber.trim().toUpperCase(),
          token: verificationToken || '',
        }),
      });

      const data = await response.json().catch(() => ({} as Record<string, unknown>));

      if (!response.ok) {
        // Generic message — do not reveal whether order exists
        const msg =
          typeof (data as { error?: string }).error === 'string'
            ? (data as { error: string }).error
            : 'Order not found. Please check your email and order number.';
        return { order: null, error: msg };
      }

      const order = (data as { order?: GuestOrder }).order;
      if (!order) return { order: null, error: 'Order not found' };

      return { order: order as GuestOrder, error: null };
    } catch (err) {
      logError('guestOrderService.lookup failed:', err);
      return { order: null, error: 'Network error. Please try again.' };
    }
  },

  /**
   * Deprecated: guest orders are now created server-side via place_order.
   * Kept for backwards compat — logs a warning and returns failure.
   */
  async create(_email: string, _orderNumber: string, _verificationToken: string) {
    void _email;
    void _orderNumber;
    void _verificationToken;
    if (import.meta.env.DEV) {
      console.warn(
        'guestOrderService.create is deprecated — orders are created via the create-order edge function.',
      );
    }
    return { success: false, error: 'Use checkout to create orders.' };
  },

  /**
   * Re-send the tracking/verification link via the resend-guest-verification
   * edge function (rotates the token server-side and emails a fresh link).
   * Generic success response — does not reveal whether the order exists.
   */
  async sendVerificationLink(email: string, orderNumber: string, verificationToken?: string) {
    void verificationToken;
    try {
      const response = await fetch(getEndpoint('RESEND_GUEST_VERIFICATION'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          order_number: orderNumber.trim().toUpperCase(),
          email: email.trim().toLowerCase(),
        }),
      });

      if (!response.ok && response.status !== 429) {
        return { success: false, error: 'Please try again later.' };
      }
      return { success: true, error: null };
    } catch (err) {
      logError('guestOrderService.sendVerificationLink failed:', err);
      return { success: false, error: 'Network error. Please try again.' };
    }
  },
};
