import { describe, expect, it } from 'vitest';
import { aggregateBestSellers, buildDailySeries, mapDashboardRow } from '../../lib/adminDashboard';

describe('mapDashboardRow', () => {
  const fullRow = {
    current_revenue: 1200,
    previous_revenue: 1000,
    gross_sales: 900,
    total_refunds: 100,
    total_discounts: 50,
    current_orders: 12,
    previous_orders: 10,
    pending_orders: 3,
    completed_orders: 5,
    cancelled_orders: 1,
    new_customers: 4,
    total_customers: 40,
    returning_customers: 6,
    total_products: 25,
    inactive_products: 2,
    low_stock_products: 3,
    out_of_stock_products: 1,
    total_refund_amount: 150,
    total_returns: 4,
    average_order_value: 100,
    return_rate: 8.5,
    revenue_growth_percentage: 20,
    order_growth_percentage: 10,
    processing_orders: 2,
    shipped_orders: 1,
    delivered_orders: 6,
    pending_returns: 2,
    approved_returns: 1,
    products_sold: 37,
  };

  it('maps the RPC array wrapper (PostgREST set-returning shape)', () => {
    const stats = mapDashboardRow([fullRow]);
    expect(stats).not.toBeNull();
    expect(stats!.totalRevenue).toBe(1200);
    expect(stats!.pendingOrders).toBe(3);
    expect(stats!.processingOrders).toBe(2);
    expect(stats!.shippedOrders).toBe(1);
    expect(stats!.deliveredOrders).toBe(6);
    expect(stats!.pendingReturns).toBe(2);
    expect(stats!.approvedReturns).toBe(1);
    expect(stats!.productsSold).toBe(37);
    expect(stats!.revenueGrowthPercentage).toBe(20);
    expect(stats!.averageOrderValue).toBe(100);
  });

  it('maps a bare row too', () => {
    const stats = mapDashboardRow(fullRow);
    expect(stats!.currentOrders).toBe(12);
    expect(stats!.outOfStockProducts).toBe(1);
  });

  it('returns null for empty payloads', () => {
    expect(mapDashboardRow(null)).toBeNull();
    expect(mapDashboardRow(undefined)).toBeNull();
    expect(mapDashboardRow([])).toBeNull();
    expect(mapDashboardRow('nope')).toBeNull();
  });

  it('defaults missing operational columns to 0 (older database) instead of NaN', () => {
    const stats = mapDashboardRow({ current_revenue: 500, current_orders: 2 });
    expect(stats!.totalRevenue).toBe(500);
    expect(stats!.productsSold).toBe(0);
    expect(stats!.pendingReturns).toBe(0);
    expect(stats!.processingOrders).toBe(0);
    expect(Number.isNaN(stats!.productsSold)).toBe(false);
  });

  it('coerces nulls and non-finite values to 0', () => {
    const stats = mapDashboardRow({
      current_revenue: null,
      average_order_value: null,
      return_rate: Number.NaN,
      current_orders: 7,
    });
    expect(stats!.totalRevenue).toBe(0);
    expect(stats!.averageOrderValue).toBe(0);
    expect(stats!.returnRate).toBe(0);
    expect(stats!.currentOrders).toBe(7);
  });
});

describe('buildDailySeries', () => {
  const start = new Date('2026-09-01T00:00:00.000Z');
  const end = new Date('2026-09-05T00:00:00.000Z');

  it('creates one bucket per calendar day across the range', () => {
    const series = buildDailySeries([], start, end);
    expect(series).toHaveLength(5);
    expect(series[0].date).toBe('2026-09-01');
    expect(series[4].date).toBe('2026-09-05');
    expect(series.every(p => p.revenue === 0 && p.orders === 0)).toBe(true);
  });

  it('buckets orders by day and excludes cancelled revenue', () => {
    const series = buildDailySeries(
      [
        { created_at: '2026-09-01T10:00:00.000Z', total: 500, status: 'placed' },
        { created_at: '2026-09-01T18:00:00.000Z', total: 300, status: 'delivered' },
        { created_at: '2026-09-03T12:00:00.000Z', total: 900, status: 'cancelled' },
      ],
      start,
      end,
    );
    expect(series[0].orders).toBe(2);
    expect(series[0].revenue).toBe(800);
    expect(series[2].orders).toBe(1);
    expect(series[2].revenue).toBe(0); // cancelled counts as an order, not revenue
  });

  it('ignores orders outside the range', () => {
    const series = buildDailySeries(
      [{ created_at: '2026-08-15T00:00:00.000Z', total: 100, status: 'placed' }],
      start,
      end,
    );
    expect(series.reduce((n, p) => n + p.orders, 0)).toBe(0);
  });

  it('caps pathological ranges instead of generating unbounded buckets', () => {
    const series = buildDailySeries([], new Date('2020-01-01T00:00:00.000Z'), end);
    expect(series.length).toBeLessThanOrEqual(400);
  });
});

describe('aggregateBestSellers', () => {
  const item = (over: Partial<Parameters<typeof aggregateBestSellers>[0][number]> = {}) => ({
    product_id: 'tee',
    product_name: 'Black Tee',
    quantity: 1,
    subtotal: 500,
    orders: { status: 'placed' },
    ...over,
  });

  it('sums quantity and revenue per product', () => {
    const result = aggregateBestSellers([item(), item({ quantity: 2, subtotal: 1000 })]);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(3);
    expect(result[0].revenue).toBe(1500);
  });

  it('excludes items whose order was cancelled (restocked sales)', () => {
    const result = aggregateBestSellers([item(), item({ orders: { status: 'cancelled' } })]);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(1);
  });

  it('sorts by quantity descending and respects the limit', () => {
    const result = aggregateBestSellers(
      [
        item({ product_id: 'a', product_name: 'A', quantity: 1 }),
        item({ product_id: 'b', product_name: 'B', quantity: 5 }),
        item({ product_id: 'c', product_name: 'C', quantity: 3 }),
      ],
      2,
    );
    expect(result.map(s => s.productId)).toEqual(['b', 'c']);
  });

  it('falls back to product name when product_id is null', () => {
    const result = aggregateBestSellers([
      item({ product_id: null, product_name: 'Orphan' }),
      item({ product_id: null, product_name: 'Orphan', quantity: 4, subtotal: 2000 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Orphan');
    expect(result[0].quantity).toBe(5);
  });

  it('returns an empty list for an empty period', () => {
    expect(aggregateBestSellers([])).toEqual([]);
  });
});
