import { useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import {
  trackAbandonedCart,
  checkAndSendRecoveryReminders,
} from '../services/abandonedCartService';

/**
 * Hook to track abandoned carts and send recovery reminders
 *
 * Features:
 * - Tracks carts with 2+ items when user navigates away
 * - Periodically checks and sends recovery emails/SMS
 * - Handles recovery from query params
 */
export function useAbandonedCartRecovery() {
  const { lines } = useCart();
  const { user } = useAuth();
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track abandoned cart on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (lines.length >= 2) {
        trackAbandonedCart(user?.id, user?.email || '', user?.phone, lines);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [lines, user?.id, user?.email, user?.phone]);

  // Check for recovery reminders periodically
  useEffect(() => {
    // Initial check
    checkAndSendRecoveryReminders().catch(error => {
      console.error('Error checking recovery reminders:', error);
    });

    // Set up interval to check every 5 minutes
    checkIntervalRef.current = setInterval(() => {
      checkAndSendRecoveryReminders().catch(error => {
        console.error('Error checking recovery reminders:', error);
      });
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);
}
