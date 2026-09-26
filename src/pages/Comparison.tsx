import { Link, useNavigate } from 'react-router-dom';
import { useComparison } from '../hooks/useComparison';
import { ComparisonTable } from '../components/ComparisonModal';
import { ChevronRight } from 'lucide-react';
import { useSEO } from '../hooks/useSEO';
import { useI18n } from '../lib/i18n';

export default function Comparison() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { items, remove, clear } = useComparison();

  useSEO({
    title: 'Product Comparison — NERVE',
    description: 'Compare up to 3 NERVE products side-by-side and pick the best fit.',
    robots: 'noindex, follow',
  });

  return (
    <div className="min-h-screen bg-white pt-24 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <nav className="flex items-center gap-2 text-sm mb-8" aria-label="Breadcrumb">
          <Link to="/" className="text-navy/60 hover:text-navy transition-colors">
            {t('Home')}
          </Link>
          <ChevronRight size={16} className="text-navy/60" aria-hidden="true" />
          <span className="text-navy font-semibold">{t('Product Comparison')}</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-navy mb-2">
            {t('Product Comparison')}
          </h1>
          <p className="text-navy/70">
            {t('Compare up to 3 products side-by-side to make the best choice')}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="bg-mist rounded-lg p-8 md:p-12 text-center">
            <h2 className="text-xl font-semibold text-navy mb-2">{t('No Products to Compare')}</h2>
            <p className="text-navy/70 mb-6">
              {t('Start by adding products to your comparison from the shop')}
            </p>
            <Link
              to="/shop"
              className="inline-block bg-navy text-white px-6 py-3 rounded font-semibold hover:bg-navy-2 transition-colors"
            >
              {t('Continue Shopping')}
            </Link>
          </div>
        ) : (
          <ComparisonTable
            products={items}
            onRemove={remove}
            onClear={clear}
            onPrimaryAction={() => navigate('/shop')}
            primaryLabel={t('Continue Shopping')}
            inline
          />
        )}
      </div>
    </div>
  );
}
