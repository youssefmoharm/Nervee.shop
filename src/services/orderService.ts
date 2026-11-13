import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logError } from '../lib/sentry';
import type { CartLine } from '../types';

export interface CheckoutInfo {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  governorate: string;
  postalCode?: string;
  deliveryMethod: 'standard' | 'express';
  paymentMethod: 'cod';
  discountCode?: string;
}

export interface PlaceOrderResult {
  order: {
    id: string;
    order_number: string;
    subtotal: number;
    shipping_cost: number;
    discount_amount: number;
    total: number;
  } | null;
  error: string | null;
  /** Field-level validation messages from the edge function, when present. */
  details?: string[];
}

const ATTEMPT_KEY = 'nerve.checkout-attempt';
let currentAttempt: { key: string; payload: string } | null = null;

function getIdempotencyKey(payload: string): string {
  try {
    const stored = localStorage.getItem(ATTEMPT_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.key === 'string' && parsed.payload === payload) currentAttempt = parsed;
    }
  } catch {
    /* Storage can be unavailable; retain the in-memory attempt. */
  }
  if (!currentAttempt || currentAttempt.payload !== payload) {
    currentAttempt = { key: crypto.randomUUID(), payload };
  }
  try {
    localStorage.setItem(ATTEMPT_KEY, JSON.stringify(currentAttempt));
  } catch {
    /* best effort */
  }
  return currentAttempt.key;
}

export function resetIdempotencyKey() {
  currentAttempt = null;
  try {
    localStorage.removeItem(ATTEMPT_KEY);
  } catch {
    /* best effort */
  }
}

export const orderService = {
  /**
   * Places an order. This calls the `create-order` Supabase Edge Function,
   * which re-validates stock and re-prices every line server-side — nothing
   * about totals or availability is trusted from the client.
   *
   * Uses idempotency key to prevent duplicate orders on retry/double-click.
   * The key is generated once and reused across retries for the same checkout attempt.
   */
  async placeOrder(info: CheckoutInfo, lines: CartLine[]): Promise<PlaceOrderResult> {
    if (!isSupabaseConfigured) {
      return {
        order: null,
        error: 'Checkout is temporarily unavailable. Please try again in a few minutes.',
      };
    }

    if (!lines || lines.length === 0) {
      return { order: null, error: 'Your bag is empty. Add a piece before checking out.' };
    }

    try {
      const idempotencyKey = getIdempotencyKey(JSON.stringify({ info, lines }));

      const { data, error } = await supabase.functions.invoke('create-order', {
        body: {
          ...info,
          idempotencyKey,
          items: lines.map(l => ({
            productId: l.productId,
            color: l.color,
            size: l.size,
            quantity: l.quantity,
            image: l.image,
          })),
        },
      });

      if (error) {
        let body: { error?: unknown; details?: unknown } = data ?? {};
        if (error instanceof FunctionsHttpError) {
          try {
            body = await error.context.json();
          } catch {
            /* use fallback below */
          }
        }
        const bodyError = body?.error;
        const details = Array.isArray(body?.details)
          ? body.details.filter((detail): detail is string => typeof detail === 'string')
          : undefined;
        const message =
          (typeof bodyError === 'string' && bodyError) ||
          error.message ||
          'We could not place your order. Please check your connection and try again.';
        return { order: null, error: message, details };
      }

      if (data?.error) {
        const details = Array.isArray((data as { details?: unknown }).details)
          ? (data as { details: string[] }).details
          : undefined;
        return { order: null, error: data.error, details };
      }

      // Reset idempotency key on success so next order gets a new one
      resetIdempotencyKey();
      return { order: data.order, error: null };
    } catch (err) {
      logError('placeOrder failed:', err);
      return {
        order: null,
        error: 'We could not reach the store. Please check your internet connection and try again.',
      };
    }
  },

  /** Order history for the currently signed-in customer */
  async listMine() {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      logError('Error fetching orders:', error);
      return [];
    }
    return data ?? [];
  },

  async getById(id: string) {
    const { data: order, error } = await supabase.from('orders').select('*').eq('id', id).single();
    if (error) {
      // PGRST116 = zero rows -> genuine "not found". Anything else
      // (network failure, RLS, outage) is transient: throw so callers
      // show a retry UI instead of "Order not found" (AUDIT BUG-13).
      if (error.code === 'PGRST116') return null;
      logError('Error fetching order:', error);
      throw error;
    }
    if (!order) return null;
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id);
    if (itemsError) {
      logError('Error fetching order items:', itemsError);
      throw itemsError;
    }
    const { data: requests, error: requestsError } = await supabase
      .from('order_return_requests')
      .select('id,type,status,return_exchange_shipments(tracking_number,tracking_url)')
      .eq('order_id', id);
    if (requestsError) throw requestsError;
    return { ...order, items: items ?? [], requests: requests ?? [] };
  },
};
