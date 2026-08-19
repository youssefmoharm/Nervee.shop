import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useSEO } from '../lib/seo';
import { guestOrderService } from '../services/guestOrderService';
import type { GuestOrder } from '../types';
import { Loader2 } from 'lucide-react';

export function TrackOrder() {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [orderNumber, setOrderNumber] = useState(searchParams.get('orderNumber') || '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [order, setOrder] = useState<GuestOrder | null>(null);

  useSEO({
    title: 'Track Your Order | NERVE',
    description: 'Track your NERVE order status and delivery information.',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !orderNumber) {
      showToast('Please enter both email and order number.', 'error', 3000);
      return;
    }

    setStatus('loading');
    const { order, error } = await guestOrderService.lookup(email, orderNumber);

    if (error || !order) {
      setStatus('error');
      showToast('Please check your email and order number and try again.', 'error', 3000);
      return;
    }

    setOrder(order);
    setStatus('success');
  };

  const handleResendVerification = async () => {
    if (!email || !orderNumber) {
      showToast('Please enter email and order number first.', 'error', 3000);
      return;
    }

    setStatus('loading');
    const { success, error } = await guestOrderService.sendVerificationLink(
      email,
      orderNumber,
      order?.verification_token || '',
    );

    if (!success || error) {
      setStatus('error');
      showToast('Please try again later.', 'error', 3000);
      return;
    }

    setStatus('success');
    showToast(`Check your email for the verification link.`, 'success', 3000);
  };

  if (status === 'success' && order) {
    return (
      <div className="bg-white text-navy min-h-screen pt-32 pb-24 px-5 md:px-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="nv-heading text-5xl mb-8">Order Tracking</h1>

          <div className="border border-navy/20 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-navy/10">
              <div>
                <p className="text-xs font-medium text-navy/60 mb-1">Order Number</p>
                <p className="text-2xl font-semibold">{order.order_number}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-navy/60 mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="text-xl font-semibold">Processing</span>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-medium text-navy/60 mb-3">Customer</p>
                <p className="text-lg">{order.email}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-navy/60 mb-3">Order Date</p>
                <p className="text-lg">
                  {order.created_at
                    ? new Date(order.created_at).toLocaleDateString('en-GB')
                    : 'N/A'}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-navy/10">
              <p className="text-xs font-medium text-navy/60 mb-3">Your Order</p>
              <p className="text-sm text-navy/80">
                You can view full order details in your account.
              </p>
              <button
                onClick={() => (window.location.href = '/account/orders')}
                className="mt-2 text-navy underline"
              >
                View My Orders
              </button>
            </div>
          </div>

          <div className="border border-navy/20 rounded-lg p-6">
            <h2 className="nv-heading text-xl mb-4">Delivery Information</h2>
            <div className="space-y-3 text-sm text-navy/80">
              <p>• Order confirmed and being processed</p>
              <p>• You will receive a tracking number via email</p>
              <p>• Delivery time: 2-5 business days</p>
              <p>• Express delivery available: 1-2 business days</p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => {
                setStatus('idle');
                setOrder(null);
                setEmail('');
                setOrderNumber('');
              }}
              className="text-navy underline"
            >
              Track Another Order
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white text-navy min-h-screen pt-32 pb-24 px-5 md:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="nv-heading text-5xl mb-8">Track Your Order</h1>
        <p className="text-navy/70 mb-8">
          Enter your email and order number to check the status of your order.
        </p>

        {status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-700">
              Order not found. Please check your email and order number.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
              />
            </label>
          </div>

          <div className="space-y-2">
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">Order Number</span>
              <input
                type="text"
                required
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
                placeholder="EG-2024-12345"
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-navy text-white nv-eyebrow px-8 py-3.5 hover:bg-navy-2 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {status === 'loading' && <Loader2 size={16} className="animate-spin" />}
            Track Order
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-navy/10 text-center">
          <button
            onClick={handleResendVerification}
            className="text-navy/70 hover:text-navy underline text-sm"
          >
            Resend verification link
          </button>
        </div>

        <div className="mt-12 pt-12 border-t border-navy/10 text-center">
          <p className="text-sm text-navy/60 mb-2">Don&apos;t have an order number?</p>
          <a href="/account" className="text-navy underline text-sm">
            Sign in to your account
          </a>
        </div>
      </div>
    </div>
  );
}
