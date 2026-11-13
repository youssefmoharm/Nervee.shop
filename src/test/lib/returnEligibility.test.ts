import { describe, expect, it } from 'vitest';
import { returnEligibility } from '../../lib/returnEligibility';
const now = Date.parse('2026-11-13T12:00:00Z');
const daysAgo = (days: number) => new Date(now - days * 86400000).toISOString();
describe('return eligibility matches server windows', () => {
  it('uses delivery date rather than order date', () => {
    expect(
      returnEligibility(
        { status: 'delivered', created_at: daysAgo(20), delivered_at: daysAgo(2) },
        now,
      ),
    ).toMatchObject({ canReturn: true, canExchange: true, canCancel: false });
  });
  it('expires refunds after seven days and exchanges after thirty', () => {
    expect(
      returnEligibility(
        { status: 'delivered', created_at: daysAgo(20), delivered_at: daysAgo(8) },
        now,
      ),
    ).toMatchObject({ canReturn: false, canExchange: true });
    expect(
      returnEligibility(
        { status: 'delivered', created_at: daysAgo(31), delivered_at: daysAgo(30) },
        now,
      ).canExchange,
    ).toBe(false);
  });
  it('does not enable returns without a delivery timestamp', () => {
    expect(returnEligibility({ status: 'delivered', created_at: daysAgo(1) }, now).canReturn).toBe(
      false,
    );
  });
  it('cancellation expires at two hours from placement', () => {
    expect(
      returnEligibility(
        {
          status: 'placed',
          created_at: daysAgo(1),
          placed_at: new Date(now - 3600000).toISOString(),
        },
        now,
      ).canCancel,
    ).toBe(true);
    expect(
      returnEligibility(
        { status: 'placed', created_at: new Date(now - 7200000).toISOString() },
        now,
      ).canCancel,
    ).toBe(false);
  });
});
