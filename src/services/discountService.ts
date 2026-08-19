import { logError } from '../lib/sentry';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface DiscountCode {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
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

export const discountService = {
  /**
   * Validate and apply a discount code
   */
  async validate(code: string, subtotal: number): Promise<DiscountResult> {
    if (!isSupabaseConfigured) {
      return { valid: false, error: 'Supabase not configured' };
    }

    if (!code || code.trim() === '') {
      return { valid: false, error: 'Please enter a discount code' };
    }

    try {
      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('code', code.toUpperCase().trim())
        .single();

      if (error || !data) {
        return { valid: false, error: 'Invalid discount code' };
      }

      const discount = data as DiscountCode;

      // Check if code is active
      if (!discount.is_active) {
        return { valid: false, error: 'This discount code is no longer active' };
      }

      // Check if minimum purchase is met
      if (discount.minimum_purchase && subtotal < discount.minimum_purchase) {
        return {
          valid: false,
          error: `Minimum purchase of ${discount.minimum_purchase / 100} EGP required`,
        };
      }

      // Check if code has expired
      if (discount.valid_until && new Date(discount.valid_until) < new Date()) {
        return { valid: false, error: 'This discount code has expired' };
      }

      // Check if code has usage limit and limit reached
      if (discount.usage_limit && discount.usage_count >= discount.usage_limit) {
        return { valid: false, error: 'This discount code has been used too many times' };
      }

      return { valid: true, discount };
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
      return (subtotal * discount.discount_value) / 100;
    }
    // Fixed discount
    return discount.discount_value;
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
