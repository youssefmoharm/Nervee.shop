import { createContext, useContext, useState, type ReactNode } from 'react';
import type { CartLine } from '../types';

interface BundleContextValue {
  bundleItems: CartLine[];
  addToBundle: (item: CartLine) => void;
  removeFromBundle: (productId: string, color: string, size: string) => void;
  clearBundle: () => void;
  getBundleTotal: () => number;
  getBundleDiscount: () => number;
  getBundleSavings: () => { amount: number; percentage: number };
}

const BundleContext = createContext<BundleContextValue | null>(null);
const BUNDLE_DISCOUNT_PERCENT = 10;

export function BundleProvider({ children }: { children: ReactNode }) {
  const [bundleItems, setBundleItems] = useState<CartLine[]>([]);

  const addToBundle = (item: CartLine) => {
    setBundleItems(prev => {
      const exists = prev.some(
        b => b.productId === item.productId && b.color === item.color && b.size === item.size,
      );
      if (exists) return prev;
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromBundle = (productId: string, color: string, size: string) => {
    setBundleItems(prev =>
      prev.filter(b => !(b.productId === productId && b.color === color && b.size === size)),
    );
  };

  const clearBundle = () => {
    setBundleItems([]);
  };

  const getBundleTotal = () => {
    const regular = bundleItems.reduce((sum, item) => sum + item.price, 0);
    const discount = Math.floor(regular * (BUNDLE_DISCOUNT_PERCENT / 100));
    return Math.round((regular - discount) * 100) / 100;
  };

  const getBundleDiscount = () => {
    const regular = bundleItems.reduce((sum, item) => sum + item.price, 0);
    const discount = Math.floor(regular * (BUNDLE_DISCOUNT_PERCENT / 100));
    return discount;
  };

  const getBundleSavings = () => {
    const regular = bundleItems.reduce((sum, item) => sum + item.price, 0);
    const amount = Math.floor(regular * (BUNDLE_DISCOUNT_PERCENT / 100));
    return {
      amount: Math.round(amount * 100) / 100,
      percentage: BUNDLE_DISCOUNT_PERCENT,
    };
  };

  return (
    <BundleContext.Provider
      value={{
        bundleItems,
        addToBundle,
        removeFromBundle,
        clearBundle,
        getBundleTotal,
        getBundleDiscount,
        getBundleSavings,
      }}
    >
      {children}
    </BundleContext.Provider>
  );
}

export function useBundle() {
  const ctx = useContext(BundleContext);
  if (!ctx) throw new Error('useBundle must be used within BundleProvider');
  return ctx;
}
