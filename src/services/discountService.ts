import { logError } from '../lib/sentry';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface DiscountCode {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  discount_amount?: number;
  minimum_purchase: number | null;
  usage_limit: number | null;
  usage_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
}

export interface DiscountResult {
  valid: boolean;
  discount?: DiscountCode;
  error?: string;
}

interface DiscountRow {
  valid: boolean;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  discount_amount?: number;
  minimum_purchase?: number | null;
  message?: string | null;
}

function toDiscount(code: string, row: DiscountRow): DiscountCode {
  return {
    id: '',
    code,
    discount_type: row.discount_type,
    discount_value: row.discount_value,
    discount_amount: row.discount_amount,
    minimum_purchase: row.minimum_purchase ?? null,
    usage_limit: null,
    usage_count: 0,
    valid_from: null,
    valid_until: null,
    is_active: true,
  };
}

export const discountService = {
  /**
   * Validate and apply a discount code via the validate_discount_code RPC.
   */
  async validate(code: string, subtotal: number): Promise<DiscountResult> {
    if (!isSupabaseConfigured) {
      return { valid: false, error: 'Supabase not configured' };
    }

    if (!code || code.trim() === '') {
      return { valid: false, error: 'Please enter a discount code' };
    }

    try {
      const { data, error } = await supabase.rpc('validate_discount_code', {
        p_code: code.toUpperCase().trim(),
        p_subtotal: Math.round(subtotal),
      });

      if (error) {
        logError('discountService.validate rpc failed:', error);
        return { valid: false, error: 'Could not validate the discount code. Please try again.' };
      }

      const row = (Array.isArray(data) ? data[0] : data) as DiscountRow | undefined;
      if (!row || row.valid !== true) {
        return {
          valid: false,
          error: row?.message?.trim() || 'Invalid discount code',
        };
      }

      return { valid: true, discount: toDiscount(code.toUpperCase().trim(), row) };
    } catch (err) {
      logError('discountService.validate failed:', err);
      return { valid: false, error: 'Network error. Please try again.' };
    }
  },

  /**
   * Calculate the discount amount
   */
  calculateDiscount(discount: DiscountCode, subtotal: number): number {
    if (discount.discount_type === 'percentage') {
      return Math.round((subtotal * discount.discount_value) / 100);
    }
    // Fixed discount, never exceed subtotal
    return Math.min(discount.discount_value, subtotal);
  },

  /**
   * Apply the discount code to subtotal and get final amount
   */
  calculateFinalAmount(
    discount: DiscountCode,
    subtotal: number,
  ): {
    discountAmount: number;
    finalAmount: number;
  } {
    const discountAmount = this.calculateDiscount(discount, subtotal);
    const finalAmount = subtotal - discountAmount;
    return { discountAmount, finalAmount };
  },
};
