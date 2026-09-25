import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import type { Product, CartLine, Size } from '../types';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { FREE_SHIPPING_THRESHOLD } from '../lib/storeConfig';
import { discountService } from '../services/discountService';
import { saveCheckoutSession, loadCheckoutSession } from '../lib/checkoutSessionManager';
import { formatEGP } from '../lib/format';
import { useI18n } from '../lib/i18n';

const BUNDLE_DISCOUNT_PERCENT = 10;
/** Seeded in migration 033 — server re-validates it in place_order. */
const BUNDLE_DISCOUNT_CODE = 'BUNDLE10';

interface CompleteTheLookProps {
  mainProduct: Product;
  suggestedItems: Product[];
}

export default function CompleteTheLook({ mainProduct, suggestedItems }: CompleteTheLookProps) {
  const { t } = useI18n();
  const { addLine } = useCart();
  const { showToast } = useToast();
  const [selectedItems, setSelectedItems] = useState<string[]>([mainProduct.id]);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, Size>>({});

  if (suggestedItems.length < 2) {
    return null;
  }

  const bundleItems = [mainProduct, ...suggestedItems.filter(p => selectedItems.includes(p.id))];

  const discountedUnitPrice = (price: number) =>
    Math.round(price * (1 - BUNDLE_DISCOUNT_PERCENT / 100));

  const regularTotal = bundleItems.reduce((sum, p) => sum + p.price, 0);
  const discountedTotal = bundleItems.reduce((sum, p) => sum + discountedUnitPrice(p.price), 0);
  const discountAmount = regularTotal - discountedTotal;
  const bundlePrice = discountedTotal;

  const needsSizeSelection = (p: Product) => p.sizes.some(s => s.inStock);
  const allSizesSelected = bundleItems.every(p => !needsSizeSelection(p) || !!selectedSizes[p.id]);

  const handleSelectItem = (productId: string) => {
    setSelectedItems(prev => {
      if (productId === mainProduct.id) return prev;
      return prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId];
    });
  };

  const handleAddBundle = () => {
    const missingSize = bundleItems.some(p => needsSizeSelection(p) && !selectedSizes[p.id]);

    if (missingSize) {
      showToast(t('Please select a size for all items'), 'error', 2000);
      return;
    }

    let added = 0;
    bundleItems.forEach(product => {
      const size = selectedSizes[product.id];
      if (!size && needsSizeSelection(product)) return;
      if (!size && !needsSizeSelection(product)) {
        // Sizeless product: use first listed size when available
        const fallback = product.sizes[0]?.size;
        if (!fallback) return;
        addLine(buildLine(product, fallback));
        added += 1;
        return;
      }
      addLine(buildLine(product, size));
      added += 1;
    });

    if (added === 0) {
      showToast(t('Could not add bundle. Please try again.'), 'error', 2000);
      return;
    }

    // Apply the advertised 10% as a real discount code so the server-side
    // place_order re-pricing honors it (cart line prices are ignored).
    void applyBundleDiscount(bundleItems.reduce((sum, p) => sum + p.price, 0));

    showToast(
      `${t('Bundle added!')} ${BUNDLE_DISCOUNT_PERCENT}% ${t(
        'off applied with',
      )} ${BUNDLE_DISCOUNT_CODE} — ${t('you saved')} ${formatEGP(discountAmount)}`,
      'success',
      3000,
    );
  };

  const applyBundleDiscount = async (bundleSubtotal: number) => {
    try {
      const existing = loadCheckoutSession();
      if (existing?.appliedDiscount?.code === BUNDLE_DISCOUNT_CODE) return;

      const result = await discountService.validate(BUNDLE_DISCOUNT_CODE, bundleSubtotal);
      if (!result.valid || !result.discount) {
        console.warn('BUNDLE10 validation failed:', result.error);
        return;
      }
      const amt = discountService.calculateDiscount(result.discount, bundleSubtotal);
      saveCheckoutSession({
        appliedDiscount: { code: result.discount.code, discount: result.discount },
        promoCode: result.discount.code,
        discountAmount: amt,
      });
    } catch (err) {
      console.warn('Could not apply bundle discount:', err);
    }
  };

  function buildLine(product: Product, size: Size): CartLine {
    const color = product.colors[0];
    return {
      productId: product.id,
      name: product.name,
      slug: product.slug,
      image: color.image,
      price: product.price,
      color: color.name,
      size,
      quantity: 1,
    };
  }

  return (
    <div className="mt-20 pt-12 border-t border-navy/10">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <h2 className="nv-heading text-2xl md:text-3xl mb-8">{t('Complete the Look')}</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Main Product */}
          <div className="space-y-3">
            <div className="aspect-[4/5] bg-mist rounded-lg overflow-hidden">
              <img
                src={mainProduct.colors[0].image}
                alt={mainProduct.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="nv-edit text-xs font-semibold uppercase">{mainProduct.name}</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="nv-edit text-sm font-bold">
                  {formatEGP(discountedUnitPrice(mainProduct.price))}
                </p>
                <p className="text-xs text-navy/60 line-through">{formatEGP(mainProduct.price)}</p>
              </div>
            </div>
            {mainProduct.sizes.some(s => s.inStock) && (
              <div className="mt-3">
                <label
                  htmlFor={`size-${mainProduct.id}`}
                  className="text-xs text-navy/60 mb-2 block"
                >
                  {t('Size')}
                </label>
                <select
                  id={`size-${mainProduct.id}`}
                  value={selectedSizes[mainProduct.id] || ''}
                  onChange={e =>
                    setSelectedSizes(prev => ({
                      ...prev,
                      [mainProduct.id]: e.target.value as Size,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm border border-navy/20 rounded focus:outline-none focus:border-navy"
                >
                  <option value="">{t('Select size')}</option>
                  {mainProduct.sizes
                    .filter(s => s.inStock)
                    .map(s => (
                      <option key={s.size} value={s.size}>
                        {s.size}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Suggested Items */}
          {suggestedItems.slice(0, 2).map(item => {
            const isSelected = selectedItems.includes(item.id);
            return (
              <div
                key={item.id}
                className="space-y-3 opacity-75 hover:opacity-100 transition-opacity"
              >
                <div className="relative">
                  <div className="aspect-[4/5] bg-mist rounded-lg overflow-hidden">
                    <img
                      src={item.colors[0].image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={() => handleSelectItem(item.id)}
                    className="absolute top-2 end-2 w-6 h-6 rounded-full bg-navy text-white flex items-center justify-center hover:scale-110 transition-transform"
                    aria-label={isSelected ? t('Remove from bundle') : t('Add to bundle')}
                  >
                    {isSelected ? '✓' : '+'}
                  </button>
                </div>
                <div>
                  <p className="nv-edit text-xs font-semibold uppercase">{item.name}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="nv-edit text-sm font-bold">
                      {formatEGP(discountedUnitPrice(item.price))}
                    </p>
                    <p className="text-xs text-navy/60 line-through">{formatEGP(item.price)}</p>
                  </div>
                </div>
                {isSelected && item.sizes.some(s => s.inStock) && (
                  <div className="mt-3">
                    <label htmlFor={`size-${item.id}`} className="text-xs text-navy/60 mb-2 block">
                      {t('Size')}
                    </label>
                    <select
                      id={`size-${item.id}`}
                      value={selectedSizes[item.id] || ''}
                      onChange={e =>
                        setSelectedSizes(prev => ({
                          ...prev,
                          [item.id]: e.target.value as Size,
                        }))
                      }
                      className="w-full px-3 py-2 text-sm border border-navy/20 rounded focus:outline-none focus:border-navy"
                    >
                      <option value="">{t('Select size')}</option>
                      {item.sizes
                        .filter(s => s.inStock)
                        .map(s => (
                          <option key={s.size} value={s.size}>
                            {s.size}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bundle Summary */}
        <div className="bg-navy/5 rounded-lg p-6 md:p-8 mb-8">
          <div className="max-w-md">
            <h3 className="nv-heading text-xl mb-4">{t('Bundle Summary')}</h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-navy/70">{t('Regular price')}:</span>
                <span className="font-semibold">{formatEGP(regularTotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600">
                <span>
                  {t('Save')} {BUNDLE_DISCOUNT_PERCENT}% {t('on bundle')}:
                </span>
                <span className="font-semibold">- {formatEGP(discountAmount)}</span>
              </div>
              <div className="border-t border-navy/10 pt-3 flex justify-between">
                <span className="font-semibold">{t('Bundle Price')}:</span>
                <span className="nv-heading text-xl">{formatEGP(bundlePrice)}</span>
              </div>
            </div>

            <button
              onClick={handleAddBundle}
              disabled={!allSizesSelected}
              className="w-full bg-navy text-white nv-eyebrow py-3 rounded-lg hover:bg-navy-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <ShoppingBag size={18} />
              {t('Add Bundle to Bag')}
            </button>
            <p className="text-xs text-navy/60 mt-3 text-center">
              {t('Free shipping on orders over')} {formatEGP(FREE_SHIPPING_THRESHOLD)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
