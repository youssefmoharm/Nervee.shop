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

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>(() => readGuestWishlist());
  const mergedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (user) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* non-fatal */
    }
  }, [items, user]);

  useEffect(() => {
    if (!user) {
      mergedForUser.current = null;
      return;
    }
    if (mergedForUser.current === user.id) return;
    mergedForUser.current = user.id;

    const guestItems = readGuestWishlist();

    (async () => {
      if (guestItems.length > 0) {
        await wishlistService.mergeGuestWishlist(guestItems);
        sessionStorage.removeItem(STORAGE_KEY);
      }
      const dbItems = await wishlistService.fetchMine();
      setItems(dbItems);
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
