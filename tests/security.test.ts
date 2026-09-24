/**
 * Security-focused unit tests for client-side validation helpers.
 *
 * Scope note: server-side controls (Postgres RLS policies, edge-function
 * rate limiting, HMAC verification) run inside Supabase (Deno/Postgres) and
 * cannot execute in this vitest/jsdom environment. They are exercised against
 * the real backend by the @live Playwright specs:
 *   - tests/e2e/live-smoke.spec.ts
 *   - tests/e2e/security-idor.spec.ts
 * (nightly live-smoke.yml workflow, PLAYWRIGHT_LIVE=1).
 *
 * `supabase/functions/_shared/validation.ts` is Deno-first and is not
 * importable from vitest either — its rules are mirrored here only insofar as
 * the browser bundle actually uses the client-side validators below.
 */

import { http, HttpResponse } from 'msw';
import { server } from '../src/test/setup';
import {
  validateEgyptianPhone,
  validateAddress,
  validateGovernorate,
  validateEgyptianPostalCode,
} from '../src/lib/egyptianValidation';
import { getCheckoutSummary } from '../src/lib/checkout';
import {
  calculatePasswordStrength,
  validatePasswordRequirements,
} from '../src/lib/passwordValidation';
import { orderService } from '../src/services/orderService';
import { isSupabaseConfigured } from '../src/lib/supabase';

describe('Egyptian phone validation', () => {
  it('accepts Egyptian mobile prefixes (010/011/012/015/016)', () => {
    for (const phone of [
      '01012345678',
      '01112345678',
      '01212345678',
      '01512345678',
      '01612345678',
    ]) {
      expect(validateEgyptianPhone(phone)).toMatchObject({ valid: true });
    }
  });

  it('normalizes +20 / 20 country codes to the local 01… format', () => {
    expect(validateEgyptianPhone('+20 101 2345 678')).toEqual({
      valid: true,
      normalized: '01012345678',
    });
    expect(validateEgyptianPhone('201012345678')).toEqual({
      valid: true,
      normalized: '01012345678',
    });
  });

  it('rejects numbers that are not 11 digits or do not start with 01', () => {
    expect(validateEgyptianPhone('12345').valid).toBe(false);
    expect(validateEgyptianPhone('12345678901').valid).toBe(false); // does not start 01
    expect(validateEgyptianPhone('02123456789').valid).toBe(false); // 02… landline prefix
    expect(validateEgyptianPhone('').valid).toBe(false);
  });
});

describe('shipping address validation', () => {
  it('rejects URLs, emails and numeric-only strings', () => {
    expect(validateAddress('https://evil.example.com/path').valid).toBe(false);
    expect(validateAddress('someone@example.com').valid).toBe(false);
    expect(validateAddress('1234567890').valid).toBe(false);
  });

  it('enforces the 10–200 character length bounds', () => {
    expect(validateAddress('short').valid).toBe(false);
    expect(validateAddress('A'.repeat(201)).valid).toBe(false);
    expect(validateAddress('123 Nile Corniche, Alexandria').valid).toBe(true);
  });

  it('accepts Arabic address text', () => {
    expect(validateAddress('شارع النيل، الإسكندرية').valid).toBe(true);
  });
});

describe('governorate validation', () => {
  it('accepts governorates from the allowed list', () => {
    expect(validateGovernorate('Cairo')).toMatchObject({ valid: true, normalized: 'Cairo' });
    expect(validateGovernorate('Alexandria').valid).toBe(true);
  });

  it('rejects anything outside the list', () => {
    const result = validateGovernorate('Atlantis');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/valid Egyptian governorate/i);
  });
});

describe('postal code validation (optional field)', () => {
  it('treats an empty value as valid', () => {
    expect(validateEgyptianPostalCode('').valid).toBe(true);
  });

  it('requires 4–5 digits when provided', () => {
    expect(validateEgyptianPostalCode('12345').valid).toBe(true);
    expect(validateEgyptianPostalCode('abcde').valid).toBe(false);
    expect(validateEgyptianPostalCode('123456').valid).toBe(false);
  });
});

describe('checkout totals never go negative', () => {
  it('clamps total to 0 when the discount exceeds subtotal + shipping', () => {
    expect(getCheckoutSummary(500, 'standard', 99_999).total).toBe(0);
    expect(getCheckoutSummary(500, 'express', 99_999).total).toBe(0);
  });

  it('applies shipping and discount normally when the discount is smaller', () => {
    const summary = getCheckoutSummary(1000, 'standard', 150);
    expect(summary.shipping).toBe(100);
    expect(summary.total).toBe(950);
  });
});

describe('password strength validation', () => {
  it('flags every requirement for a compliant password', () => {
    const reqs = validatePasswordRequirements('Str0ng!Pass');
    expect(reqs).toEqual({
      minLength: true,
      hasUppercase: true,
      hasLowercase: true,
      hasNumber: true,
      hasSpecialChar: true,
    });
    expect(calculatePasswordStrength('Str0ng!Pass').isValid).toBe(true);
  });

  it('marks weak and common passwords invalid', () => {
    expect(calculatePasswordStrength('password123').isValid).toBe(false);
    expect(calculatePasswordStrength('password123').feedback).toContain('Avoid common passwords');
    expect(calculatePasswordStrength('short').isValid).toBe(false);
  });

  it('scores a strong password higher than a common one', () => {
    const strong = calculatePasswordStrength('Sup3r!Secret99');
    const common = calculatePasswordStrength('password123');
    expect(strong.score).toBeGreaterThan(common.score);
    expect(strong.score).toBe(4);
  });
});

/**
 * The single MSW-backed test in this file.
 *
 * Real rate limiting happens server-side in the create-order edge function;
 * what the client must do is *not crash and not fake success* when the
 * backend answers 429. MSW simulates that response here.
 */
describe('client handling of HTTP 429 from create-order', () => {
  it.skipIf(!isSupabaseConfigured)(
    'surfaces an error result (no order, no throw) when the edge function responds 429',
    async () => {
      let hits = 0;
      server.use(
        http.post('*/functions/v1/create-order', () => {
          hits += 1;
          return HttpResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
        }),
      );

      const result = await orderService.placeOrder(
        {
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          phone: '01000000000',
          address: '123 Test Street',
          city: 'Cairo',
          governorate: 'Cairo',
          deliveryMethod: 'standard',
          paymentMethod: 'cod',
        },
        [
          {
            productId: 'p-001',
            name: 'Tee',
            slug: 'tee',
            image: '/a.jpg',
            price: 500,
            color: 'Navy',
            size: 'M',
            quantity: 1,
          },
        ],
      );

      expect(hits).toBe(1);
      expect(result.order).toBeNull();
      expect(result.error).toBeTruthy();
    },
  );
});
