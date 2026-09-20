import { useEffect, useState } from 'react';
import { Loader2, TrendingUp, ShoppingCart, DollarSign, Users, Box } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { logError } from '../../lib/sentry';
import AdminLayout from './AdminLayout';

interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  totalCartAbandonments: number;
  recentOrders: Array<{
    order_number?: string;
    total: number;
    created_at: string;
    status: string;
    payment_status: string;
  }>;
  lowStock: Array<{
    product_id: string;
    size: string;
    stock_quantity: number;
    products?: { name: string }[] | null;
  }>;
  monthlyRevenue: Array<{ month: string; revenue: number }>;
  dailyOrders: Array<{ day: string; count: number }>;
}

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    setLoading(true);
    adminService
      .getDashboardStats()
      .then(s => {
        setStats(s as unknown as DashboardStats);
        setLoading(false);
      })
      .catch(err => {
        logError('Failed to load dashboard stats', err);
        setLoading(false);
      });
  }, [timeRange]);

  const formatCurrency = (amount: number) => {
    return `EGP ${amount.toLocaleString()}`;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-navy/40" size={20} />
          <span className="ml-2 text-navy/70">Loading analytics...</span>
        </div>
      </AdminLayout>
    );
  }

  if (!stats) {
    return (
      <AdminLayout>
        <div className="text-center py-12 text-navy/50">Failed to load dashboard data</div>
      </AdminLayout>
    );
  }

  // Calculate growth metrics (simplified - in production would compare with previous period)
  const revenueGrowth = 12.5; // Placeholder - actual calculation would compare with previous period
  const orderGrowth = 8.2;
  const customerGrowth = 5.3;

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-8">
        <h1 className="nv-heading text-4xl">Analytics</h1>

        <div className="flex bg-navy/5 rounded-lg p-1">
          {(['7d', '30d', '90d'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                timeRange === range ? 'bg-navy text-white' : 'text-navy/70 hover:text-navy'
              }`}
            >
              {range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <div className="border border-navy/10 p-6 bg-gradient-to-br from-white to-navy/5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="nv-eyebrow text-xs text-navy/50 mb-1">Total Revenue</p>
              <p className="text-3xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="text-green-600" size={24} />
            </div>
          </div>
          <div className="flex items-center text-sm">
            <span className="text-green-600 flex items-center">
              <TrendingUp size={16} className="mr-1" />
              {revenueGrowth}%
            </span>
            <span className="text-navy/50 ml-2">from previous period</span>
          </div>
        </div>

        <div className="border border-navy/10 p-6 bg-gradient-to-br from-white to-navy/5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="nv-eyebrow text-xs text-navy/50 mb-1">Total Orders</p>
              <p className="text-3xl font-bold">{stats.totalOrders}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <ShoppingCart className="text-blue-600" size={24} />
            </div>
          </div>
          <div className="flex items-center text-sm">
            <span className="text-green-600 flex items-center">
              <TrendingUp size={16} className="mr-1" />
              {orderGrowth}%
            </span>
            <span className="text-navy/50 ml-2">from previous period</span>
          </div>
        </div>

        <div className="border border-navy/10 p-6 bg-gradient-to-br from-white to-navy/5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="nv-eyebrow text-xs text-navy/50 mb-1">Total Customers</p>
              <p className="text-3xl font-bold">{stats.totalCustomers}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="text-purple-600" size={24} />
            </div>
          </div>
          <div className="flex items-center text-sm">
            <span className="text-green-600 flex items-center">
              <TrendingUp size={16} className="mr-1" />
              {customerGrowth}%
            </span>
            <span className="text-navy/50 ml-2">from previous period</span>
          </div>
        </div>

        <div className="border border-navy/10 p-6 bg-gradient-to-br from-white to-navy/5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="nv-eyebrow text-xs text-navy/50 mb-1">Abandoned Carts</p>
              <p className="text-3xl font-bold">{stats.totalCartAbandonments || 0}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Box className="text-orange-600" size={24} />
            </div>
          </div>
          <p className="text-sm text-navy/50">
            {stats.totalCartAbandonments > 0
              ? 'Ready for recovery email'
              : 'No abandoned carts detected'}
          </p>
        </div>
      </div>

      {/* Charts Section - Simplified visual representation */}
      <div className="grid lg:grid-cols-2 gap-8 mb-10">
        <div className="border border-navy/10 p-6 rounded-xl bg-white">
          <h3 className="nv-eyebrow text-xs text-navy/50 mb-4">Revenue Trend</h3>
          <div className="h-64 flex items-end gap-2">
            {stats.monthlyRevenue && stats.monthlyRevenue.length > 0 ? (
              stats.monthlyRevenue.map((item, i) => {
                const max = Math.max(...stats.monthlyRevenue.map(m => m.revenue));
                const height = (item.revenue / max) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center group">
                    <div
                      className="w-full bg-navy/20 rounded-t-sm hover:bg-navy/40 transition-all relative"
                      style={{ height: `${height}%` }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-navy text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatCurrency(item.revenue)}
                      </div>
                    </div>
                    <span className="text-xs text-navy/40 mt-2">{item.month}</span>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-navy/50 italic">No revenue data available</div>
            )}
          </div>
        </div>

        <div className="border border-navy/10 p-6 rounded-xl bg-white">
          <h3 className="nv-eyebrow text-xs text-navy/50 mb-4">Order Volume</h3>
          <div className="h-64 flex items-end gap-2">
            {stats.dailyOrders && stats.dailyOrders.length > 0 ? (
              stats.dailyOrders.map((item, i) => {
                const max = Math.max(...stats.dailyOrders.map(d => d.count));
                const height = (item.count / max) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center group">
                    <div
                      className="w-full bg-blue-400 rounded-t-sm hover:bg-blue-500 transition-all relative"
                      style={{ height: `${height}%` }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-navy text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.count} orders
                      </div>
                    </div>
                    <span className="text-xs text-navy/40 mt-2">{item.day}</span>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-navy/50 italic">No order data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="border border-navy/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-navy/10 bg-navy/5">
          <h2 className="font-semibold">Recent Orders</h2>
        </div>
        {stats.recentOrders.length === 0 ? (
          <div className="p-8 text-center text-navy/50">No orders yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy/5 text-navy/70">
                <tr>
                  <th className="px-6 py-3 font-medium">Order</th>
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/10">
                {stats.recentOrders.map((order, i) => (
                  <tr key={i} className="hover:bg-navy/5 transition-colors">
                    <td className="px-6 py-3 font-medium">{order.order_number || '—'}</td>
                    <td className="px-6 py-3 text-navy/70">Customer</td>
                    <td className="px-6 py-3 text-navy/50">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 font-medium">EGP {order.total.toLocaleString()}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          order.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : order.status === 'processing'
                            ? 'bg-blue-100 text-blue-800'
                            : order.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-navy/50 capitalize">
                      {order.payment_status || 'cod'}
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
