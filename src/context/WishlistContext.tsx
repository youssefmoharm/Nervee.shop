import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { WishlistItem } from '../types';
import { useAuth } from './AuthContext';
import { wishlistService } from '../services/wishlistService';

interface WishlistContextValue {
  items: WishlistItem[];
  toggle: (item: WishlistItem) => void;
  has: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);
const STORAGE_KEY = 'nerve.wishlist';

function readGuestWishlist(): WishlistItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WishlistItem[]) : [];
  } catch {
    return [];
  }
}

/**
 * Guests: wishlist lives in localStorage only.
 * Signed-in customers: wishlist is mirrored to the `wishlist_items` table so
 * it survives across devices/sessions. The moment someone logs in, whatever
 * was sitting in their guest (localStorage) wishlist is merged into their DB
 * wishlist exactly once, then localStorage is cleared and the DB becomes the
 * source of truth for the rest of the session.
 */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>(() => readGuestWishlist());
  const mergedForUser = useRef<string | null>(null);

  // Persist guest wishlist to localStorage whenever it changes (skipped once
  // a user is signed in — DB is the source of truth then).
  useEffect(() => {
    if (user) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, [items, user]);

  // On sign-in: merge the guest wishlist into the DB wishlist once, then load the
  // authoritative DB wishlist. On sign-out: fall back to (now-empty) guest wishlist.
  useEffect(() => {
    if (!user) {
      mergedForUser.current = null;
      return;
    }
    if (mergedForUser.current === user.id) return;
    mergedForUser.current = user.id;

    const guestItems = readGuestWishlist();

    (async () => {
      try {
        if (guestItems.length > 0) {
          await wishlistService.mergeGuestWishlist(guestItems);
          localStorage.removeItem(STORAGE_KEY);
        }
        const dbItems = await wishlistService.fetchMine();
        setItems(dbItems);
      } catch (error) {
        // Fallback: keep guest wishlist if DB sync fails. Error logged to Sentry
        console.error('Wishlist sync failed:', error);
        setItems(guestItems);
      }
    })();
  }, [user]);

  const toggle = (item: WishlistItem) => {
    const exists = items.some(i => i.productId === item.productId);
    setItems(prev => (exists ? prev.filter(i => i.productId !== item.productId) : [...prev, item]));
    if (user) {
      if (exists) void wishlistService.remove(item.productId);
      else void wishlistService.add(item.productId);
    }
  };

  const has = (productId: string) => items.some(i => i.productId === productId);

  return (
    <WishlistContext.Provider value={{ items, toggle, has }}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
