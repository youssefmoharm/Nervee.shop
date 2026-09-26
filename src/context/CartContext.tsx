import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { CartLine } from '../types';
import { useAuth } from './AuthContext';
import { cartService } from '../services/cartService';
import { saveCheckoutSession, clearCheckoutSession } from '../lib/checkoutSessionManager';
import { ecommerce } from '../lib/analytics';
import { useToast } from './ToastContext';
import { useI18n } from '../lib/i18n';

interface CartContextValue {
  lines: CartLine[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addLine: (line: CartLine) => void;
  removeLine: (productId: string, color: string, size: string) => void;
  updateQuantity: (productId: string, color: string, size: string, quantity: number) => void;
  clear: () => void;
  restoreLines: (lines: CartLine[]) => void;
  subtotal: number;
  count: number;
  lastAdded: CartLine | null;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'nerve.cart';

function readGuestCart(): CartLine[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

/**
 * Guests: cart lives in sessionStorage only.
 * Signed-in customers: cart is mirrored to the `carts`/`cart_items` tables so
 * it survives across devices/sessions. The moment someone logs in, whatever
 * was sitting in their guest (sessionStorage) cart is merged into their DB
 * cart exactly once, then sessionStorage is cleared and the DB becomes the
 * source of truth for the rest of the session.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useI18n();
  const [lines, setLines] = useState<CartLine[]>(() => readGuestCart());
  const [isOpen, setIsOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<CartLine | null>(null);
  const mergedForUser = useRef<string | null>(null);
  const pendingOperations = useRef<Set<string>>(new Set());

  // Persist guest cart to sessionStorage whenever it changes (skipped once
  // a user is signed in — DB is the source of truth then).
  useEffect(() => {
    if (user) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
      // Also backup to localStorage for checkout session persistence
      if (lines.length > 0) {
        saveCheckoutSession({ cartLines: lines });
      }
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, [lines, user]);

  // Persist cart to checkout session for all users (guest and logged in)
  // This ensures checkout session is always up-to-date
  useEffect(() => {
    if (lines.length > 0) {
      saveCheckoutSession({ cartLines: lines });
    }
  }, [lines]);

  // On sign-in: merge the guest cart into the DB cart once, then load the
  // authoritative DB cart. On sign-out: drop the previous user's cart so the
  // next person on a shared device inherits nothing (FLOW-05).
  useEffect(() => {
    if (!user) {
      if (mergedForUser.current) {
        mergedForUser.current = null;
        pendingOperations.current.clear();
        setLines([]);
        setLastAdded(null);
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          /* storage unavailable — non-fatal */
        }
        // Also wipes saved checkout form data (email/address) + discount.
        clearCheckoutSession();
      }
      mergedForUser.current = null;
      return;
    }
    if (mergedForUser.current === user.id) return;
    const currentUserId = user.id;
    mergedForUser.current = currentUserId;

    const guestLines = readGuestCart();

    (async () => {
      try {
        if (guestLines.length > 0) {
          await cartService.mergeGuestCart(guestLines);
          sessionStorage.removeItem(STORAGE_KEY);
        }
        // Only update state if this user is still the current user
        if (mergedForUser.current === currentUserId) {
          const dbLines = await cartService.fetchMine();
          setLines(dbLines);
        }
      } catch (error) {
        // Fallback: keep guest cart if DB sync fails. Error logged to Sentry
        console.error('Cart sync failed:', error);
        if (mergedForUser.current === currentUserId) {
          setLines(guestLines);
        }
      }
    })();
  }, [user]);

  const addLine = (line: CartLine) => {
    const key = `${line.productId}-${line.color}-${line.size}`;
    if (pendingOperations.current.has(key)) return;

    pendingOperations.current.add(key);

    // Clamp like updateQuantity: max 10 per item to match the edge
    // validation, so a bulk add can't push a line past the limit (AUDIT FLOW-04).
    const quantity = Math.max(1, Math.min(10, line.quantity));
    const clampedLine: CartLine = { ...line, quantity };

    setLines(prev => {
      const idx = prev.findIndex(
        l => l.productId === line.productId && l.color === line.color && l.size === line.size,
      );
      if (idx > -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: Math.min(10, next[idx].quantity + quantity) };
        return next;
      }
      return [...prev, clampedLine];
    });
    setLastAdded(clampedLine);
    setIsOpen(true);
    ecommerce.addToCart(
      clampedLine.productId,
      clampedLine.name,
      clampedLine.price,
      clampedLine.quantity,
    );
    if (user) {
      void cartService
        .upsertLine(clampedLine)
        .catch(err => {
          console.error('Cart DB sync failed after addLine:', err);
        })
        .finally(() => {
          pendingOperations.current.delete(key);
        });
    } else {
      pendingOperations.current.delete(key);
    }
  };

  const removeLine = (productId: string, color: string, size: string) => {
    const removed = lines.find(
      l => l.productId === productId && l.color === color && l.size === size,
    );
    setLines(prev =>
      prev.filter(l => !(l.productId === productId && l.color === color && l.size === size)),
    );
    if (removed) {
      ecommerce.removeFromCart(removed.productId, removed.name, removed.price, removed.quantity);
    }
    if (user) {
      void cartService.removeLine(productId, color, size).catch(err => {
        // Revert the optimistic update on error
        const removedLine = lines.find(
          l => l.productId === productId && l.color === color && l.size === size,
        );
        if (removedLine) {
          setLines(prev => [...prev, removedLine]);
        }
        showToast(t('Failed to remove item. Please try again.'), 'error');
        console.error('Cart DB sync failed after removeLine:', err);
      });
    }
  };

  const updateQuantity = (productId: string, color: string, size: string, quantity: number) => {
    // Cap at 10 to match edge validation (max quantity per item is 10).
    const safeQuantity = Math.max(1, Math.min(10, quantity));
    const prevLines = lines;

    setLines(prev =>
      prev.map(l =>
        l.productId === productId && l.color === color && l.size === size
          ? { ...l, quantity: safeQuantity }
          : l,
      ),
    );

    if (user) {
      void cartService.updateQuantity(productId, color, size, safeQuantity).catch(err => {
        // Revert the optimistic update on error
        setLines(prevLines);
        showToast(t('Failed to update quantity. Please try again.'), 'error');
        console.error('Cart DB sync failed after updateQuantity:', err);
      });
    }
  };

  const clear = () => {
    setLines([]);
    clearCheckoutSession();
    if (user) {
      void cartService.clear().catch(err => {
        console.error('Cart DB sync failed after clear:', err);
      });
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  /**
   * FLOW-06: restore cart lines saved by the checkout session (guest carts
   * live in sessionStorage, which dies when the tab closes). Validates each
   * line, clamps quantities like addLine, and never overwrites a non-empty cart.
   */
  const restoreLines = (incoming: CartLine[]) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;

    const valid: CartLine[] = [];
    for (const raw of incoming) {
      if (
        !raw ||
        typeof raw.productId !== 'string' ||
        typeof raw.name !== 'string' ||
        typeof raw.price !== 'number' ||
        !Number.isFinite(raw.price) ||
        typeof raw.quantity !== 'number' ||
        !Number.isFinite(raw.quantity)
      ) {
        continue;
      }
      const quantity = Math.max(1, Math.min(10, Math.floor(raw.quantity)));
      const existing = valid.find(
        l => l.productId === raw.productId && l.color === raw.color && l.size === raw.size,
      );
      if (existing) {
        existing.quantity = Math.min(10, existing.quantity + quantity);
      } else {
        valid.push({ ...raw, quantity });
      }
    }
    if (valid.length === 0) return;

    if (user) {
      // Signed in: the DB cart is authoritative — merge, then reload it.
      void cartService
        .mergeGuestCart(valid)
        .then(() => cartService.fetchMine())
        .then(setLines)
        .catch(err => console.error('Cart restore sync failed:', err));
      return;
    }
    setLines(prev => (prev.length === 0 ? valid : prev));
  };

  const subtotal = useMemo(
    () => Math.round(lines.reduce((sum, l) => sum + l.price * l.quantity, 0) * 100) / 100,
    [lines],
  );
  const count = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines]);

  return (
    <CartContext.Provider
      value={{
        lines,
        isOpen,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
        addLine,
        removeLine,
        updateQuantity,
        clear,
        restoreLines,
        subtotal,
        count,
        lastAdded,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
