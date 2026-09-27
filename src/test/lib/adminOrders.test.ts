import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUSES,
  VALID_STATUS_TRANSITIONS,
  canTransition,
  isIrreversible,
  isValidStatus,
  sanitizeSearchInput,
  validNextStatuses,
} from '../../lib/adminOrders';

// Mirror of the database contract in
// supabase/migrations/050_admin_ops_hardening.sql (update_order_status).
const DB_MAP: Record<string, readonly string[]> = {
  placed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

describe('order status transition contract', () => {
  it('exposes exactly the six persisted statuses', () => {
    expect([...ORDER_STATUSES]).toEqual([
      'placed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'refunded',
    ]);
  });

  it('matches the database transition map one-to-one', () => {
    expect(VALID_STATUS_TRANSITIONS).toEqual(DB_MAP);
  });

  it('walks the happy path placed → processing → shipped → delivered → refunded', () => {
    expect(canTransition('placed', 'processing')).toBe(true);
    expect(canTransition('processing', 'shipped')).toBe(true);
    expect(canTransition('shipped', 'delivered')).toBe(true);
    expect(canTransition('delivered', 'refunded')).toBe(true);
  });

  it('allows cancellation only while the order is still in fulfilment', () => {
    expect(canTransition('placed', 'cancelled')).toBe(true);
    expect(canTransition('processing', 'cancelled')).toBe(true);
    expect(canTransition('shipped', 'cancelled')).toBe(true);
    expect(canTransition('delivered', 'cancelled')).toBe(false);
  });

  it('rejects state skipping', () => {
    expect(canTransition('placed', 'delivered')).toBe(false);
    expect(canTransition('placed', 'shipped')).toBe(false);
    expect(canTransition('processing', 'refunded')).toBe(false);
  });

  it('keeps cancelled and refunded terminal', () => {
    expect(validNextStatuses('cancelled')).toEqual([]);
    expect(validNextStatuses('refunded')).toEqual([]);
    expect(canTransition('cancelled', 'refunded')).toBe(false);
    expect(canTransition('refunded', 'cancelled')).toBe(false);
    expect(canTransition('refunded', 'processing')).toBe(false);
  });

  it('treats unknown statuses as non-transitionable', () => {
    expect(isValidStatus('bogus')).toBe(false);
    expect(validNextStatuses('bogus')).toEqual([]);
    expect(canTransition('bogus', 'processing')).toBe(false);
    expect(canTransition('placed', 'bogus')).toBe(false);
  });

  it('marks cancel/refund as irreversible (UI prompts for an audit reason)', () => {
    expect(isIrreversible('cancelled')).toBe(true);
    expect(isIrreversible('refunded')).toBe(true);
    expect(isIrreversible('processing')).toBe(false);
    expect(isIrreversible('delivered')).toBe(false);
  });

  it('validates every entry of the map itself', () => {
    for (const from of ORDER_STATUSES) {
      expect(isValidStatus(from)).toBe(true);
      for (const to of VALID_STATUS_TRANSITIONS[from]) {
        expect(isValidStatus(to)).toBe(true);
      }
    }
  });
});

describe('PostgREST search sanitization', () => {
  it('passes ordinary search terms through', () => {
    expect(sanitizeSearchInput('NV-1042')).toBe('NV-1042');
    expect(sanitizeSearchInput('buyer@example.com')).toBe('buyer@example.com');
  });

  it('neutralizes or=(...) filter injection characters', () => {
    expect(sanitizeSearchInput('a,b')).toBe('a b');
    expect(sanitizeSearchInput('a(b)')).toBe('a b');
    expect(sanitizeSearchInput('x, (status.eq.cancelled)')).toBe('x   status.eq.cancelled');
    expect(sanitizeSearchInput(']]..[[')).toBe('..');
  });

  it('trims surrounding whitespace after stripping', () => {
    expect(sanitizeSearchInput('  ,,, hello ,, ')).toBe('hello');
  });

  it('never leaves a raw filter delimiter behind', () => {
    const evil = 'x),email.ilike.%a%,status.eq.delivered';
    const clean = sanitizeSearchInput(evil);
    expect(clean).not.toMatch(/[,()[\]]/);
  });
});
