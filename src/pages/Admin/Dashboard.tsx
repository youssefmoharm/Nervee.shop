import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle, PackageX, RotateCcw, Clock } from 'lucide-react';

import { logError } from '../../lib/sentry';
import { supabase } from '../../lib/supabase';
import AdminLayout from './AdminLayout';
import { formatEGP, formatNumber } from '../../lib/format';
import { RevenueChart, OrdersOverTimeChart } from '../../components/Admin/Charts';
import { DateRangePicker } from '../../components/Admin/DateRangePicker';
import { KPICard, LoadingState, EmptyState } from '../../components/Admin/Common';
import { useAdmin } from '../../context/AdminContext';
import { adminService } from '../../services/adminService';
import {
  aggregateBestSellers,
  buildDailySeries,
  mapDashboardRow,
  type BestSeller,
  type DashboardStats,
  type DailyPoint,
} from '../../lib/adminDashboard';

interface RecentOrder {
  id: string;
  order_number: string;
  email: string;
  total: number;
  status: string;
  created_at: string;
}

interface LowStockRow {
  product_id: string;
  size: string;
  stock_quantity: number;
  low_stock_threshold: number | null;
  product: { name: string; slug: string } | null;
}

/** "Needs attention" tile — every count links to the queue that resolves it. */
function AttentionTile({
  to,
  label,
  count,
  icon,
  urgent,
  testId,
}: {
  to: string;
  label: string;
  count: number;
  icon: React.ReactNode;
  urgent: boolean;
  testId: string;
}) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className={`group flex items-center gap-4 rounded-xl border p-5 transition-colors ${
        urgent
          ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
          : 'border-navy/10 bg-white hover:bg-mist/50'
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          urgent ? 'bg-amber-100 text-amber-700' : 'bg-navy/5 text-navy/50'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-2xl font-semibold text-navy" data-testid={`${testId}-count`}>
          {formatNumber(count)}
        </span>
        <span className="block text-xs text-navy/60">{label}</span>
      </span>
      <ArrowRight
        size={16}
        className="shrink-0 text-navy/30 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [lowStock, setLowStock] = useState<LowStockRow[]>([]);
  const [series, setSeries] = useState<DailyPoint[]>([]);
  const [bestSellers, setBestSellers] = useState<BestSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { dateRange, handleDateRangeChange } = useAdmin();

  const loadDashboardStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const startIso = dateRange.start.toISOString();
      const endIso = dateRange.end.toISOString();

      const [overview, recent, low, trend, items] = await Promise.all([
        supabase.rpc('get_dashboard_overview', {
          p_previous_period_start: dateRange.previousStart.toISOString(),
          p_previous_period_end: dateRange.previousEnd.toISOString(),
          p_current_period_start: startIso,
          p_current_period_end: endIso,
        }),
        supabase
          .from('orders')
          .select('id, order_number, email, total, status, created_at')
          .order('created_at', { ascending: false })
          .limit(8),
        adminService.listLowStock(8),
        supabase
          .from('orders')
          .select('created_at, total, status')
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .order('created_at', { ascending: true })
          .limit(1000),
        supabase
          .from('order_items')
          .select('product_id, product_name, quantity, subtotal, created_at, orders(status)')
          .gte('created_at', startIso)
          .order('created_at', { ascending: false })
          .limit(1500),
      ]);

      if (overview.error) throw overview.error;
      if (recent.error) logError('Recent orders failed', recent.error);
      if (trend.error) logError('Trend query failed', trend.error);
      if (items.error) logError('Best sellers query failed', items.error);

      const mapped = mapDashboardRow(overview.data);
      if (!mapped) throw new Error('Dashboard overview returned no data');
      setStats(mapped);
      setRecentOrders((recent.data as RecentOrder[]) ?? []);
      setLowStock(low);
      setSeries(
        buildDailySeries(
          (trend.data as { created_at: string; total: number; status: string }[]) ?? [],
          dateRange.start,
          dateRange.end,
        ),
      );
      setBestSellers(aggregateBestSellers((items.data as never[]) ?? []));
    } catch (err) {
      setError(err as Error);
      logError('Failed to load dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadDashboardStats();
  }, [loadDashboardStats]);

  if (loading) {
    return (
      <AdminLayout>
        <LoadingState message="Loading dashboard statistics..." />
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <EmptyState
          title="Failed to load dashboard"
          description="Please try refreshing the page"
          action={
            <button
              onClick={loadDashboardStats}
              className="nv-eyebrow px-4 py-2 bg-navy text-white rounded hover:bg-navy-2"
            >
              Try Again
            </button>
          }
        />
      </AdminLayout>
    );
  }

  if (!stats) {
    return (
      <AdminLayout>
        <EmptyState title="No data available" />
      </AdminLayout>
    );
  }

  const revenueData = series.map(p => ({ date: p.date, revenue: p.revenue }));
  const ordersData = series.map(p => ({ date: p.date, orders: p.orders }));

  return (
    <AdminLayout>
      <div
        className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4"
        data-testid="admin-dashboard"
      >
        <div>
          <h1 className="nv-heading text-4xl">Dashboard</h1>
          <p className="text-navy/60 mt-1">
            Overview •{' '}
            {dateRange.start.toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            })}{' '}
            - {dateRange.end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </p>
        </div>
        <DateRangePicker initialRange="last_30_days" onDateRangeChange={handleDateRangeChange} />
      </div>

      {/* Needs attention — the queues an operator actually works */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        <AttentionTile
          to="/admin/orders?status=placed"
          label="Orders awaiting fulfillment"
          count={stats.pendingOrders}
          icon={<Clock size={18} />}
          urgent={stats.pendingOrders > 0}
          testId="attention-pending-orders"
        />
        <AttentionTile
          to="/admin/returns"
          label="Pending return requests"
          count={stats.pendingReturns}
          icon={<RotateCcw size={18} />}
          urgent={stats.pendingReturns > 0}
          testId="attention-pending-returns"
        />
        <AttentionTile
          to="/admin/products"
          label="Products low on stock"
          count={stats.lowStockProducts}
          icon={<AlertTriangle size={18} />}
          urgent={stats.lowStockProducts > 0}
          testId="attention-low-stock"
        />
        <AttentionTile
          to="/admin/products"
          label="Products out of stock"
          count={stats.outOfStockProducts}
          icon={<PackageX size={18} />}
          urgent={stats.outOfStockProducts > 0}
          testId="attention-out-of-stock"
        />
      </div>

      {/* Period KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-10">
        <KPICard
          title="Revenue"
          value={formatEGP(stats.totalRevenue)}
          change={stats.revenueGrowthPercentage}
          changeType={
            stats.revenueGrowthPercentage > 0
              ? 'positive'
              : stats.revenueGrowthPercentage < 0
              ? 'negative'
              : 'neutral'
          }
        />
        <KPICard
          title="Net Revenue"
          value={formatEGP(stats.totalRevenue - stats.totalRefunds - stats.totalDiscounts)}
        />
        <KPICard
          title="Orders"
          value={formatNumber(stats.currentOrders)}
          change={stats.orderGrowthPercentage}
          changeType={
            stats.orderGrowthPercentage > 0
              ? 'positive'
              : stats.orderGrowthPercentage < 0
              ? 'negative'
              : 'neutral'
          }
        />
        <KPICard title="Average Order Value" value={formatEGP(stats.averageOrderValue)} />
        <KPICard title="New Customers" value={formatNumber(stats.newCustomers)} />
        <KPICard title="Returning Customers" value={formatNumber(stats.returningCustomers)} />
        <KPICard title="Products Sold" value={formatNumber(stats.productsSold)} />
        <KPICard title="Return Rate" value={`${formatNumber(Math.round(stats.returnRate))}%`} />
      </div>

      {/* Fulfillment status strip */}
      <div
        className="flex flex-wrap gap-x-8 gap-y-3 rounded-xl border border-navy/10 bg-white px-6 py-4 mb-10 text-sm"
        data-testid="status-strip"
      >
        <span className="text-navy/60">
          Processing <strong className="text-navy">{formatNumber(stats.processingOrders)}</strong>
        </span>
        <span className="text-navy/60">
          Shipped <strong className="text-navy">{formatNumber(stats.shippedOrders)}</strong>
        </span>
        <span className="text-navy/60">
          Delivered <strong className="text-navy">{formatNumber(stats.deliveredOrders)}</strong>
        </span>
        <span className="text-navy/60">
          Cancelled <strong className="text-navy">{formatNumber(stats.cancelledOrders)}</strong>
        </span>
        <span className="text-navy/60">
          Refunds <strong className="text-navy">{formatEGP(stats.totalRefundAmount)}</strong>
        </span>
        <Link
          to="/admin/orders"
          className="ms-auto nv-eyebrow text-navy/50 hover:text-navy flex items-center gap-1"
        >
          Manage orders <ArrowRight size={13} />
        </Link>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-8 mb-10">
        <div className="bg-white rounded-xl border border-navy/10 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-navy mb-6">Revenue Over Time</h3>
          <RevenueChart data={revenueData} loading={false} error={null} />
        </div>

        <div className="bg-white rounded-xl border border-navy/10 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-navy mb-6">Orders Over Time</h3>
          <OrdersOverTimeChart data={ordersData} loading={false} error={null} />
        </div>
      </div>

      {/* Best sellers — drives restock decisions */}
      <div className="bg-white rounded-xl border border-navy/10 p-6 shadow-sm mb-10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-navy">Best Selling Products</h3>
          <span className="text-xs text-navy/50">Selected period</span>
        </div>
        {bestSellers.length === 0 ? (
          <EmptyState
            title="No sales in this period"
            description="Sales in the selected date range will appear here"
          />
        ) : (
          <ul className="divide-y divide-navy/10" data-testid="best-sellers">
            {bestSellers.map(s => (
              <li key={s.productId ?? s.name} className="flex items-center gap-4 py-3 text-sm">
                <span className="font-medium text-navy flex-1 min-w-0 truncate">{s.name}</span>
                <span className="text-navy/60 tabular-nums">{formatNumber(s.quantity)} sold</span>
                <span className="text-navy w-28 text-right tabular-nums">
                  {formatEGP(s.revenue)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-xl border border-navy/10 p-6 shadow-sm mb-10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-navy">Recent Orders</h3>
          <Link to="/admin/orders" className="nv-eyebrow text-sm text-navy/60 hover:text-navy">
            View All
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="recent-orders">
            <thead>
              <tr className="border-b border-navy/10">
                <th className="text-left py-3 px-4 nv-eyebrow text-xs">Order</th>
                <th className="text-left py-3 px-4 nv-eyebrow text-xs">Customer</th>
                <th className="text-right py-3 px-4 nv-eyebrow text-xs">Date</th>
                <th className="text-right py-3 px-4 nv-eyebrow text-xs">Total</th>
                <th className="text-center py-3 px-4 nv-eyebrow text-xs">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/10">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-navy/60">
                    No orders yet
                  </td>
                </tr>
              ) : (
                recentOrders.map(o => (
                  <tr key={o.id}>
                    <td className="py-3 px-4 text-sm font-medium">{o.order_number}</td>
                    <td className="py-3 px-4 text-sm text-navy/70">{o.email}</td>
                    <td className="py-3 px-4 text-sm text-navy/70 text-right whitespace-nowrap">
                      {new Date(o.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </td>
                    <td className="py-3 px-4 text-sm text-right tabular-nums">
                      {formatEGP(o.total)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-[10px] nv-eyebrow uppercase bg-mist text-navy/70 px-2 py-1 rounded">
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low stock queue */}
      <div className="bg-white rounded-xl border border-navy/10 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-navy">Low Stock</h3>
          <span className="text-xs text-navy/50">At or below threshold</span>
        </div>
        {lowStock.length === 0 ? (
          <EmptyState
            title="Every size is above its threshold"
            description="Restock candidates will appear here before they sell out"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="low-stock-table">
              <thead>
                <tr className="border-b border-navy/10">
                  <th className="text-left py-3 px-4 nv-eyebrow text-xs">Product</th>
                  <th className="text-left py-3 px-4 nv-eyebrow text-xs">Size</th>
                  <th className="text-right py-3 px-4 nv-eyebrow text-xs">In stock</th>
                  <th className="text-right py-3 px-4 nv-eyebrow text-xs">Threshold</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/10">
                {lowStock.map(row => (
                  <tr key={`${row.product_id}-${row.size}`}>
                    <td className="py-3 px-4 font-medium">{row.product?.name ?? row.product_id}</td>
                    <td className="py-3 px-4 text-navy/70">{row.size}</td>
                    <td
                      className={`py-3 px-4 text-right tabular-nums font-semibold ${
                        row.stock_quantity === 0 ? 'text-red-600' : 'text-amber-600'
                      }`}
                    >
                      {row.stock_quantity}
                    </td>
                    <td className="py-3 px-4 text-right text-navy/60">
                      {row.low_stock_threshold ?? '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/admin/products/${row.product_id}`}
                        className="nv-eyebrow text-xs text-navy/50 hover:text-navy"
                      >
                        Restock
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
