import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { orderService } from '../../services/orderService'
import AccountLayout from './AccountLayout'

interface OrderRow {
  id: string
  order_number: string
  total: number
  status: string
  created_at: string
}

const statusColor: Record<string, string> = {
  placed: 'text-navy/60',
  processing: 'text-navy',
  shipped: 'text-navy',
  delivered: 'text-green-700',
  cancelled: 'text-red-600',
  refunded: 'text-red-600',
}

export default function Orders() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null)

  useEffect(() => {
    orderService.listMine().then((data) => setOrders(data as OrderRow[]))
  }, [])

  return (
    <AccountLayout>
      <h2 className="nv-heading text-3xl mb-6">Orders</h2>

      {!orders ? (
        <Loader2 className="animate-spin text-navy/40" size={20} />
      ) : orders.length === 0 ? (
        <div className="text-center py-16 border border-navy/10">
          <p className="text-navy/60 mb-4">You haven&apos;t placed any orders yet.</p>
          <Link to="/shop" className="nv-eyebrow underline">
            Start Shopping
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-navy/10 border border-navy/10">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                to={`/account/orders/${o.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-mist/40 transition-colors"
              >
                <div>
                  <p className="nv-edit font-semibold text-sm">#{o.order_number}</p>
                  <p className="text-xs text-navy/50 mt-0.5">
                    {new Date(o.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">EGP {o.total.toLocaleString()}</p>
                  <p className={`nv-eyebrow text-[10px] mt-0.5 ${statusColor[o.status] ?? 'text-navy/60'}`}>
                    {o.status}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AccountLayout>
  )
}
