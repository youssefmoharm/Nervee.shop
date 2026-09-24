import { CheckCircle } from 'lucide-react';

import { FREE_SHIPPING_THRESHOLD } from '../lib/storeConfig';
import { formatEGP, formatNumber } from '../lib/format';
import { useI18n } from '../lib/i18n';

interface ShippingProgressBarProps {
  subtotal: number;
}

export default function ShippingProgressBar({ subtotal }: ShippingProgressBarProps) {
  const { t } = useI18n();
  const progress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const remaining = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);
  const qualifies = subtotal >= FREE_SHIPPING_THRESHOLD;

  return (
    <div className="bg-gradient-to-r from-navy/5 to-navy/10 border border-navy/10 p-4 md:p-6 rounded-lg space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="nv-eyebrow text-sm">
          {qualifies ? (
            <span className="flex items-center gap-2 text-green-700">
              <CheckCircle size={16} />
              {t('Free Shipping Qualified')}
            </span>
          ) : (
            <span>
              {t('Free Shipping at')} {formatEGP(FREE_SHIPPING_THRESHOLD)}
            </span>
          )}
        </h3>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="w-full bg-navy/10 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ease-out ${
              qualifies ? 'bg-green-600' : 'bg-navy'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Progress text */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-navy">
            {formatNumber((progress / 100) * FREE_SHIPPING_THRESHOLD)}
          </span>
          <span className="text-navy/50">{Math.round(progress)}%</span>
          <span className="font-medium text-navy">{formatNumber(FREE_SHIPPING_THRESHOLD)}</span>
        </div>
      </div>

      {/* Message */}
      <p className="text-xs text-navy/70 font-medium">
        {qualifies ? (
          t('✓ Your order qualifies for free shipping!')
        ) : (
          <>
            {t('Add')} {formatEGP(remaining)} {t('more for FREE shipping')}
          </>
        )}
      </p>

      {/* Info note */}
      <p className="text-xs text-navy/50 border-t border-navy/10 pt-3">
        {t('Applied to all orders within Egypt')}
      </p>
    </div>
  );
}
