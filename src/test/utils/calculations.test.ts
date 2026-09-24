import { describe, it, expect } from 'vitest';
import {
  validateEgyptianPhone,
  validateEgyptianPostalCode,
  validateGovernorate,
  validateCity,
  validateAddress,
} from '../../lib/egyptianValidation';
import { estimateShippingCost, getCheckoutSummary, EGYPT_VAT_RATE } from '../../lib/checkout';
import { discountService } from '../../services/discountService';
import {
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_COST,
  EXPRESS_SHIPPING_COST,
} from '../../lib/storeConfig';

describe('Shipping (single source: lib/checkout + storeConfig)', () => {
  it('applies express shipping cost', () => {
    expect(estimateShippingCost(1000, 'express')).toBe(EXPRESS_SHIPPING_COST);
  });

  it('applies standard shipping cost below threshold', () => {
    expect(estimateShippingCost(1000, 'standard')).toBe(STANDARD_SHIPPING_COST);
  });

  it('gives free standard shipping at/above the free-shipping threshold', () => {
    expect(estimateShippingCost(FREE_SHIPPING_THRESHOLD, 'standard')).toBe(0);
    expect(estimateShippingCost(FREE_SHIPPING_THRESHOLD + 500, 'standard')).toBe(0);
  });

  it('charges shipping below the threshold', () => {
    expect(estimateShippingCost(FREE_SHIPPING_THRESHOLD - 1, 'standard')).toBe(
      STANDARD_SHIPPING_COST,
    );
  });

  it('charges express even when standard would be free', () => {
    expect(estimateShippingCost(FREE_SHIPPING_THRESHOLD + 500, 'express')).toBe(
      EXPRESS_SHIPPING_COST,
    );
  });

  it('free shipping for empty cart', () => {
    expect(estimateShippingCost(0, 'standard')).toBe(0);
  });
});

describe('Checkout summary (single source: lib/checkout)', () => {
  it('computes total with shipping and no discount', () => {
    const s = getCheckoutSummary(1000, 'standard');
    expect(s.shipping).toBe(STANDARD_SHIPPING_COST);
    expect(s.total).toBe(1000 + STANDARD_SHIPPING_COST);
  });

  it('subtracts discount from total', () => {
    const s = getCheckoutSummary(1000, 'standard', 150);
    expect(s.total).toBe(1000 + STANDARD_SHIPPING_COST - 150);
  });

  it('never goes below zero', () => {
    const s = getCheckoutSummary(100, 'standard', 5000);
    expect(s.total).toBe(0);
  });

  it('VAT is inclusive of the 14% rate', () => {
    const s = getCheckoutSummary(1140, 'standard');
    expect(s.vatAmount).toBe(Math.round((1140 * EGYPT_VAT_RATE) / (1 + EGYPT_VAT_RATE)));
    expect(EGYPT_VAT_RATE).toBe(0.14);
  });
});

describe('Discount calculation (single source: discountService)', () => {
  it('calculates percentage discount', () => {
    expect(
      discountService.calculateDiscount(
        {
          id: '',
          code: 'X',
          discount_type: 'percentage',
          discount_value: 15,
          minimum_purchase: null,
          usage_limit: null,
          usage_count: 0,
          valid_from: null,
          valid_until: null,
          is_active: true,
        },
        1000,
      ),
    ).toBe(150);
  });

  it('caps fixed discount at subtotal', () => {
    expect(
      discountService.calculateDiscount(
        {
          id: '',
          code: 'X',
          discount_type: 'fixed',
          discount_value: 1500,
          minimum_purchase: null,
          usage_limit: null,
          usage_count: 0,
          valid_from: null,
          valid_until: null,
          is_active: true,
        },
        1000,
      ),
    ).toBe(1000);
  });
});

describe('Egyptian validators (single source: egyptianValidation)', () => {
  it('accepts valid Egyptian mobile numbers', () => {
    expect(validateEgyptianPhone('01012345678').valid).toBe(true);
    expect(validateEgyptianPhone('+201012345678').valid).toBe(true);
    expect(validateEgyptianPhone('00201012345678').valid).toBe(true);
    expect(validateEgyptianPhone('201012345678').valid).toBe(true);
  });

  it('rejects non-Egyptian or short numbers', () => {
    expect(validateEgyptianPhone('1234567890').valid).toBe(false);
    expect(validateEgyptianPhone('+1-234-567-8900').valid).toBe(false);
    expect(validateEgyptianPhone('').valid).toBe(false);
    expect(validateEgyptianPhone('0101234567').valid).toBe(false);
  });

  it('accepts optional valid postal codes', () => {
    expect(validateEgyptianPostalCode('').valid).toBe(true);
    expect(validateEgyptianPostalCode('12345').valid).toBe(true);
    expect(validateEgyptianPostalCode('abc').valid).toBe(false);
  });

  it('validates governorates against the canonical list', () => {
    expect(validateGovernorate('Cairo').valid).toBe(true);
    expect(validateGovernorate('Atlantis').valid).toBe(false);
  });

  it('validates city and address length rules', () => {
    expect(validateCity('Alexandria').valid).toBe(true);
    expect(validateCity('A').valid).toBe(false);
    expect(validateAddress('12 Main Street, Downtown').valid).toBe(true);
    expect(validateAddress('short').valid).toBe(false);
    expect(validateAddress('visit https://evil.example').valid).toBe(false);
  });
});
