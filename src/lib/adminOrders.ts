/**
 * Shared order-status rules for the admin UI.
 *
 * The database enforces the same map in `update_order_status`
 * (supabase/migrations/050_admin_ops_hardening.sql). Keep both sides in
 * sync — src/test/lib/adminOrders.test.ts pins this contract, and the SQL
 * test file supabase/tests/database/admin_ops_hardening.sql pins the
 * database copy.
 *
 *   placed     -> processing, cancelled
 *   processing -> shipped, cancelled
 *   shipped    -> delivered, cancelled
 *   delivered  -> refunded
 *   cancelled / refunded are terminal.
 */

export const ORDER_STATUSES = [
  'placed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const VALID_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  placed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export function isValidStatus(status: string): status is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(status);
}

/** Statuses an order currently in `from` may move to (empty for terminal). */
export function validNextStatuses(from: string): OrderStatus[] {
  if (!isValidStatus(from)) return [];
  return [...VALID_STATUS_TRANSITIONS[from]];
}

/** True when `from -> to` is an allowed transition. */
export function canTransition(from: string, to: string): boolean {
  return (
    isValidStatus(from) &&
    isValidStatus(to) &&
    VALID_STATUS_TRANSITIONS[from].includes(to as OrderStatus)
  );
}

/** Cancel/refund restock inventory server-side and cannot be undone. */
export function isIrreversible(status: string): boolean {
  return status === 'cancelled' || status === 'refunded';
}

/**
 * PostgREST `or=(...)` filters treat `,`, `(` and `)` as syntax. Strip them
 * from user search input so a query like `a,b)` can never alter the filter
 * shape — only the literal search term survives.
 */
export function sanitizeSearchInput(raw: string): string {
  return raw.replace(/[,()[\]]/g, ' ').trim();
}
