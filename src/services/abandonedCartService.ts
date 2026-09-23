/**
 * Abandoned Cart Recovery Service
 *
 * Client-side tracking only. Recovery emails/SMS are sent by the server-side
 * `process-abandoned-carts` Edge Function on a schedule (1h / 24h / 48h).
 */

import type { CartLine } from '../types';

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

export function clearAbandonedCart(): void {
  localStorage.removeItem(STORAGE_KEY);
}
