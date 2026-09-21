import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { productService } from '../services/productService';
import { withTryOnConfig } from '../lib/tryOnConfig';
import type { Product } from '../types';
import TryOnExperience from '../components/TryOnExperience';
import Skeleton from '../components/Skeleton';

/**
 * /ar/:slug — QR destination page.
 *
 * Scanning the QR opens THIS page for the scanned product's slug; the lens
 * config is re-resolved from the product here, so a QR can never open the
 * wrong product's lens. Standalone layout (no storefront chrome) keeps the
 * camera view large and fast on phones.
 */
export default function ARTryOnPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await productService.getBySlug(slug ?? '');
      if (cancelled) return;
      setProduct(raw ? withTryOnConfig(raw) : null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Skeleton className="h-8 w-2/3 mb-3" />
          <Skeleton className="h-4 w-1/2 mb-8" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center p-6">
        <h1 className="nv-heading text-3xl mb-3">Product not found</h1>
        <p className="nv-edit text-sm text-navy/60 mb-6">
          This AR link doesn&apos;t match a product in our store.
        </p>
        <Link to="/" className="nv-eyebrow underline text-sm">
          Back to NERVE
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Minimal header */}
      <div className="border-b border-navy/10">
        <div className="max-w-md mx-auto w-full px-4 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/product/${product.slug}`)}
            aria-label="Back to product"
            className="p-1.5 -ml-1.5 hover:bg-mist transition-colors"
          >
            <ChevronLeft size={20} className="text-navy" />
          </button>
          <span className="nv-eyebrow text-xs">NERVE — Virtual Try-On</span>
        </div>
      </div>

      {/* Experience */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-6 flex flex-col">
        <TryOnExperience product={product} onClose={() => navigate(`/product/${product.slug}`)} />
      </main>

      {/* Footer product link — lets the user continue shopping after trying on. */}
      <div className="border-t border-navy/10">
        <div className="max-w-md mx-auto px-4 py-4 text-center">
          <Link
            to={`/product/${product.slug}`}
            className="inline-block bg-navy text-white nv-eyebrow px-8 py-3.5 hover:bg-navy-2 transition-colors"
          >
            Back to {product.name}
          </Link>
        </div>
      </div>
    </div>
  );
}
