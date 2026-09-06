/**
 * Abandoned Cart Recovery Service
 *
 * Tracks abandoned carts and sends recovery emails/SMS
 * Features:
 * - Detect carts with 2+ items left without checkout
 * - Email reminders at 1 hour and 24 hours
 * - SMS reminder for returning customers
 * - Recovery discount codes
 * - Track recovery conversions
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
  firstReminderAt?: number;
  secondReminderAt?: number;
  smsReminderAt?: number;
  recoveredAt?: number;
  cartRecoveryCode?: string;
}

const STORAGE_KEY = 'nerve.abandonedCart';
const ABANDONED_CART_THRESHOLD = 2; // Minimum items to track
const FIRST_REMINDER_DELAY = 60 * 60 * 1000; // 1 hour
const SECOND_REMINDER_DELAY = 24 * 60 * 60 * 1000; // 24 hours
const SMS_REMINDER_DELAY = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Generate unique recovery code for abandoned cart
 */
function generateRecoveryCode(): string {
  return `RECOVER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
}

/**
 * Track cart as potentially abandoned when user leaves
 */
export function trackAbandonedCart(
  userId: string | undefined,
  email: string,
  phone: string | undefined,
  items: CartLine[],
): void {
  // Only track carts with 2 or more items
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
  console.log(`[Abandoned Cart] Tracked cart with ${items.length} items for ${email}`);
}

/**
 * Get currently tracked abandoned cart
 */
export function getAbandonedCart(): AbandonedCart | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as AbandonedCart;
  } catch {
    return null;
  }
}

/**
 * Clear abandoned cart tracking
 */
export function clearAbandonedCart(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Mark cart as recovered
 */
export function markCartAsRecovered(): void {
  const cart = getAbandonedCart();
  if (!cart) return;

  cart.recoveredAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  console.log(`[Abandoned Cart] Cart recovered for ${cart.email}`);
}

/**
 * Send abandoned cart email reminder
 */
async function sendAbandonedCartEmail(
  cart: AbandonedCart,
  type: 'first' | 'second',
): Promise<void> {
  const discountCode = type === 'first' ? 'COMEBACK10' : 'COMEBACK20';
  const discountPercent = type === 'first' ? 10 : 20;
  const savedAmount = Math.round((cart.total * discountPercent) / 100);

  console.log(`[Abandoned Cart Email - ${type}] To: ${cart.email}`);
  console.log(`  Items: ${cart.items.length}`);
  console.log(`  Total: ${cart.total} EGP`);
  console.log(`  Discount: ${discountCode} (${discountPercent}% off, save ${savedAmount} EGP)`);

  // In production: call email service (SendGrid, Mailgun, etc.)
}

/**
 * Send SMS reminder for abandoned cart
 */
async function sendAbandonedCartSMS(cart: AbandonedCart): Promise<void> {
  if (!cart.phone) {
    console.log('[Abandoned Cart SMS] No phone number available');
    return;
  }

  const message = `You have ${cart.items.length} items in your cart! Use COMEBACK20 for 20% off. Shop now: www.nerve.ey`;

  console.log(`[Abandoned Cart SMS] To: ${cart.phone}`);
  console.log(`  Message: ${message}`);

  // In production: integrate with Twilio or local SMS provider
}

/**
 * Check and send recovery emails/SMS (call periodically)
 */
export async function checkAndSendRecoveryReminders(): Promise<void> {
  const cart = getAbandonedCart();
  if (!cart || cart.recoveredAt) {
    return;
  }

  const now = Date.now();
  const cartAge = now - cart.createdAt;

  try {
    // Send first reminder after 1 hour
    if (!cart.firstReminderAt && cartAge > FIRST_REMINDER_DELAY) {
      await sendAbandonedCartEmail(cart, 'first');
      cart.firstReminderAt = now;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    }

    // Send second reminder after 24 hours
    if (!cart.secondReminderAt && cartAge > SECOND_REMINDER_DELAY) {
      await sendAbandonedCartEmail(cart, 'second');
      cart.secondReminderAt = now;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    }

    // Send SMS reminder after 48 hours (if phone available)
    if (!cart.smsReminderAt && cartAge > SMS_REMINDER_DELAY && cart.phone) {
      await sendAbandonedCartSMS(cart);
      cart.smsReminderAt = now;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    }
  } catch (error) {
    console.error('[Abandoned Cart] Error sending reminders:', error);
  }
}

/**
 * Get discount code for abandoned cart recovery
 */
export function getRecoveryDiscountCode(type: 'first' | 'second'): string {
  return type === 'first' ? 'COMEBACK10' : 'COMEBACK20';
}

/**
 * Get discount percentage for recovery
 */
export function getRecoveryDiscountPercent(type: 'first' | 'second'): number {
  return type === 'first' ? 10 : 20;
}

/**
 * Get recovery analytics
 */
export function getRecoveryAnalytics(): {
  hasAbandonedCart: boolean;
  daysSinceAbandonment: number;
  remindersToSend: ('first' | 'second' | 'sms')[];
} {
  const cart = getAbandonedCart();
  if (!cart) {
    return {
      hasAbandonedCart: false,
      daysSinceAbandonment: 0,
      remindersToSend: [],
    };
  }

  const now = Date.now();
  const daysSinceAbandonment = Math.floor((now - cart.createdAt) / (24 * 60 * 60 * 1000));
  const remindersToSend: ('first' | 'second' | 'sms')[] = [];

  if (!cart.firstReminderAt && now - cart.createdAt > FIRST_REMINDER_DELAY) {
    remindersToSend.push('first');
  }
  if (!cart.secondReminderAt && now - cart.createdAt > SECOND_REMINDER_DELAY) {
    remindersToSend.push('second');
  }
  if (!cart.smsReminderAt && now - cart.createdAt > SMS_REMINDER_DELAY && cart.phone) {
    remindersToSend.push('sms');
  }

  return {
    hasAbandonedCart: true,
    daysSinceAbandonment,
    remindersToSend,
  };
}
