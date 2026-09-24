import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getShare } from '../services/wishlistShareService';
import { productService } from '../services/productService';
import ProductCard from '../components/ProductCard';
import { useSEO } from '../hooks/useSEO';
import type { Product } from '../types';
import { useI18n } from '../lib/i18n';

export default function SharedWishlist() {
  const { t } = useI18n();
  const { shareCode } = useParams<{ shareCode: string }>();
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useSEO({
    title: 'Shared Wishlist — NERVE',
    description:
      'A curated wishlist shared from NERVE. Shop the selected pieces before they sell out.',
    robots: 'noindex, follow',
  });

  useEffect(() => {
    if (!shareCode) return;

    let cancelled = false;

    (async () => {
      const result = await getShare(shareCode);
      if (cancelled) return;

      if ('error' in result) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const shared = result.share;
      if (!shared) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setMessage(shared.message);

      try {
        const products = await Promise.all(
          shared.items.map(async slug => {
            try {
              return await productService.getBySlug(slug);
            } catch {
              return undefined;
            }
          }),
        );
        if (cancelled) return;
        setWishlistProducts(products.filter((p): p is Product => p !== undefined));
      } catch {
        if (cancelled) return;
        setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shareCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-navy flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin mx-auto mb-4" />
          <p className="text-navy/60">{t('Loading wishlist...')}</p>
        </div>
      </div>
    );
  }

  if (notFound || wishlistProducts.length === 0) {
    return (
      <div className="min-h-screen bg-white text-navy pt-24">
        <div className="max-w-4xl mx-auto px-4 md:px-8 text-center py-12">
          <h1 className="nv-heading text-3xl md:text-4xl mb-3">{t('Wishlist Not Found')}</h1>
          <p className="text-navy/70 mb-6">
            {t('This wishlist has expired or is no longer available.')}
          </p>
          <Link
            to="/shop"
            className="inline-block bg-navy text-white px-6 py-3 rounded font-semibold hover:bg-navy-2 transition-colors"
          >
            {t('Continue Shopping')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-navy">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-8">
          <Link to="/" className="text-navy/60 hover:text-navy transition-colors">
            {t('Home')}
          </Link>
          <ChevronRight size={16} className="text-navy/40" />
          <span className="text-navy font-semibold">{t('Shared Wishlist')}</span>
        </nav>

        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="nv-heading text-3xl md:text-4xl mb-2">{t("Someone's NERVE Wishlist")}</h1>
          {message && (
            <p className="text-lg text-navy/70 italic max-w-2xl mx-auto">&ldquo;{message}&rdquo;</p>
          )}
          <p className="text-sm text-navy/60 mt-4">
            {wishlistProducts.length} item{wishlistProducts.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10 mb-12">
          {wishlistProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* CTA */}
        <div className="bg-mist rounded-lg p-8 text-center">
          <h2 className="nv-heading text-2xl mb-2">{t('Like what you see?')}</h2>
          <p className="text-navy/70 mb-6">{t('Start building your own NERVE wishlist')}</p>
          <Link
            to="/shop"
            className="inline-block bg-navy text-white px-6 py-3 rounded font-semibold hover:bg-navy-2 transition-colors"
          >
            {t('Explore NERVE')}
          </Link>
        </div>
      </div>
    </div>
  );
}
