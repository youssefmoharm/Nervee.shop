import { describe, it, expect } from 'vitest';

// Business logic functions to test
export function calculateSubtotal(items: Array<{ price: number; quantity: number }>): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function calculateShipping(subtotal: number, method: 'standard' | 'express'): number {
  if (method === 'express') return 200;
  if (subtotal > 2000) return 0; // Free shipping over EGP 2000
  return 100;
}

export function calculateDiscount(
  subtotal: number,
  discountType: 'percentage' | 'fixed',
  discountValue: number,
): number {
  if (discountType === 'percentage') {
    return Math.round((subtotal * discountValue) / 100);
  }
  return Math.min(discountValue, subtotal);
}

export function calculateTotal(subtotal: number, shipping: number, discount: number): number {
  return Math.max(subtotal + shipping - discount, 0);
}

export function validateQuantity(quantity: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(quantity)) {
    return { valid: false, error: 'Quantity must be a whole number' };
  }
  if (quantity < 1) {
    return { valid: false, error: 'Quantity must be at least 1' };
  }
  if (quantity > 10) {
    return { valid: false, error: 'Maximum quantity per item is 10' };
  }
  return { valid: true };
}

export function validateOrderStatus(
  currentStatus: string,
  newStatus: string,
): { valid: boolean; error?: string } {
  const validStatuses = ['placed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

  if (!validStatuses.includes(newStatus)) {
    return { valid: false, error: 'Invalid order status' };
  }

  // Define allowed transitions
  const allowedTransitions: Record<string, string[]> = {
    placed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered', 'cancelled'],
    delivered: ['refunded'],
    cancelled: [], // Final state
    refunded: [], // Final state
  };

  const allowed = allowedTransitions[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    return { valid: false, error: `Cannot transition from ${currentStatus} to ${newStatus}` };
  }

  return { valid: true };
}

describe('Business Logic Calculations', () => {
  describe('calculateSubtotal', () => {
    it('calculates subtotal for single item', () => {
      const items = [{ price: 500, quantity: 2 }];
      expect(calculateSubtotal(items)).toBe(1000);
    });

    it('calculates subtotal for multiple items', () => {
      const items = [
        { price: 500, quantity: 2 },
        { price: 300, quantity: 1 },
        { price: 200, quantity: 3 },
      ];
      expect(calculateSubtotal(items)).toBe(1900);
    });

    it('handles empty cart', () => {
      expect(calculateSubtotal([])).toBe(0);
    });

    it('handles zero quantity', () => {
      const items = [{ price: 500, quantity: 0 }];
      expect(calculateSubtotal(items)).toBe(0);
    });

    it('handles zero price', () => {
      const items = [{ price: 0, quantity: 5 }];
      expect(calculateSubtotal(items)).toBe(0);
    });
  });

  describe('calculateShipping', () => {
    it('applies express shipping cost', () => {
      expect(calculateShipping(1000, 'express')).toBe(200);
    });

    it('applies standard shipping cost', () => {
      expect(calculateShipping(1000, 'standard')).toBe(100);
    });

    it('applies free shipping for orders over 2000', () => {
      expect(calculateShipping(2500, 'standard')).toBe(0);
    });

    it('charges shipping at exact threshold (free only over 2000)', () => {
      expect(calculateShipping(2000, 'standard')).toBe(100);
    });

    it('charges shipping below threshold', () => {
      expect(calculateShipping(1999, 'standard')).toBe(100);
    });

    it('charges express even with free standard shipping', () => {
      expect(calculateShipping(2500, 'express')).toBe(200);
    });
  });

  describe('calculateDiscount', () => {
    it('calculates percentage discount', () => {
      expect(calculateDiscount(1000, 'percentage', 15)).toBe(150);
    });

    it('calculates fixed discount', () => {
      expect(calculateDiscount(1000, 'fixed', 200)).toBe(200);
    });

    it('caps fixed discount at subtotal', () => {
      expect(calculateDiscount(1000, 'fixed', 1500)).toBe(1000);
    });

    it('handles zero discount', () => {
      expect(calculateDiscount(1000, 'percentage', 0)).toBe(0);
      expect(calculateDiscount(1000, 'fixed', 0)).toBe(0);
    });

    it('handles 100% discount', () => {
      expect(calculateDiscount(1000, 'percentage', 100)).toBe(1000);
    });

    it('rounds percentage discount', () => {
      expect(calculateDiscount(333, 'percentage', 15)).toBe(50); // 49.95 rounded to 50
    });
  });

  describe('calculateTotal', () => {
    it('calculates total with all components', () => {
      expect(calculateTotal(1000, 100, 150)).toBe(950);
    });

    it('ensures minimum total of zero', () => {
      expect(calculateTotal(100, 50, 200)).toBe(0);
    });

    it('handles zero values', () => {
      expect(calculateTotal(0, 0, 0)).toBe(0);
    });

    it('handles no discount', () => {
      expect(calculateTotal(1000, 100, 0)).toBe(1100);
    });

    it('handles free shipping', () => {
      expect(calculateTotal(1000, 0, 100)).toBe(900);
    });
  });

  describe('validateQuantity', () => {
    it('accepts valid quantities', () => {
      expect(validateQuantity(1)).toEqual({ valid: true });
      expect(validateQuantity(5)).toEqual({ valid: true });
      expect(validateQuantity(10)).toEqual({ valid: true });
    });

    it('rejects zero quantity', () => {
      expect(validateQuantity(0)).toEqual({
        valid: false,
        error: 'Quantity must be at least 1',
      });
    });

    it('rejects negative quantity', () => {
      expect(validateQuantity(-1)).toEqual({
        valid: false,
        error: 'Quantity must be at least 1',
      });
    });

    it('rejects quantity over maximum', () => {
      expect(validateQuantity(11)).toEqual({
        valid: false,
        error: 'Maximum quantity per item is 10',
      });
    });

    it('rejects non-integer quantity', () => {
      expect(validateQuantity(1.5)).toEqual({
        valid: false,
        error: 'Quantity must be a whole number',
      });
    });
  });

  describe('validateOrderStatus', () => {
    it('allows valid transitions', () => {
      expect(validateOrderStatus('placed', 'processing')).toEqual({ valid: true });
      expect(validateOrderStatus('processing', 'shipped')).toEqual({ valid: true });
      expect(validateOrderStatus('shipped', 'delivered')).toEqual({ valid: true });
    });

    it('allows cancellation from non-final states', () => {
      expect(validateOrderStatus('placed', 'cancelled')).toEqual({ valid: true });
      expect(validateOrderStatus('processing', 'cancelled')).toEqual({ valid: true });
      expect(validateOrderStatus('shipped', 'cancelled')).toEqual({ valid: true });
    });

    it('allows refund from delivered state', () => {
      expect(validateOrderStatus('delivered', 'refunded')).toEqual({ valid: true });
    });

    it('rejects invalid transitions', () => {
      expect(validateOrderStatus('placed', 'shipped')).toEqual({
        valid: false,
        error: 'Cannot transition from placed to shipped',
      });
    });

    it('rejects transitions from final states', () => {
      expect(validateOrderStatus('cancelled', 'processing')).toEqual({
        valid: false,
        error: 'Cannot transition from cancelled to processing',
      });
    });

    it('rejects invalid status values', () => {
      expect(validateOrderStatus('placed', 'invalid')).toEqual({
        valid: false,
        error: 'Invalid order status',
      });
    });
  });
});
