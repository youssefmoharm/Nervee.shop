import { useEffect, useState, useMemo } from 'react';

import { logError } from '../../lib/sentry';
import { supabase } from '../../lib/supabase';
import AdminLayout from './AdminLayout';
import { formatEGP, formatNumber } from '../../lib/format';
import { RevenueChart, OrdersOverTimeChart } from './Charts';
import { DateRangePicker } from './DateRangePicker';
import { useDateRange } from '../../context/AdminContext';
import { KPICard, LoadingState, EmptyState } from './Common';

interface DashboardStats {
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
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { dateRange, handleDateRangeChange } = useDateRange('last_30_days');

  const loadDashboardStats = async () => {
    try {
      setLoading(true);

      // Get dashboard overview using RPC function
      const { data, error: rpcError } = await supabase.rpc('get_dashboard_overview', {
        p_previous_period_start: dateRange.previousStart.toISOString(),
        p_previous_period_end: dateRange.previousEnd.toISOString(),
        p_current_period_start: dateRange.start.toISOString(),
        p_current_period_end: dateRange.end.toISOString(),
      });

      if (rpcError) {
        logError('Dashboard stats error:', rpcError);
        throw rpcError;
      }

      if (data) {
        setStats(data as DashboardStats);
      }
    } catch (err) {
      setError(err as Error);
      logError('Failed to load dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const revenueData = useMemo(() => {
    // This would be fetched from get_daily_sales RPC
    return [];
  }, []);

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
          onRetry={loadDashboardStats}
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

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="nv-heading text-4xl">Dashboard</h1>
          <p className="text-navy/60 mt-1">
            Overview • {formatNumber(dateRange.start.getDate())}{' '}
            {dateRange.start.toLocaleString('default', { month: 'short' })} -{' '}
            {formatNumber(dateRange.end.getDate())}{' '}
            {dateRange.end.toLocaleString('default', { month: 'short' })}
          </p>
        </div>
        <DateRangePicker initialRange="last_30_days" onDateRangeChange={handleDateRangeChange} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-10">
        {/* Revenue */}
        <KPICard
          title="Total Revenue"
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

        {/* Net Revenue */}
        <KPICard
          title="Net Revenue"
          value={formatEGP(stats.totalRevenue - stats.totalRefunds - stats.totalDiscounts)}
          change={stats.revenueGrowthPercentage}
          changeType={
            stats.revenueGrowthPercentage > 0
              ? 'positive'
              : stats.revenueGrowthPercentage < 0
              ? 'negative'
              : 'neutral'
          }
        />

        {/* Gross Sales */}
        <KPICard
          title="Gross Sales"
          value={formatEGP(stats.grossSales)}
          change={stats.revenueGrowthPercentage}
          changeType={
            stats.revenueGrowthPercentage > 0
              ? 'positive'
              : stats.revenueGrowthPercentage < 0
              ? 'negative'
              : 'neutral'
          }
        />

        {/* Total Orders */}
        <KPICard
          title="Total Orders"
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

        {/* Average Order Value */}
        <KPICard title="Average Order Value" value={formatEGP(stats.averageOrderValue)} />

        {/* Total Customers */}
        <KPICard title="Total Customers" value={formatNumber(stats.totalCustomers)} />

        {/* New Customers */}
        <KPICard title="New Customers" value={formatNumber(stats.newCustomers)} />

        {/* Returning Customers */}
        <KPICard title="Returning Customers" value={formatNumber(stats.returningCustomers)} />

        {/* Total Products */}
        <KPICard title="Total Products" value={formatNumber(stats.totalProducts)} />

        {/* Products Sold */}
        <KPICard
          title="Products Sold"
          value={formatNumber(0)} // Would need to calculate from order_items
        />

        {/* Total Returns */}
        <KPICard title="Total Returns" value={formatNumber(stats.totalReturns)} />

        {/* Refund Amount */}
        <KPICard title="Refund Amount" value={formatEGP(stats.totalRefundAmount)} />

        {/* Return Rate */}
        <KPICard title="Return Rate" value={`${formatNumber(Math.round(stats.returnRate))}%`} />

        {/* Pending Orders */}
        <KPICard title="Pending Orders" value={formatNumber(stats.pendingOrders)} />

        {/* Processing Orders */}
        <KPICard title="Processing Orders" value={formatNumber(stats.processingOrders)} />

        {/* Shipped Orders */}
        <KPICard title="Shipped Orders" value={formatNumber(stats.shippedOrders)} />

        {/* Completed Orders */}
        <KPICard title="Completed Orders" value={formatNumber(stats.completedOrders)} />

        {/* Cancelled Orders */}
        <KPICard title="Cancelled Orders" value={formatNumber(stats.cancelledOrders)} />

        {/* Pending Returns */}
        <KPICard title="Pending Returns" value={formatNumber(stats.pendingReturns)} />

        {/* Low Stock Products */}
        <KPICard title="Low Stock Products" value={formatNumber(stats.lowStockProducts)} />

        {/* Out of Stock Products */}
        <KPICard title="Out of Stock Products" value={formatNumber(stats.outOfStockProducts)} />
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-2 gap-8 mb-10">
        <div className="bg-white rounded-xl border border-navy/10 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-navy mb-6">Revenue Over Time</h3>
          <RevenueChart data={revenueData} loading={false} error={null} />
        </div>

        <div className="bg-white rounded-xl border border-navy/10 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-navy mb-6">Orders Over Time</h3>
          <OrdersOverTimeChart
            data={revenueData.map(d => ({ date: d.date, orders: 0 } as const))} // Placeholder
            loading={false}
            error={null}
          />
        </div>
      </div>

      {/* Top Products Section */}
      <div className="bg-white rounded-xl border border-navy/10 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-navy">Best Selling Products</h3>
          <button className="nv-eyebrow text-sm text-navy/60 hover:text-navy">View All</button>
        </div>
        <EmptyState description="No sales data available yet" />
      </div>

      {/* Recent Orders Section */}
      <div className="bg-white rounded-xl border border-navy/10 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-navy mb-6">Recent Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
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
              <tr>
                <td colSpan={5} className="py-8 text-center text-navy/60">
                  Recent orders would be loaded from the server
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
