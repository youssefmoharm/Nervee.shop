import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Check, Mail } from 'lucide-react';
import { guestOrderService } from '../services/guestOrderService';
import { useSEO } from '../lib/seo';
import type { GuestOrder } from '../types';

type Step = 'search' | 'loading' | 'success' | 'not-found' | 'error';

export default function GuestOrder() {
  useSEO({
    title: 'Track Your Order | NERVE',
    description:
      'Look up your NERVE order by email and order number. Cash on delivery across Egypt.',
  });
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('search');
  const [order, setOrder] = useState<GuestOrder | null>(null);
  const [email, setEmail] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const paramsEmail = searchParams.get('email');
    const paramsOrderNumber = searchParams.get('orderNumber');

    if (token && paramsEmail && paramsOrderNumber) {
      setEmail(paramsEmail);
      setOrderNumber(paramsOrderNumber);
      handleLookup(paramsEmail, paramsOrderNumber, token);
    }
  }, [searchParams]);

  const handleLookup = async (
    lookupEmail: string,
    lookupOrderNumber: string,
    verificationToken?: string,
  ) => {
    setStep('loading');
    setError(null);

    const { order, error } = await guestOrderService.lookup(
      lookupEmail,
      lookupOrderNumber,
      verificationToken,
    );

    if (error || !order) {
      setStep('not-found');
      setError(error || 'Order not found');
      return;
    }

    setOrder(order);
    setStep('success');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !orderNumber) {
      setError('Please enter both email and order number');
      return;
    }

    await handleLookup(email, orderNumber);
  };

  if (step === 'success' && order) {
    const statusLabels: Record<string, string> = {
      placed: 'Order Placed',
      processing: 'Processing',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      refunded: 'Refunded',
    };

    const getStatusBadge = (status: string) => {
      const colors: Record<string, string> = {
        placed: 'bg-amber-100 text-amber-800',
        processing: 'bg-blue-100 text-blue-800',
        shipped: 'bg-purple-100 text-purple-800',
        delivered: 'bg-green-100 text-green-800',
        cancelled: 'bg-red-100 text-red-800',
        refunded: 'bg-gray-100 text-gray-800',
      };
      return (
        <span
          className={
            'inline-block px-3 py-1 rounded-full text-xs font-medium ' + (colors[status] || '')
          }
        >
          {statusLabels[status] || status}
        </span>
      );
    };

    return (
      <div className="bg-white text-navy min-h-screen pt-24 md:pt-28 px-5 md:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
              <Check size={32} />
            </div>
            <h1 className="nv-heading text-4xl mb-2">Order Found!</h1>
            <p className="text-navy/60">Track your NERVE order below</p>
          </div>

          <div className="bg-mist/50 rounded-2xl p-6 md:p-8 mb-8">
            <div className="flex items-center gap-2 mb-6">
              <Mail size={16} className="text-navy" />
              <span className="font-mono">{order.email}</span>
            </div>

            <div className="flex items-center gap-2 mb-6">
              <span className="font-mono text-2xl text-navy">{order.order_number}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-xs text-navy/50 uppercase">Status</p>
                {getStatusBadge(order.status as string)}
              </div>
              <div>
                <p className="text-xs text-navy/50 uppercase">Placed</p>
                <p className="text-sm mt-1">
                  {new Date(order.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="border-t border-navy/10 pt-4">
              <p className="text-xs text-navy/50">
                We&apos;ve sent a confirmation email to {order.email} with your order details.
              </p>
            </div>
          </div>

          <div className="text-center">
            <a href="/shop" className="inline-block text-navy nv-eyebrow underline">
              Continue Shopping
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'not-found') {
    return (
      <div className="bg-white text-navy min-h-screen pt-24 md:pt-28 px-5 md:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
            <Mail size={32} />
          </div>
          <h1 className="nv-heading text-4xl mb-2">Order Not Found</h1>
          <p className="text-navy/60 mb-6">
            {error || "We couldn't find an order matching your information."}
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
            <p className="text-sm text-amber-800">
              <strong>Can&apos;t find your order?</strong>
              Check your spam folder for the order confirmation email, or contact us.
            </p>
          </div>

          <button
            onClick={() => setStep('search')}
            className="bg-navy text-white nv-eyebrow px-6 py-3 rounded-full hover:bg-navy-2 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white text-navy min-h-screen pt-24 md:pt-28 px-5 md:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-10">
          <h1 className="nv-heading text-4xl mb-2">Track Your Order</h1>
          <p className="text-navy/60">
            Enter the email address and order number from your confirmation email
          </p>
        </div>

        <div className="bg-mist/50 rounded-2xl p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="guest-email"
                className="text-xs font-medium text-navy/60 mb-1.5 block"
              >
                Email
              </label>
              <input
                id="guest-email"
                type="email"
                required
                data-testid="guest-email-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy rounded-lg"
                placeholder="you@email.com"
              />
            </div>

            <div>
              <label
                htmlFor="guest-order-number"
                className="text-xs font-medium text-navy/60 mb-1.5 block"
              >
                Order Number
              </label>
              <input
                id="guest-order-number"
                type="text"
                required
                data-testid="guest-order-number-input"
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value.toUpperCase())}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy rounded-lg font-mono"
                placeholder="NRV-123456"
              />
              <p className="text-[10px] text-navy/40 mt-1">Example: NRV-123456</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={step === 'loading'}
              className="w-full bg-navy text-white nv-eyebrow py-4 rounded-lg hover:bg-navy-2 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {step === 'loading' ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Searching...
                </>
              ) : (
                'Track Order'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-navy/10 text-center">
            <p className="text-sm text-navy/60">
              Already have an account?{' '}
              <a href="/login" className="text-navy underline">
                Sign in to view all your orders
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
