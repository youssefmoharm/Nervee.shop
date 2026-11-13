import { useEffect, useState } from 'react';
import { safeImageSrc } from '../../lib/images';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { returnEligibility } from '../../lib/returnEligibility';
import { orderService } from '../../services/orderService';
import { logError } from '../../lib/sentry';
import { supabase } from '../../lib/supabase';
import { getEndpoint } from '../../lib/apiEndpoints';
import AccountLayout from './AccountLayout';
import { formatEGP } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useSEO } from '../../hooks/useSEO';

interface OrderItem {
  id: string;
  product_name: string;
  color: string;
  size: string;
  image: string;
  price: number;
  quantity: number;
  subtotal: number;
  returned_quantity?: number;
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
  placed_at?: string;
  delivered_at?: string;
  items: OrderItem[];
  requests?: Array<{
    id: string;
    type: string;
    status: string;
    return_exchange_shipments?: {
      tracking_number: string | null;
      tracking_url: string | null;
    } | null;
  }>;
}

export default function OrderDetail() {
  const { t } = useI18n();
  useSEO({
    title: 'Order Details — NERVE',
    description: 'Details and status for your NERVE order.',
    robots: 'noindex, nofollow',
  });
  const { id } = useParams();
  const [order, setOrder] = useState<OrderDetailData | null | undefined>(undefined);
  const [requestType, setRequestType] = useState<'return' | 'exchange'>('return');
  const [selected, setSelected] = useState<
    Record<string, { quantity: number; replacementSize: string }>
  >({});
  const [showReturn, setShowReturn] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnStatus, setReturnStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle',
  );
  const [returnError, setReturnError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadError(false);
    orderService
      .getById(id)
      .then(data => {
        if (!cancelled) setOrder(data as OrderDetailData | null);
      })
      .catch(err => {
        logError('Failed to load order', err);
        // `order` stays undefined on error -> infinite spinner (BUG-04).
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const { canReturn, canExchange, canCancel, cancelTimeLeft } = order
    ? returnEligibility(order)
    : { canReturn: false, canExchange: false, canCancel: false, cancelTimeLeft: 0 };

  const submitReturn = async (type: 'return' | 'cancellation' | 'exchange') => {
    if (!order || !id) return;
    if (returnReason.trim().length < 10) {
      setReturnError(t('Reason must be at least 10 characters'));
      return;
    }
    setReturnStatus('loading');
    setReturnError(null);

    if (type === 'cancellation') {
      setIsCancelling(true);
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(getEndpoint('REQUEST_RETURN'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orderId: id,
          type,
          reason: returnReason.trim(),
          items: Object.entries(selected)
            .filter(([, v]) => v.quantity > 0)
            .map(([orderItemId, v]) => ({ orderItemId, ...v })),
        }),
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
    } catch {
      setReturnError(t('Could not submit request. Please try again.'));
      setReturnStatus('error');
    } finally {
      setIsCancelling(false);
    }
  };

  if (loadError) {
    return (
      <AccountLayout>
        <p className="text-navy/60 mb-4">{t("We couldn't load this order.")}</p>
        <button onClick={() => setReloadKey(k => k + 1)} className="nv-eyebrow underline">
          {t('Try again')}
        </button>
      </AccountLayout>
    );
  }

  if (order === undefined) {
    return (
      <AccountLayout>
        <Loader2 className="animate-spin text-navy/60" size={20} />
      </AccountLayout>
    );
  }

  if (!order) {
    return (
      <AccountLayout>
        <p className="text-navy/60">{t('Order not found.')}</p>
      </AccountLayout>
    );
  }

  return (
    <AccountLayout>
      <Link
        to="/account/orders"
        className="inline-flex items-center gap-1 text-sm text-navy/60 hover:text-navy mb-6"
      >
        <ChevronLeft size={16} /> {t('Back to orders')}
      </Link>
      <h2 className="nv-heading text-3xl mb-1">
        {t('Order')} #{order.order_number}
      </h2>
      <p className="text-navy/60 text-sm mb-8">
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
                  decoding="async"
                  loading="lazy"
                  src={safeImageSrc(item.image)}
                  alt={item.product_name}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1">
              <p className="nv-edit text-sm font-semibold uppercase">{item.product_name}</p>
              <p className="text-xs text-navy/60 mt-1">
                {item.color} / {item.size} · Qty {item.quantity}
              </p>
            </div>
            <span className="text-sm">{formatEGP(item.subtotal)}</span>
          </li>
        ))}
      </ul>

      <div className="grid sm:grid-cols-2 gap-8">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-navy/60">{t('Subtotal')}</span>
            <span>{formatEGP(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-navy/60">{t('Shipping')}</span>
            <span>{order.shipping_cost === 0 ? t('Free') : formatEGP(order.shipping_cost)}</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between">
              <span className="text-navy/60">{t('Discount')}</span>
              <span>- {formatEGP(order.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-base pt-2 border-t border-navy/10">
            <span>{t('Total')}</span>
            <span>{formatEGP(order.total)}</span>
          </div>
        </div>
        <div className="text-sm">
          <p className="nv-eyebrow text-xs text-navy/60 mb-2">{t('Shipping Address')}</p>
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
                <Loader2 className="text-navy/60" size={20} />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="nv-eyebrow text-sm mb-2">{t('Cancel Order')}</h3>
              <p className="text-sm text-navy/70 mb-4">
                {t('Order can be cancelled within')} <strong>{t('2 hours')}</strong>{' '}
                {t('of placement.')}
                {cancelTimeLeft > 0 && ` ${t('Time remaining')}: ${cancelTimeLeft}s.`}
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
                {t('Cancel Order Now')}
              </button>
            </div>
          </div>
        </div>
      )}

      {order.requests?.map(request => (
        <div className="border p-4 mt-4" key={request.id}>
          <p>
            {request.type}: {request.status}
          </p>
          {request.return_exchange_shipments?.tracking_number && (
            <p>Replacement tracking: {request.return_exchange_shipments.tracking_number}</p>
          )}
          {request.return_exchange_shipments?.tracking_url?.startsWith('https://') && (
            <a
              className="underline"
              href={request.return_exchange_shipments.tracking_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Track replacement
            </a>
          )}
        </div>
      ))}
      {(canReturn || canExchange || canCancel) && (
        <div className="mt-8 border-t border-navy/10 pt-6">
          <h3 className="nv-eyebrow text-sm mb-3">
            {t('Need to')} {canReturn || canExchange ? t('return or exchange') : t('cancel')}?
          </h3>
          {!showReturn ? (
            <button
              onClick={() => setShowReturn(true)}
              className="border border-navy px-6 py-2.5 text-sm hover:bg-navy hover:text-white transition-colors"
            >
              {t('Request')}{' '}
              {canReturn || canExchange ? t('Return or Exchange') : t('Cancellation')}
            </button>
          ) : (
            <div className="space-y-3 max-w-md">
              {(canReturn || canExchange) && (
                <>
                  <label className="block">
                    Request type
                    <select
                      value={canReturn ? requestType : 'exchange'}
                      onChange={e => setRequestType(e.target.value as 'return' | 'exchange')}
                      className="border p-2 ml-2"
                    >
                      {canReturn && <option value="return">Return for refund</option>}
                      {canExchange && <option value="exchange">Size exchange</option>}
                    </select>
                  </label>
                  {order.items.map(item => (
                    <div className="border p-2" key={item.id}>
                      <label>
                        {item.product_name} ({item.size}) — Quantity
                        <input
                          aria-label={`Return quantity for ${item.product_name}`}
                          type="number"
                          min={0}
                          max={item.quantity - (item.returned_quantity ?? 0)}
                          value={selected[item.id]?.quantity ?? 0}
                          onChange={e =>
                            setSelected(prev => ({
                              ...prev,
                              [item.id]: {
                                replacementSize: prev[item.id]?.replacementSize ?? '',
                                quantity: Number(e.target.value),
                              },
                            }))
                          }
                          className="border p-1 w-16 ml-2"
                        />
                      </label>
                      {(requestType === 'exchange' || !canReturn) && (
                        <label className="block">
                          Replacement size
                          <select
                            aria-label={`Replacement size for ${item.product_name}`}
                            value={selected[item.id]?.replacementSize ?? ''}
                            onChange={e =>
                              setSelected(prev => ({
                                ...prev,
                                [item.id]: {
                                  quantity: prev[item.id]?.quantity ?? 0,
                                  replacementSize: e.target.value,
                                },
                              }))
                            }
                          >
                            <option value="">Choose size</option>
                            {['XS', 'S', 'M', 'L', 'XL', 'XXL']
                              .filter(size => size !== item.size)
                              .map(size => (
                                <option key={size}>{size}</option>
                              ))}
                          </select>
                        </label>
                      )}
                    </div>
                  ))}
                </>
              )}
              <textarea
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
                placeholder={t('Reason (10-1000 chars, e.g. wrong size)')}
                rows={3}
                className="w-full border border-navy/20 px-3 py-2 text-sm focus:outline-none focus:border-navy"
              />
              {returnError && <p className="text-xs text-red-600">{returnError}</p>}
              {returnStatus === 'success' && (
                <p className="text-xs text-green-600">
                  {t('Request submitted — admin will review within 24h.')}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    submitReturn(
                      canReturn || canExchange
                        ? canReturn
                          ? requestType
                          : 'exchange'
                        : 'cancellation',
                    )
                  }
                  disabled={returnStatus === 'loading'}
                  className="bg-navy text-white px-6 py-2 text-sm disabled:opacity-60 flex items-center gap-2"
                >
                  {returnStatus === 'loading' && <Loader2 size={14} className="animate-spin" />}{' '}
                  {t('Submit')}
                </button>
                <button
                  onClick={() => setShowReturn(false)}
                  className="px-4 py-2 text-sm text-navy/60"
                >
                  {t('Close')}
                </button>
              </div>
              <p className="text-[11px] text-navy/60">
                {t(
                  'Returns: within 7 days of delivery. Cancellations: placed/processing, 2 hours. One request per order.',
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </AccountLayout>
  );
}
