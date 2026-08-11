import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { adminService } from '../../services/adminService'
import AdminLayout from './AdminLayout'

interface Stats {
  totalRevenue: number
  totalOrders: number
  totalCustomers: number
  recentOrders: { order_number?: string; total: number; created_at: string; status: string }[]
  lowStock: { product_id: string; size: string; stock_quantity: number; products?: { name: string }[] | null }[]
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    adminService.getDashboardStats().then((s) => setStats(s as unknown as Stats))
  }, [])

  if (!stats) {
    return (
      <AdminLayout>
        <Loader2 className="animate-spin text-navy/40" size={20} />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <h1 className="nv-heading text-4xl mb-8">Dashboard</h1>

      <div className="grid sm:grid-cols-3 gap-5 mb-10">
        <div className="border border-navy/10 p-6">
          <p className="nv-eyebrow text-xs text-navy/50 mb-2">Total Revenue</p>
          <p className="text-3xl font-semibold">EGP {stats.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="border border-navy/10 p-6">
          <p className="nv-eyebrow text-xs text-navy/50 mb-2">Total Orders</p>
          <p className="text-3xl font-semibold">{stats.totalOrders}</p>
        </div>
        <div className="border border-navy/10 p-6">
          <p className="nv-eyebrow text-xs text-navy/50 mb-2">Total Customers</p>
          <p className="text-3xl font-semibold">{stats.totalCustomers}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h2 className="nv-eyebrow text-xs text-navy/50 mb-3">Recent Orders</h2>
          {stats.recentOrders.length === 0 ? (
            <p className="text-sm text-navy/50">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-navy/10 border border-navy/10">
              {stats.recentOrders.map((o, i) => (
                <li key={i} className="flex justify-between px-4 py-3 text-sm">
                  <span>{o.order_number ?? '—'}</span>
                  <span className="text-navy/50 capitalize">{o.status}</span>
                  <span>EGP {o.total.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="nv-eyebrow text-xs text-navy/50 mb-3">Low Stock</h2>
          {stats.lowStock.length === 0 ? (
            <p className="text-sm text-navy/50">Nothing running low.</p>
          ) : (
            <ul className="divide-y divide-navy/10 border border-navy/10">
              {stats.lowStock.map((row, i) => (
                <li key={i} className="flex justify-between px-4 py-3 text-sm">
                  <span>{row.products?.[0]?.name ?? row.product_id} / {row.size}</span>
                  <span className="text-red-600 font-medium">{row.stock_quantity} left</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
