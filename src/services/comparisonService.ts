import type { Product } from '../types';

export const COMPARISON_STORAGE_KEY = 'nerve.comparison';

export const comparisonService = {
  /**
   * Get all comparison items from localStorage
   */
  getItems(): Product[] {
    if (typeof window === 'undefined') return [];

    const stored = localStorage.getItem(COMPARISON_STORAGE_KEY);
    if (!stored) return [];

    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  },

  /**
   * Check if a product is already in comparison
   */
  isInComparison(productId: string): boolean {
    const items = this.getItems();
    return items.some(item => item.id === productId);
  },

  /**
   * Add a product to comparison
   */
  addItem(product: Product): boolean {
    if (typeof window === 'undefined') return false;

    const items = this.getItems();

    // Limit to 4 products
    if (items.length >= 4) {
      return false;
    }

    // Check if already exists
    if (this.isInComparison(product.id)) {
      return false;
    }

    const newItem = [...items, product];
    localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify(newItem));
    return true;
  },

  /**
   * Remove a product from comparison
   */
  removeItem(productId: string): boolean {
    if (typeof window === 'undefined') return false;

    const items = this.getItems();
    const newItem = items.filter(item => item.id !== productId);

    if (newItem.length === items.length) {
      return false;
    }

    localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify(newItem));
    return true;
  },

  /**
   * Clear all items from comparison
   */
  clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(COMPARISON_STORAGE_KEY);
  },

  /**
   * Toggle a product in comparison
   */
  toggleItem(product: Product): boolean {
    if (this.isInComparison(product.id)) {
      return this.removeItem(product.id);
    }
    return this.addItem(product);
  },
};
