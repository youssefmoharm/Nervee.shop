import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { orderService } from '../../services/orderService';
import { supabase } from '../../lib/supabase';
import { getEndpoint } from '../../lib/apiEndpoints';
import AccountLayout from './AccountLayout';

interface OrderItem {
  id: string;
  product_name: string;
  color: string;
  size: string;
  image: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface OrderDetailData {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal: number;
  shipping_cost: number;
  discount_amount: number;
  total: number;
  address: string;
  city: string;
  governorate: string;
  postal_code: string | null;
  created_at: string;
  items: OrderItem[];
}

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState<OrderDetailData | null | undefined>(undefined);
  const [showReturn, setShowReturn] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnStatus, setReturnStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle',
  );
  const [returnError, setReturnError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!id) return;
    orderService.getById(id).then(data => setOrder(data as OrderDetailData | null));
  }, [id]);

  const canReturn =
    order &&
    order.status === 'delivered' &&
    Date.now() - new Date(order.created_at).getTime() < 14 * 24 * 60 * 60 * 1000;
  const canCancel =
    order &&
    ['placed', 'processing'].includes(order.status) &&
    Date.now() - new Date(order.created_at).getTime() < 2 * 60 * 60 * 1000;
  const cancelTimeLeft = canCancel
    ? Math.ceil((2 * 60 * 60 * 1000 - (Date.now() - new Date(order.created_at).getTime())) / 1000)
    : 0;

  const submitReturn = async (type: 'return' | 'cancellation') => {
    if (!order || !id) return;
    if (returnReason.trim().length < 10) {
      setReturnError('Reason must be at least 10 characters');
      return;
    }
    setReturnStatus('loading');
    setReturnError(null);

    if (type === 'cancellation') {
      setIsCancelling(true);
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    const res = await fetch(getEndpoint('REQUEST_RETURN'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ orderId: id, type, reason: returnReason.trim() }),
    });
    const json = await res.json();
    if (!res.ok) {
      setReturnError(json.error || 'Failed');
      setReturnStatus('error');
      setIsCancelling(false);
      return;
    }
    setReturnStatus('success');
    setIsCancelling(false);
    setTimeout(() => setShowReturn(false), 1500);
  };

  if (order === undefined) {
    return (
      <AccountLayout>
        <Loader2 className="animate-spin text-navy/40" size={20} />
      </AccountLayout>
    );
  }

  if (!order) {
    return (
      <AccountLayout>
        <p className="text-navy/60">Order not found.</p>
      </AccountLayout>
    );
  }

  return (
    <AccountLayout>
      <Link
        to="/account/orders"
        className="inline-flex items-center gap-1 text-sm text-navy/50 hover:text-navy mb-6"
      >
        <ChevronLeft size={16} /> Back to orders
      </Link>
      <h2 className="nv-heading text-3xl mb-1">Order #{order.order_number}</h2>
      <p className="text-navy/50 text-sm mb-8">
        Placed{' '}
        {new Date(order.created_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        {' · '}
        <span className="capitalize">{order.status}</span>
        {' · Payment '}
        <span className="capitalize">{order.payment_status}</span>
      </p>

      <ul className="divide-y divide-navy/10 border-t border-b border-navy/10 mb-6">
        {order.items.map(item => (
          <li key={item.id} className="flex gap-4 py-4">
            <div className="w-16 h-20 bg-mist flex-shrink-0 overflow-hidden">
              {item.image && (
                <img
                  src={item.image}
                  alt={item.product_name}
                  className="w-full h-full object-cover"
                />
              )}
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
          <div className="flex justify-between">
            <span className="text-navy/60">Subtotal</span>
            <span>EGP {order.subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-navy/60">Shipping</span>
            <span>{order.shipping_cost === 0 ? 'Free' : `EGP ${order.shipping_cost}`}</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between">
              <span className="text-navy/60">Discount</span>
              <span>-EGP {order.discount_amount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-base pt-2 border-t border-navy/10">
            <span>Total</span>
            <span>EGP {order.total.toLocaleString()}</span>
          </div>
        </div>
        <div className="text-sm">
          <p className="nv-eyebrow text-xs text-navy/50 mb-2">Shipping Address</p>
          <p>{order.address}</p>
          <p>
            {order.city}, {order.governorate} {order.postal_code}
          </p>
        </div>
      </div>

      {/* Order Cancellation Section - Separate from Returns */}
      {canCancel && (
        <div className="mt-8 border-t border-navy/10 pt-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-navy/5 rounded-full flex items-center justify-center">
                <Loader2 className="text-navy/50" size={20} />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="nv-eyebrow text-sm mb-2">Cancel Order</h3>
              <p className="text-sm text-navy/70 mb-4">
                Order can be cancelled within <strong>2 hours</strong> of placement.
                {cancelTimeLeft > 0 && ` Time remaining: ${cancelTimeLeft} seconds.`}
              </p>
              <button
                onClick={() => {
                  setReturnReason('Order cancelled by customer');
                  setShowReturn(true);
                }}
                disabled={isCancelling}
                className="bg-red-600 text-white px-6 py-2.5 text-sm hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {isCancelling && <Loader2 size={14} className="animate-spin" />}
                Cancel Order Now
              </button>
            </div>
          </div>
        </div>
      )}

      {(canReturn || canCancel) && (
        <div className="mt-8 border-t border-navy/10 pt-6">
          <h3 className="nv-eyebrow text-sm mb-3">Need to {canReturn ? 'return' : 'cancel'}?</h3>
          {!showReturn ? (
            <button
              onClick={() => setShowReturn(true)}
              className="border border-navy px-6 py-2.5 text-sm hover:bg-navy hover:text-white transition-colors"
            >
              Request {canReturn ? 'Return' : 'Cancellation'}
            </button>
          ) : (
            <div className="space-y-3 max-w-md">
              <textarea
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
                placeholder="Reason (10-1000 chars, e.g. wrong size)"
                rows={3}
                className="w-full border border-navy/20 px-3 py-2 text-sm focus:outline-none focus:border-navy"
              />
              {returnError && <p className="text-xs text-red-600">{returnError}</p>}
              {returnStatus === 'success' && (
                <p className="text-xs text-green-600">
                  Request submitted — admin will review within 24h.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => submitReturn(canReturn ? 'return' : 'cancellation')}
                  disabled={returnStatus === 'loading'}
                  className="bg-navy text-white px-6 py-2 text-sm disabled:opacity-60 flex items-center gap-2"
                >
                  {returnStatus === 'loading' && <Loader2 size={14} className="animate-spin" />}{' '}
                  Submit
                </button>
                <button
                  onClick={() => setShowReturn(false)}
                  className="px-4 py-2 text-sm text-navy/60"
                >
                  Close
                </button>
              </div>
              <p className="text-[11px] text-navy/40">
                Returns: delivered only, 14 days. Cancellations: placed/processing, 2 hours. One
                request per order.
              </p>
            </div>
          )}
        </div>
      )}
    </AccountLayout>
  );
}
