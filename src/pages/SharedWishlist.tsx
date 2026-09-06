import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSharedWishlist } from '../services/wishlistShareService';
import { productService } from '../services/productService';
import ProductCard from '../components/ProductCard';
import type { Product } from '../types';

export default function SharedWishlist() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!shareCode) return;

    const shared = getSharedWishlist(shareCode);
    if (!shared) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setMessage(shared.message);

    // Load products by slug instead of ID
    Promise.all(
      shared.items.map(async slug => {
        try {
          return await productService.getBySlug(slug);
        } catch {
          return undefined;
        }
      }),
    )
      .then(products => {
        setWishlistProducts(products.filter((p): p is Product => p !== undefined));
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [shareCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin mx-auto mb-4" />
          <p className="text-navy/60">Loading wishlist...</p>
        </div>
      </div>
    );
  }

  if (notFound || wishlistProducts.length === 0) {
    return (
      <div className="min-h-screen bg-white pt-24">
        <div className="max-w-4xl mx-auto px-4 md:px-8 text-center py-12">
          <h1 className="nv-heading text-3xl md:text-4xl mb-3">Wishlist Not Found</h1>
          <p className="text-navy/70 mb-6">This wishlist has expired or is no longer available.</p>
          <Link
            to="/shop"
            className="inline-block bg-navy text-white px-6 py-3 rounded font-semibold hover:bg-navy-2 transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-8">
          <Link to="/" className="text-navy/60 hover:text-navy transition-colors">
            Home
          </Link>
          <ChevronRight size={16} className="text-navy/40" />
          <span className="text-navy font-semibold">Shared Wishlist</span>
        </nav>

        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="nv-heading text-3xl md:text-4xl mb-2">Someone&apos;s NERVE Wishlist</h1>
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
          <h2 className="nv-heading text-2xl mb-2">Like what you see?</h2>
          <p className="text-navy/70 mb-6">Start building your own NERVE wishlist</p>
          <Link
            to="/shop"
            className="inline-block bg-navy text-white px-6 py-3 rounded font-semibold hover:bg-navy-2 transition-colors"
          >
            Explore NERVE
          </Link>
        </div>
      </div>
    </div>
  );
}
