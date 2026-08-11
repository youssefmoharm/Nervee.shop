import { useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { adminService } from '../../services/adminService'
import AdminLayout from './AdminLayout'

interface OrderRow {
  id: string
  order_number: string
  email: string
  total: number
  status: string
  payment_status: string
  payment_provider: string | null
  created_at: string
}

const STATUSES = ['placed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null)
  const [filter, setFilter] = useState('')
  const [verifying, setVerifying] = useState<string | null>(null)
  const [verifyMessage, setVerifyMessage] = useState<{ id: string; text: string } | null>(null)

  const load = () => adminService.listOrders(filter || undefined).then((data) => setOrders(data as OrderRow[]))

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const changeStatus = async (id: string, status: string) => {
    const { error } = await adminService.updateOrderStatus(id, status)
    if (error) {
      alert(error)
      return
    }
    load()
  }

  const verifyPayment = async (id: string) => {
    setVerifying(id)
    setVerifyMessage(null)
    const { message, error } = await adminService.verifyPayment(id)
    setVerifying(null)
    setVerifyMessage({ id, text: error ?? message ?? '' })
    load()
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="nv-heading text-4xl">Orders</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-navy/20 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {!orders ? (
        <Loader2 className="animate-spin text-navy/40" size={20} />
      ) : orders.length === 0 ? (
        <p className="text-navy/60">No orders found.</p>
      ) : (
        <div className="overflow-x-auto border border-navy/10">
          <table className="w-full text-sm">
            <thead className="bg-mist/50 text-left">
              <tr>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Order</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Email</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Total</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Payment</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Status</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/10">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-medium">{o.order_number}</td>
                  <td className="px-4 py-3 text-navy/70">{o.email}</td>
                  <td className="px-4 py-3">EGP {o.total.toLocaleString()}</td>
                  <td className="px-4 py-3 capitalize text-navy/70">{o.payment_status}</td>
                  <td className="px-4 py-3">
                    <select
                      value={o.status}
                      onChange={(e) => changeStatus(o.id, e.target.value)}
                      className="border border-navy/20 px-2 py-1.5 text-xs"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {o.payment_provider === 'paymob' && o.payment_status !== 'paid' && (
                      <div className="flex flex-col items-end gap-1">
                        <button
                          onClick={() => verifyPayment(o.id)}
                          disabled={verifying === o.id}
                          className="inline-flex items-center gap-1.5 text-xs text-navy/60 hover:text-navy border border-navy/20 px-2.5 py-1.5 disabled:opacity-50"
                        >
                          {verifying === o.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                          Verify Payment
                        </button>
                        {verifyMessage?.id === o.id && (
                          <span className="text-[11px] text-navy/50 max-w-[180px] text-right">{verifyMessage.text}</span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  )
}
