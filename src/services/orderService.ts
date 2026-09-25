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

let currentIdempotencyKey: string | null = null;

function getIdempotencyKey(): string {
  if (!currentIdempotencyKey) {
    currentIdempotencyKey = crypto.randomUUID();
  }
  return currentIdempotencyKey;
}

export function resetIdempotencyKey() {
  currentIdempotencyKey = null;
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
      const idempotencyKey = getIdempotencyKey();

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
        const bodyError =
          typeof data === 'object' && data && 'error' in data
            ? (data as Record<string, unknown>).error
            : null;
        const details =
          typeof data === 'object' && data && Array.isArray((data as { details?: unknown }).details)
            ? (data as { details: string[] }).details
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
    if (error || !order) return null;
    const { data: items } = await supabase.from('order_items').select('*').eq('order_id', id);
    return { ...order, items: items ?? [] };
  },
};
