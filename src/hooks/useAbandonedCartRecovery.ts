import { useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import {
  trackAbandonedCart,
  clearAbandonedCart,
  recordServerAbandonedCart,
} from '../services/abandonedCartService';
import { loadCheckoutSession } from '../lib/checkoutSessionManager';

/**
 * Tracks potentially abandoned carts (2+ items):
 * - local snapshot on page leave (backup)
 * - server-side capture via `record-abandoned-cart` so the
 *   `process_abandoned_carts` cron can email the customer.
 *
 * Email sources: signed-in user, or the checkout session form state
 * (guests who started checkout but never finished).
 */
export function useAbandonedCartRecovery() {
  const { lines } = useCart();
  const { user } = useAuth();
  const location = useLocation();
  const recordedRef = useRef(false);

  const resolveEmail = () => {
    if (user?.email) return user.email;
    return loadCheckoutSession()?.formState?.email || '';
  };

  // Debounced server capture whenever the cart changes (not on checkout page).
  useEffect(() => {
    if (lines.length < 2) {
      recordedRef.current = false;
      return;
    }
    if (location.pathname.startsWith('/checkout')) return;

    const email = resolveEmail();
    if (!email) return;

    const timer = window.setTimeout(() => {
      if (recordedRef.current) return;
      recordedRef.current = true;
      void recordServerAbandonedCart(email, lines, { phone: user?.phone ?? undefined });
    }, 15_000);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, user?.email, user?.phone, location.pathname]);

  // On page leave: keepalive server hit + local snapshot.
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (window.location.pathname.startsWith('/checkout')) return;
      if (lines.length < 2) return;
      const email = resolveEmail();
      if (!email) return;
      trackAbandonedCart(user?.id, email, user?.phone, lines);
      void recordServerAbandonedCart(email, lines, {
        phone: user?.phone ?? undefined,
        force: true,
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, user?.id, user?.email, user?.phone]);

  useEffect(() => {
    if (lines.length === 0) {
      clearAbandonedCart();
    }
  }, [lines.length]);
}
