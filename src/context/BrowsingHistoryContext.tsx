import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Category } from '../types';

interface BrowsingHistoryContextValue {
  viewedProducts: string[]; // product IDs
  categoryWeights: Record<Category | string, number>;
  addView: (productId: string, category?: Category) => void;
  getViewedProducts: () => string[];
}

const BrowsingHistoryContext = createContext<BrowsingHistoryContextValue | null>(null);
const STORAGE_KEY = 'nerve.browsingHistory';
const MAX_HISTORY = 10;

interface StoredHistory {
  products: string[];
  categoryWeights: Record<string, number>;
}

function readHistory(): StoredHistory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { products: [], categoryWeights: {} };
    return JSON.parse(raw);
  } catch {
    return { products: [], categoryWeights: {} };
  }
}

export function BrowsingHistoryProvider({ children }: { children: ReactNode }) {
  const [viewedProducts, setViewedProducts] = useState<string[]>([]);
  const [categoryWeights, setCategoryWeights] = useState<Record<string, number>>({});

  // Load from localStorage on mount
  useEffect(() => {
    const history = readHistory();
    setViewedProducts(history.products);
    setCategoryWeights(history.categoryWeights);
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          products: viewedProducts,
          categoryWeights,
        }),
      );
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, [viewedProducts, categoryWeights]);

  const addView = (productId: string, category?: Category) => {
    setViewedProducts(prev => {
      // Move to front if already exists, else prepend
      const filtered = prev.filter(id => id !== productId);
      const updated = [productId, ...filtered].slice(0, MAX_HISTORY);
      return updated;
    });

    // Update category weights
    if (category) {
      setCategoryWeights(prev => ({
        ...prev,
        [category]: (prev[category] || 0) + 1,
      }));
    }
  };

  const getViewedProducts = () => viewedProducts;

  return (
    <BrowsingHistoryContext.Provider
      value={{
        viewedProducts,
        categoryWeights,
        addView,
        getViewedProducts,
      }}
    >
      {children}
    </BrowsingHistoryContext.Provider>
  );
}

export function useBrowsingHistory() {
  const ctx = useContext(BrowsingHistoryContext);
  if (!ctx) throw new Error('useBrowsingHistory must be used within BrowsingHistoryProvider');
  return ctx;
}
