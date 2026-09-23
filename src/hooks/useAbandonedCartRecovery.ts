import { useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { trackAbandonedCart, clearAbandonedCart } from '../services/abandonedCartService';

/**
 * Tracks potentially abandoned carts (2+ items) in localStorage when the user
 * leaves the page. Recovery emails are handled by the server-side
 * `process-abandoned-carts` Edge Function — no client timers.
 */
export function useAbandonedCartRecovery() {
  const { lines } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (window.location.pathname.startsWith('/checkout')) return;
      if (lines.length >= 2) {
        trackAbandonedCart(user?.id, user?.email || '', user?.phone, lines);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [lines, user?.id, user?.email, user?.phone]);

  useEffect(() => {
    if (lines.length === 0) {
      clearAbandonedCart();
    }
  }, [lines.length]);
}
