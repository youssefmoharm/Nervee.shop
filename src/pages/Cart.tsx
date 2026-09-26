import { useEffect, useState } from 'react';
import { safeImageSrc } from '../lib/images';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Minus, Plus, ShieldCheck, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { productService } from '../services/productService';
import { discountService } from '../services/discountService';
import { useSEO } from '../lib/seo';
import { ecommerce } from '../lib/analytics';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../lib/i18n';
import { formatEGP } from '../lib/format';
import { loadCheckoutSession, saveCheckoutSession } from '../lib/checkoutSessionManager';
import { estimateShippingCost } from '../lib/checkout';
import type { Product } from '../types';
import ProductCard from '../components/ProductCard';
import ShippingProgressBar from '../components/ShippingProgressBar';
import EmptyState from '../components/EmptyState';

export default function Cart() {
  const { t } = useI18n();
  useSEO({
    title: 'Your Cart | NERVE',
    description:
      'Review the pieces in your NERVE cart. Cash on delivery across Egypt — no card needed.',
    robots: 'noindex, nofollow',
  });
  const { lines, removeLine, updateQuantity, subtotal } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [promo, setPromo] = useState('');
  const [promoStatus, setPromoStatus] = useState<'idle' | 'applied' | 'invalid'>('idle');
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [recommended, setRecommended] = useState<Product[]>([]);

  // Load session to get applied discount
  const session = loadCheckoutSession();
  const appliedDiscount = session?.appliedDiscount;
  const discountAmount = appliedDiscount
    ? discountService.calculateDiscount(appliedDiscount.discount, subtotal)
    : 0;

  useEffect(() => {
    if (lines.length > 0) {
      ecommerce.viewCart(subtotal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length]);

  useEffect(() => {
    productService
      .getBestSellers()
      .then(p => setRecommended(p.slice(0, 4)))
      .catch(error => {
        console.error('Failed to load recommended products:', error);
        setRecommended([]);
      });
  }, []);

  const applyPromo = async () => {
    if (!promo.trim()) {
      showToast(t('Please enter a discount code'), 'error', 3000);
      return;
    }
    if (applyingPromo) return;

    setApplyingPromo(true);
    try {
      const result = await discountService.validate(promo.trim(), subtotal);

      if (!result.valid || !result.discount) {
        showToast(result.error || t('Please check your code and try again'), 'error', 3000);
        setPromoStatus('invalid');
        return;
      }

      const amt = discountService.calculateDiscount(result.discount, subtotal);
      saveCheckoutSession({
        appliedDiscount: {
          code: result.discount.code,
          discount: result.discount,
        },
        promoCode: result.discount.code,
        discountAmount: amt,
      });
      setPromoStatus('applied');
      showToast(`${t('You saved')} ${formatEGP(amt)}`, 'success', 3000);
    } catch (error) {
      console.error('Failed to apply promo code:', error);
      showToast(t('Please check your code and try again'), 'error', 3000);
      setPromoStatus('invalid');
    } finally {
      setApplyingPromo(false);
    }
  };

  // Single source of truth: lib/checkout estimateShippingCost
  const shippingEstimate = estimateShippingCost(subtotal, 'standard');

  return (
    <div className="bg-white text-navy min-h-screen pt-24 md:pt-28 px-5 md:px-8 pb-24">
      <div className="mx-auto max-w-[1600px]">
        <h1 className="nv-heading text-4xl sm:text-5xl md:text-7xl mb-10">{t('Your Bag')}</h1>

        {lines.length === 0 ? (
          <EmptyState
            title={t('Your bag is empty')}
            body={t(
              'Browse the drop and add pieces you love — checkout is cash on delivery across Egypt.',
            )}
            actionLabel={t('Shop the Drop')}
            onAction={() => navigate('/shop')}
          />
        ) : (
          <div className="grid lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 divide-y divide-navy/10 border-y border-navy/10">
              {lines.map(line => (
                <div
                  key={`${line.productId}-${line.color}-${line.size}`}
                  data-testid="cart-item"
                  className="flex gap-4 sm:gap-5 py-6"
                >
                  <Link
                    to={`/product/${line.slug}`}
                    className="w-24 sm:w-28 h-28 sm:h-32 bg-mist flex-shrink-0 overflow-hidden"
                  >
                    <img
                      decoding="async"
                      loading="lazy"
                      src={safeImageSrc(line.image)}
                      alt={line.name}
                      className="w-full h-full object-cover"
                    />
                  </Link>
                  <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/product/${line.slug}`}
                        className="nv-edit font-semibold uppercase block truncate"
                      >
                        {line.name}
                      </Link>
                      <p className="text-sm text-navy/60 mt-1">
                        {line.color} / {line.size}
                      </p>
                      <p className="text-sm font-medium mt-2 sm:hidden">
                        {formatEGP(line.price * line.quantity)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                      <div className="flex items-center border border-navy/20">
                        <button
                          type="button"
                          aria-label={t('Decrease quantity')}
                          onClick={() =>
                            updateQuantity(line.productId, line.color, line.size, line.quantity - 1)
                          }
                          className="w-11 h-11 flex items-center justify-center hover:bg-mist text-navy/60 hover:text-navy"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="w-9 text-center text-sm">{line.quantity}</span>
                        <button
                          type="button"
                          aria-label={t('Increase quantity')}
                          onClick={() =>
                            updateQuantity(line.productId, line.color, line.size, line.quantity + 1)
                          }
                          className="w-11 h-11 flex items-center justify-center hover:bg-mist text-navy/60 hover:text-navy"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <span className="hidden sm:block text-sm font-medium w-24 text-right">
                        {formatEGP(line.price * line.quantity)}
                      </span>
                      <button
                        type="button"
                        aria-label={t('Remove item')}
                        onClick={() => removeLine(line.productId, line.color, line.size)}
                        className="text-navy/60 hover:text-navy transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-1 space-y-6">
              {/* Shipping Progress Bar */}
              <ShippingProgressBar subtotal={subtotal} />

              {/* Order Summary */}
              <div className="bg-mist/50 p-6 space-y-5">
                <h2 className="nv-eyebrow">{t('Order Summary')}</h2>

                <div className="flex gap-2">
                  <input
                    value={promo}
                    onChange={e => {
                      setPromo(e.target.value);
                      setPromoStatus('idle');
                    }}
                    placeholder={t('Discount code')}
                    aria-label={t('Discount code')}
                    data-testid="promo-input"
                    className="flex-1 border border-navy/20 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-navy"
                  />
                  <button
                    onClick={applyPromo}
                    data-testid="promo-apply"
                    disabled={applyingPromo}
                    className="px-4 border border-navy text-xs font-semibold uppercase hover:bg-navy hover:text-white transition-colors disabled:opacity-60 disabled:cursor-wait"
                  >
                    {applyingPromo ? t('Applying...') : t('Apply')}
                  </button>
                </div>
                {promoStatus === 'applied' && (
                  <p className="text-xs text-green-700">
                    {t('Code')} {promo.trim().toUpperCase()} {t('applied — you saved.')}
                  </p>
                )}
                {promoStatus === 'invalid' && (
                  <p className="text-xs text-red-600">{t('Invalid discount code.')}</p>
                )}

                <div className="space-y-2 pt-2 border-t border-navy/10 text-sm">
                  <div className="flex justify-between">
                    <span className="text-navy/60">{t('Subtotal')}</span>
                    <span>{formatEGP(subtotal)}</span>
                  </div>
                  {appliedDiscount && (
                    <div className="flex justify-between text-green-700">
                      <span>
                        {t('Discount')} ({appliedDiscount.code})
                      </span>
                      <span>- {formatEGP(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-navy/60">{t('Estimated Shipping')}</span>
                    <span>{shippingEstimate === 0 ? t('Free') : formatEGP(shippingEstimate)}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold pt-2 border-t border-navy/10">
                    <span>{t('Total')}</span>
                    <span>{formatEGP(subtotal + shippingEstimate - discountAmount)}</span>
                  </div>
                </div>

                <Link
                  to="/checkout"
                  data-testid="proceed-to-checkout"
                  className="block text-center bg-navy text-white nv-eyebrow py-4 hover:bg-navy-2 transition-colors active:bg-navy/90 w-full min-h-[56px] flex items-center justify-center"
                >
                  {t('Proceed to Checkout')}
                </Link>
                <p className="text-xs text-navy/60 leading-relaxed">
                  {t('Standard delivery')} 2–5 {t('business days')}.{' '}
                  <Link to="/shipping" className="underline hover:text-navy">
                    {t('Shipping details')}
                  </Link>
                </p>
                <p className="flex items-center justify-center gap-2 text-xs text-navy/60">
                  <Lock size={12} /> {t('Cash on delivery — pay the courier')}
                </p>
                <p className="flex items-center justify-center gap-2 text-xs text-navy/60">
                  <ShieldCheck size={12} />
                  <Link to="/returns" className="underline hover:text-navy">
                    {t('14-day returns on unworn items')}
                  </Link>
                </p>
                <p className="text-center text-xs text-navy/60">
                  <Link to="/faq" className="underline hover:text-navy">
                    {t('FAQ')}
                  </Link>
                  {' · '}
                  <Link to="/contact" className="underline hover:text-navy">
                    {t('Contact')}
                  </Link>
                </p>
              </div>
            </div>
          </div>
        )}

        {recommended.length > 0 && (
          <div className="mt-24">
            <h2 className="nv-heading text-3xl md:text-4xl mb-8">{t('You May Also Like')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-10">
              {recommended.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
