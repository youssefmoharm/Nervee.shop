import type { CartLine } from '../types';
import type { DiscountCode } from '../services/discountService';

/**
 * Checkout Session Manager
 *
 * Persists cart and checkout form state during the checkout process to survive:
 * - Browser tab closing
 * - Browser refresh/crash
 * - Network interruptions
 * - Accidental navigation away
 *
 * Session expires after 24 hours or successful order placement.
 * Uses localStorage + timestamps for durability.
 */

export interface CheckoutFormState {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  city?: string;
  governorate?: string;
  postal?: string;
  postalCode?: string;
  delivery?: 'standard' | 'express';
  paymentMethod?: 'cod' | 'card';
  discountCode?: string;
  notes?: string;
}

export interface CheckoutSession {
  cartLines: CartLine[];
  formState: CheckoutFormState;
  appliedDiscount: {
    code: string;
    discount: DiscountCode;
  } | null;
  checkoutStep: number;
  timestamp: number; // When session was last saved
  expiresAt: number; // Session expiry timestamp
}

const CHECKOUT_SESSION_KEY = 'nerve.checkout-session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Save checkout session to localStorage
 * Preserves cart and form data across browser restarts
 */
export function saveCheckoutSession(session: Partial<CheckoutSession>): void {
  try {
    const existing = loadCheckoutSession();
    const now = Date.now();

    const merged: CheckoutSession = {
      cartLines: session.cartLines ?? existing?.cartLines ?? [],
      formState: session.formState ?? existing?.formState ?? {},
      appliedDiscount: session.appliedDiscount ?? existing?.appliedDiscount ?? null,
      checkoutStep: session.checkoutStep ?? existing?.checkoutStep ?? 1,
      timestamp: now,
      expiresAt: session.expiresAt ?? now + SESSION_DURATION_MS,
    };

    localStorage.setItem(CHECKOUT_SESSION_KEY, JSON.stringify(merged));
  } catch (error) {
    // Storage quota exceeded or localStorage unavailable - non-fatal
    console.error('Failed to save checkout session:', error);
  }
}

/**
 * Load checkout session from localStorage
 * Returns null if session doesn't exist or has expired
 */
export function loadCheckoutSession(): CheckoutSession | null {
  try {
    const stored = localStorage.getItem(CHECKOUT_SESSION_KEY);
    if (!stored) return null;

    const session: CheckoutSession = JSON.parse(stored);

    // Check if session has expired
    if (Date.now() > session.expiresAt) {
      clearCheckoutSession();
      return null;
    }

    return session;
  } catch (error) {
    // Corrupted data - clear it
    console.error('Failed to load checkout session:', error);
    clearCheckoutSession();
    return null;
  }
}

/**
 * Clear checkout session from localStorage
 * Call after successful order placement or manual checkout reset
 */
export function clearCheckoutSession(): void {
  try {
    localStorage.removeItem(CHECKOUT_SESSION_KEY);
  } catch {
    // Non-fatal
  }
}

/**
 * Check if there's a valid checkout session available
 */
export function hasValidCheckoutSession(): boolean {
  const session = loadCheckoutSession();
  return session !== null && session.cartLines.length > 0;
}

/**
 * Get session age in minutes
 */
export function getCheckoutSessionAge(): number {
  const session = loadCheckoutSession();
  if (!session) return -1;
  return Math.floor((Date.now() - session.timestamp) / (60 * 1000));
}

/**
 * Update specific checkout session field without losing other data
 */
export function updateCheckoutSession<
  K extends keyof Omit<CheckoutSession, 'timestamp' | 'expiresAt'>,
>(key: K, value: CheckoutSession[K]): void {
  const session = loadCheckoutSession();
  if (!session) {
    saveCheckoutSession({ [key]: value });
    return;
  }

  session[key] = value;
  saveCheckoutSession(session);
}
