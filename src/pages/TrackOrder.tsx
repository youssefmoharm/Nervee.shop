import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useSEO } from '../lib/seo';
import { guestOrderService } from '../services/guestOrderService';
import { supabase } from '../lib/supabase';
import type { GuestOrder } from '../types';
import { Loader2 } from 'lucide-react';
import { useI18n } from '../lib/i18n';

const STATUS_LABELS: Record<string, string> = {
  placed: 'Order Placed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const STATUS_COLORS: Record<string, string> = {
  placed: 'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
};

export function TrackOrder() {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [orderNumber, setOrderNumber] = useState(searchParams.get('orderNumber') || '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [order, setOrder] = useState<GuestOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useSEO({
    title: 'Track Your Order | NERVE',
    description: 'Track your NERVE order status and delivery information.',
  });

  const handleLookup = async (
    lookupEmail: string,
    lookupOrderNumber: string,
    verificationToken?: string,
  ) => {
    setStatus('loading');
    setError(null);
    const result = await guestOrderService.lookup(
      lookupEmail,
      lookupOrderNumber,
      verificationToken,
    );
    if (result.error || !result.order) {
      setStatus('error');
      setError(result.error || t('Order not found. Please check your email and order number.'));
      return;
    }
    setOrder(result.order);
    setStatus('success');
  };

  // Auto-lookup when the URL carries token + email + orderNumber (email link)
  useEffect(() => {
    const token = searchParams.get('token');
    const paramsEmail = searchParams.get('email');
    const paramsOrderNumber = searchParams.get('orderNumber');
    if (token && paramsEmail && paramsOrderNumber) {
      setEmail(paramsEmail);
      setOrderNumber(paramsOrderNumber);
      handleLookup(paramsEmail, paramsOrderNumber, token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !orderNumber) {
      showToast(t('Please enter both email and order number.'), 'error', 3000);
      return;
    }
    await handleLookup(email, orderNumber);
  };

  const handleResendVerification = async () => {
    if (!email || !orderNumber) {
      showToast(t('Please enter email and order number first.'), 'error', 3000);
      return;
    }
    setResending(true);
    try {
      const { error: invokeError } = await supabase.functions.invoke('resend-guest-verification', {
        body: {
          order_number: orderNumber.trim().toUpperCase(),
          email: email.trim().toLowerCase(),
        },
      });
      if (invokeError) {
        showToast(t('Please try again later.'), 'error', 3000);
        return;
      }
      showToast(t('If that email exists, a link is on its way.'), 'success', 4000);
    } catch {
      showToast(t('Please try again later.'), 'error', 3000);
    } finally {
      setResending(false);
    }
  };

  if (status === 'success' && order) {
    const statusKey = (order.status || 'placed') as string;
    return (
      <div className="bg-white text-navy min-h-screen pt-32 pb-24 px-5 md:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-10">
            <h1 className="nv-heading text-4xl md:text-5xl mb-2">{t('Order Tracking')}</h1>
            <p className="text-navy/60">{t('Track your NERVE order below')}</p>
          </div>

          <div className="border border-navy/20 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-navy/10">
              <div>
                <p className="text-xs font-medium text-navy/60 mb-1">{t('Order Number')}</p>
                <p className="text-2xl font-semibold font-mono" data-testid="order-number-display">
                  {order.order_number}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-navy/60 mb-1">{t('Status')}</p>
                <span
                  className={
                    'inline-block px-3 py-1 rounded-full text-xs font-medium ' +
                    (STATUS_COLORS[statusKey] || 'bg-gray-100 text-gray-800')
                  }
                >
                  {t(STATUS_LABELS[statusKey] || statusKey)}
                </span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-medium text-navy/60 mb-3">{t('Customer')}</p>
                <p className="text-lg">{order.email}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-navy/60 mb-3">{t('Order Date')}</p>
                <p className="text-lg">
                  {order.created_at
                    ? new Date(order.created_at).toLocaleDateString('en-GB')
                    : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <div className="border border-navy/20 rounded-lg p-6">
            <h2 className="nv-heading text-xl mb-4">{t('Delivery Information')}</h2>
            <div className="space-y-3 text-sm text-navy/80">
              <p>• {t('Order confirmed and being processed')}</p>
              <p>• {t('You will receive a tracking number via email')}</p>
              <p>
                • {t('Delivery time')}: {t('2-5 business days')}
              </p>
              <p>
                • {t('Express delivery available')}: {t('1-2 business days')}
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => {
                setStatus('idle');
                setOrder(null);
                setEmail('');
                setOrderNumber('');
                setError(null);
              }}
              className="text-navy underline"
            >
              {t('Track Another Order')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white text-navy min-h-screen pt-32 pb-24 px-5 md:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="nv-heading text-5xl mb-8">{t('Track Your Order')}</h1>
        <p className="text-navy/70 mb-8">
          {t('Enter the email address and order number from your confirmation email.')}
        </p>

        {status === 'error' && error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block" htmlFor="guest-email">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">{t('Email')}</span>
              <input
                id="guest-email"
                type="email"
                required
                data-testid="guest-email-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy rounded-lg"
              />
            </label>
          </div>

          <div className="space-y-2">
            <label className="block" htmlFor="guest-order-number">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">
                {t('Order Number')}
              </span>
              <input
                id="guest-order-number"
                type="text"
                required
                data-testid="guest-order-number-input"
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value.toUpperCase())}
                placeholder="NRV-123456"
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy rounded-lg font-mono"
              />
              <p className="text-[10px] text-navy/60 mt-1">{t('Example: NRV-123456')}</p>
            </label>
          </div>

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-navy text-white nv-eyebrow px-8 py-3.5 hover:bg-navy-2 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {status === 'loading' && <Loader2 size={16} className="animate-spin" />}
            {t('Track Order')}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-navy/10 text-center">
          <button
            onClick={handleResendVerification}
            disabled={resending}
            className="text-navy/70 hover:text-navy underline text-sm disabled:opacity-60"
          >
            {resending ? t('Sending…') : t('Resend verification link')}
          </button>
        </div>

        <div className="mt-12 pt-12 border-t border-navy/10 text-center">
          <p className="text-sm text-navy/60 mb-2">{t("Don't have an order number?")}</p>
          <a href="/account" className="text-navy underline text-sm">
            {t('Sign in')}
          </a>
        </div>
      </div>
    </div>
  );
}

export default TrackOrder;
