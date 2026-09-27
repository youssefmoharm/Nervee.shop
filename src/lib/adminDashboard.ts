/**
 * Admin dashboard data shaping.
 *
 * `get_dashboard_overview` (supabase/migrations/050_admin_ops_hardening.sql)
 * returns one row of snake_case metrics — PostgREST hands it to the client
 * as an array of rows. mapDashboardRow normalizes both the array wrapper
 * and the naming, and tolerates a database that predates the newer
 * operational columns (they arrive as undefined and default to 0).
 */

export interface DashboardRpcRow {
  current_revenue?: number | null;
  previous_revenue?: number | null;
  gross_sales?: number | null;
  total_refunds?: number | null;
  total_discounts?: number | null;
  current_orders?: number | null;
  previous_orders?: number | null;
  pending_orders?: number | null;
  completed_orders?: number | null;
  cancelled_orders?: number | null;
  new_customers?: number | null;
  total_customers?: number | null;
  returning_customers?: number | null;
  total_products?: number | null;
  inactive_products?: number | null;
  low_stock_products?: number | null;
  out_of_stock_products?: number | null;
  total_refund_amount?: number | null;
  total_returns?: number | null;
  average_order_value?: number | null;
  return_rate?: number | null;
  revenue_growth_percentage?: number | null;
  order_growth_percentage?: number | null;
  processing_orders?: number | null;
  shipped_orders?: number | null;
  delivered_orders?: number | null;
  pending_returns?: number | null;
  approved_returns?: number | null;
  products_sold?: number | null;
}

export interface DashboardStats {
  totalRevenue: number;
  previousRevenue: number;
  grossSales: number;
  totalRefunds: number;
  totalDiscounts: number;
  currentOrders: number;
  previousOrders: number;
  pendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingReturns: number;
  approvedReturns: number;
  newCustomers: number;
  totalCustomers: number;
  returningCustomers: number;
  totalProducts: number;
  inactiveProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalRefundAmount: number;
  totalReturns: number;
  averageOrderValue: number;
  returnRate: number;
  revenueGrowthPercentage: number;
  orderGrowthPercentage: number;
  productsSold: number;
}

const n = (v: number | null | undefined): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;

/** Accepts the raw RPC payload (array of one row, a bare row, or null). */
export function mapDashboardRow(payload: unknown): DashboardStats | null {
  const row: DashboardRpcRow | null | undefined = Array.isArray(payload)
    ? (payload[0] as DashboardRpcRow | undefined)
    : (payload as DashboardRpcRow | null | undefined);
  if (!row || typeof row !== 'object') return null;

  return {
    totalRevenue: n(row.current_revenue),
    previousRevenue: n(row.previous_revenue),
    grossSales: n(row.gross_sales),
    totalRefunds: n(row.total_refunds),
    totalDiscounts: n(row.total_discounts),
    currentOrders: n(row.current_orders),
    previousOrders: n(row.previous_orders),
    pendingOrders: n(row.pending_orders),
    processingOrders: n(row.processing_orders),
    shippedOrders: n(row.shipped_orders),
    deliveredOrders: n(row.delivered_orders),
    completedOrders: n(row.completed_orders),
    cancelledOrders: n(row.cancelled_orders),
    pendingReturns: n(row.pending_returns),
    approvedReturns: n(row.approved_returns),
    newCustomers: n(row.new_customers),
    totalCustomers: n(row.total_customers),
    returningCustomers: n(row.returning_customers),
    totalProducts: n(row.total_products),
    inactiveProducts: n(row.inactive_products),
    lowStockProducts: n(row.low_stock_products),
    outOfStockProducts: n(row.out_of_stock_products),
    totalRefundAmount: n(row.total_refund_amount),
    totalReturns: n(row.total_returns),
    averageOrderValue: n(row.average_order_value),
    returnRate: n(row.return_rate),
    revenueGrowthPercentage: n(row.revenue_growth_percentage),
    orderGrowthPercentage: n(row.order_growth_percentage),
    productsSold: n(row.products_sold),
  };
}

export interface DailyPoint {
  date: string;
  revenue: number;
  orders: number;
}

/**
 * Buckets orders into one point per calendar day across [start, end].
 * Buckets are local-time days (the same days the date picker shows) and
 * cancelled orders contribute no revenue but still count as orders.
 */
export function buildDailySeries(
  orders: { created_at: string; total: number; status: string }[],
  start: Date,
  end: Date,
): DailyPoint[] {
  const dayKey = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const days: DailyPoint[] = [];
  const index = new Map<string, DailyPoint>();
  const cursor = new Date(start.getTime());
  const last = new Date(end.getTime());
  // Guard against a pathological range: 400 empty buckets helps nobody.
  let guard = 0;
  for (;;) {
    cursor.setHours(0, 0, 0, 0);
    if (cursor > last || guard >= 400) break;
    const key = dayKey(cursor);
    const point: DailyPoint = { date: key, revenue: 0, orders: 0 };
    days.push(point);
    index.set(key, point);
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  for (const order of orders) {
    const point = index.get(dayKey(new Date(order.created_at)));
    if (!point) continue;
    point.orders += 1;
    if (order.status !== 'cancelled') point.revenue += order.total ?? 0;
  }
  return days;
}

export interface BestSeller {
  productId: string | null;
  name: string;
  quantity: number;
  revenue: number;
}

/**
 * Aggregates recent order items into best sellers, excluding items whose
 * order was cancelled (the join carries `orders(status)` so restocked
 * cancellations never show up as sales).
 */
export function aggregateBestSellers(
  items: {
    product_id: string | null;
    product_name: string;
    quantity: number;
    subtotal: number;
    orders?: { status: string } | null;
  }[],
  limit = 5,
): BestSeller[] {
  const map = new Map<string, BestSeller>();
  for (const item of items) {
    if (item.orders?.status === 'cancelled') continue;
    const key = item.product_id ?? item.product_name;
    const entry = map.get(key) ?? {
      productId: item.product_id,
      name: item.product_name,
      quantity: 0,
      revenue: 0,
    };
    entry.quantity += item.quantity ?? 0;
    entry.revenue += item.subtotal ?? 0;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, limit);
}
