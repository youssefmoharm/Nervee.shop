import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { orderService } from '../../services/orderService'
import AccountLayout from './AccountLayout'

interface OrderItem {
  id: string
  product_name: string
  color: string
  size: string
  image: string
  price: number
  quantity: number
  subtotal: number
}

interface OrderDetailData {
  id: string
  order_number: string
  status: string
  payment_status: string
  subtotal: number
  shipping_cost: number
  discount_amount: number
  total: number
  address: string
  city: string
  governorate: string
  postal_code: string | null
  created_at: string
  items: OrderItem[]
}

export default function OrderDetail() {
  const { id } = useParams()
  const [order, setOrder] = useState<OrderDetailData | null | undefined>(undefined)

  useEffect(() => {
    if (!id) return
    orderService.getById(id).then((data) => setOrder(data as OrderDetailData | null))
  }, [id])

  if (order === undefined) {
    return (
      <AccountLayout>
        <Loader2 className="animate-spin text-navy/40" size={20} />
      </AccountLayout>
    )
  }

  if (!order) {
    return (
      <AccountLayout>
        <p className="text-navy/60">Order not found.</p>
      </AccountLayout>
    )
  }

  return (
    <AccountLayout>
      <Link to="/account/orders" className="inline-flex items-center gap-1 text-sm text-navy/50 hover:text-navy mb-6">
        <ChevronLeft size={16} /> Back to orders
      </Link>
      <h2 className="nv-heading text-3xl mb-1">Order #{order.order_number}</h2>
      <p className="text-navy/50 text-sm mb-8">
        Placed {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        {' · '}
        <span className="capitalize">{order.status}</span>
        {' · Payment '}
        <span className="capitalize">{order.payment_status}</span>
      </p>

      <ul className="divide-y divide-navy/10 border-t border-b border-navy/10 mb-6">
        {order.items.map((item) => (
          <li key={item.id} className="flex gap-4 py-4">
            <div className="w-16 h-20 bg-mist flex-shrink-0 overflow-hidden">
              {item.image && <img src={item.image} alt={item.product_name} className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1">
              <p className="nv-edit text-sm font-semibold uppercase">{item.product_name}</p>
              <p className="text-xs text-navy/50 mt-1">
                {item.color} / {item.size} · Qty {item.quantity}
              </p>
            </div>
            <span className="text-sm">EGP {item.subtotal.toLocaleString()}</span>
          </li>
        ))}
      </ul>

      <div className="grid sm:grid-cols-2 gap-8">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-navy/60">Subtotal</span><span>EGP {order.subtotal.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-navy/60">Shipping</span><span>{order.shipping_cost === 0 ? 'Free' : `EGP ${order.shipping_cost}`}</span></div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between"><span className="text-navy/60">Discount</span><span>-EGP {order.discount_amount.toLocaleString()}</span></div>
          )}
          <div className="flex justify-between font-semibold text-base pt-2 border-t border-navy/10">
            <span>Total</span><span>EGP {order.total.toLocaleString()}</span>
          </div>
        </div>
        <div className="text-sm">
          <p className="nv-eyebrow text-xs text-navy/50 mb-2">Shipping Address</p>
          <p>{order.address}</p>
          <p>{order.city}, {order.governorate} {order.postal_code}</p>
        </div>
      </div>
    </AccountLayout>
  )
}
