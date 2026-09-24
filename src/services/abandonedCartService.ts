/**
 * Abandoned Cart Recovery Service
 *
 * Local snapshot (backup/display) + server-side capture via the
 * `record-abandoned-cart` Edge Function. The `process-abandoned-carts`
 * cron (see migration 032) emails customers whose carts sit idle 24h+.
 */

import type { CartLine } from '../types';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from '../lib/supabase';

export interface AbandonedCart {
  id: string;
  userId?: string;
  email: string;
  phone?: string;
  items: CartLine[];
  total: number;
  createdAt: number;
  recoveredAt?: number;
  cartRecoveryCode?: string;
}

const STORAGE_KEY = 'nerve.abandonedCart';
const ABANDONED_CART_THRESHOLD = 2;
const SERVER_DEBOUNCE_KEY = 'nerve.abandonedCart.lastRecord';
const SERVER_DEBOUNCE_MS = 5 * 60 * 1000; // at most one server hit per 5 min

function generateRecoveryCode(): string {
  return `RECOVER-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`.toUpperCase();
}

export function trackAbandonedCart(
  userId: string | undefined,
  email: string,
  phone: string | undefined,
  items: CartLine[],
): void {
  if (items.length < ABANDONED_CART_THRESHOLD) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  const cart: AbandonedCart = {
    id: `cart-${Date.now()}`,
    userId,
    email,
    phone,
    items,
    total: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    createdAt: Date.now(),
    cartRecoveryCode: generateRecoveryCode(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

/**
 * Persist the cart snapshot server-side so the process-abandoned-carts
 * cron can find it. Requires a known email (signed-in user or checkout
 * email already captured in the checkout session). Never throws.
 */
export async function recordServerAbandonedCart(
  email: string,
  items: CartLine[],
  options: { phone?: string; force?: boolean } = {},
): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (!email || !email.includes('@')) return;
  if (items.length < ABANDONED_CART_THRESHOLD) return;

  if (!options.force) {
    try {
      const last = Number(localStorage.getItem(SERVER_DEBOUNCE_KEY) || 0);
      if (Date.now() - last < SERVER_DEBOUNCE_MS) return;
    } catch {
      /* storage unavailable — still attempt the recording */
    }
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/record-abandoned-cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        phone: options.phone,
        items: items.map(i => ({
          productId: i.productId,
          name: i.name,
          color: i.color,
          size: i.size,
          quantity: i.quantity,
          price: i.price,
          image: i.image,
        })),
      }),
      keepalive: true,
    });
    if (response.ok) {
      localStorage.setItem(SERVER_DEBOUNCE_KEY, String(Date.now()));
    }
  } catch {
    // Best-effort — local snapshot remains the fallback.
  }
}

export function clearAbandonedCart(): void {
  localStorage.removeItem(STORAGE_KEY);
}
