import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import AdminLayout from './AdminLayout'
import { adminService } from '../../services/adminService'

export default function CustomerDetail() {
  const { id } = useParams()
  const [customer, setCustomer] = useState<any | null>(null)
  const [orders, setOrders] = useState<any[] | null>(null)

  useEffect(() => {
    if (!id) return
    adminService.getCustomer(id).then((c) => setCustomer(c))
    adminService.listCustomerOrders(id).then((o) => setOrders(o))
  }, [id])

  if (!customer || !orders) {
    return (
      <AdminLayout>
        <Loader2 className="animate-spin text-navy/40" size={20} />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <h1 className="nv-heading text-3xl mb-6">{customer.first_name ?? ''} {customer.last_name ?? ''}</h1>

      <section className="mb-6">
        <h2 className="nv-eyebrow text-xs text-navy/50 mb-2">Profile</h2>
        <div className="border border-navy/10 p-4">
          <p><strong>Email:</strong> {customer.email}</p>
          <p><strong>Phone:</strong> {customer.phone ?? '—'}</p>
          <p><strong>Joined:</strong> {new Date(customer.created_at).toLocaleString()}</p>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="nv-eyebrow text-xs text-navy/50 mb-2">Addresses</h2>
        {customer.customer_addresses?.length ? (
          <ul className="space-y-2">
            {customer.customer_addresses.map((a: any) => (
              <li key={a.id} className="border border-navy/10 p-3">
                <div className="text-sm">{a.label || 'Address'}</div>
                <div className="text-xs text-navy/70">{a.address}, {a.city}, {a.governorate} {a.postal_code ?? ''}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-navy/60">No saved addresses</p>
        )}
      </section>

      <section>
        <h2 className="nv-eyebrow text-xs text-navy/50 mb-2">Recent Orders</h2>
        {orders.length === 0 ? (
          <p className="text-navy/60">No orders</p>
        ) : (
          <div className="overflow-x-auto border border-navy/10">
            <table className="w-full text-sm">
              <thead className="bg-mist/50 text-left">
                <tr>
                  <th className="px-4 py-3 nv-eyebrow text-[10px]">Order</th>
                  <th className="px-4 py-3 nv-eyebrow text-[10px]">Total</th>
                  <th className="px-4 py-3 nv-eyebrow text-[10px]">Status</th>
                  <th className="px-4 py-3 nv-eyebrow text-[10px]">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/10">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3 font-medium">{o.order_number}</td>
                    <td className="px-4 py-3">EGP {o.total.toLocaleString()}</td>
                    <td className="px-4 py-3 text-navy/70">{o.status}</td>
                    <td className="px-4 py-3 text-navy/70">{new Date(o.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminLayout>
  )
}
