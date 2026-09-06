import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Product } from '../types';

interface QuickViewContextValue {
  isOpen: boolean;
  product: Product | null;
  open: (product: Product) => void;
  close: () => void;
}

const QuickViewContext = createContext<QuickViewContextValue | null>(null);

export function QuickViewProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);

  const open = useCallback((prod: Product) => {
    setProduct(prod);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // Delay clearing product to allow animation
    setTimeout(() => setProduct(null), 300);
  }, []);

  return (
    <QuickViewContext.Provider value={{ isOpen, product, open, close }}>
      {children}
    </QuickViewContext.Provider>
  );
}

export function useQuickView() {
  const ctx = useContext(QuickViewContext);
  if (!ctx) throw new Error('useQuickView must be used within QuickViewProvider');
  return ctx;
}
