import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Product } from '../types';

interface ComparisonContextValue {
  items: Product[];
  add: (product: Product) => void;
  remove: (productId: string) => void;
  clear: () => void;
  has: (productId: string) => boolean;
  isFull: boolean;
}

const ComparisonContext = createContext<ComparisonContextValue | null>(null);

const STORAGE_KEY = 'nerve.comparison';
const MAX_COMPARISON_ITEMS = 3;

function readComparisonItems(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [productIds, setProductIds] = useState<string[]>(() => readComparisonItems());
  const [products, setProducts] = useState<Product[]>([]);

  // Persist to localStorage whenever productIds change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(productIds));
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, [productIds]);

  // Load products from localStorage or fetch if needed
  // For now, we store the full product objects to avoid needing an API call
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}_full`);
      const allProducts = raw ? (JSON.parse(raw) as Product[]) : [];
      const orderedProducts = productIds
        .map(id => allProducts.find(p => p.id === id))
        .filter((p): p is Product => p !== undefined);
      setProducts(orderedProducts);
    } catch {
      setProducts([]);
    }
  }, [productIds]);

  const add = (product: Product) => {
    setProductIds(prev => {
      if (prev.includes(product.id)) return prev;
      if (prev.length >= MAX_COMPARISON_ITEMS) return prev;
      return [...prev, product.id];
    });

    // Also store the full product objects
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}_full`);
      const allProducts = raw ? (JSON.parse(raw) as Product[]) : [];
      if (!allProducts.find(p => p.id === product.id)) {
        allProducts.push(product);
        localStorage.setItem(`${STORAGE_KEY}_full`, JSON.stringify(allProducts));
      }
    } catch {
      /* storage unavailable — non-fatal */
    }
  };

  const remove = (productId: string) => {
    setProductIds(prev => prev.filter(id => id !== productId));
  };

  const clear = () => {
    setProductIds([]);
    try {
      localStorage.removeItem(`${STORAGE_KEY}_full`);
    } catch {
      /* non-fatal */
    }
  };

  const has = (productId: string) => productIds.includes(productId);

  const isFull = useMemo(() => productIds.length >= MAX_COMPARISON_ITEMS, [productIds]);

  return (
    <ComparisonContext.Provider
      value={{
        items: products,
        add,
        remove,
        clear,
        has,
        isFull,
      }}
    >
      {children}
    </ComparisonContext.Provider>
  );
}

export function useComparison() {
  const ctx = useContext(ComparisonContext);
  if (!ctx) throw new Error('useComparison must be used within ComparisonProvider');
  return ctx;
}
