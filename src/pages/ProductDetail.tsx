import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Heart, Loader2, Minus, Plus, RotateCcw, Ruler, Truck, Star } from 'lucide-react';
import type { Product, Size, ProductReview } from '../types';
import { productService } from '../services/productService';
import { backInStockService } from '../services/backInStockService';
import { reviewService } from '../services/reviewService';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import { useSEO, useStructuredData } from '../lib/seo';
import ProductCard from '../components/ProductCard';
import SizeGuideModal from '../components/SizeGuideModal';
import Skeleton from '../components/Skeleton';

type Tab = 'description' | 'size' | 'shipping';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addLine, openCart } = useCart();
  const { toggle, has } = useWishlist();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [colorIdx, setColorIdx] = useState(0);
  const [size, setSize] = useState<Size | null>(null);
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [tab, setTab] = useState<Tab>('description');
  const [sizeError, setSizeError] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [notifySize, setNotifySize] = useState<Size | null>(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifyStatus, setNotifyStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewStats, setReviewStats] = useState({ reviewCount: 0, averageRating: 0 });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);

  useSEO({
    title: product ? `${product.name} | NERVE` : 'NERVE — Cool but Chic',
    description: product
      ? product.description
      : 'A contemporary Egyptian concept store. Cool but chic. EST 2026.',
    type: product ? 'product' : 'website',
    price: product?.price,
    currency: product ? 'EGP' : undefined,
    brand: 'NERVE',
    availability: product && product.sizes.some(s => s.inStock) ? 'InStock' : 'OutOfStock',
  });

  useStructuredData(
    product
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: product.description,
          image:
            product.gallery.length > 0
              ? product.gallery
              : [product.colors[0]?.image].filter(Boolean),
          brand: { '@type': 'Brand', name: 'NERVE' },
          offers: {
            '@type': 'Offer',
            price: product.price,
            priceCurrency: 'EGP',
            availability: product.sizes.some(s => s.inStock)
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            seller: { '@type': 'Organization', name: 'NERVE' },
          },
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'NERVE',
          url: 'https://nerve-store.com',
        },
    'product-structured-data',
  );

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    setLoading(true);
    setColorIdx(0);
    setSize(null);
    setActiveImage(0);
    setNotifySize(null);
    setNotifyStatus('idle');
    productService.getBySlug(slug).then(async p => {
      if (!mounted) return;
      if (!p) {
        setProduct(null);
        setLoading(false);
        return;
      }
      setProduct(p);
      const rel = await productService.getRelated(p);
      if (mounted) setRelated(rel);
      const reviewData = await reviewService.getByProduct(p.id);
      if (reviewData.reviews) setReviews(reviewData.reviews);
      const statsData = await reviewService.getStats(p.id);
      if (statsData.stats) setReviewStats(statsData.stats);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!product) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setActiveImage(i => (i - 1 + product.gallery.length) % product.gallery.length);
      } else if (e.key === 'ArrowRight') {
        setActiveImage(i => (i + 1) % product.gallery.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [product]);

  if (loading) {
    return (
      <div className="bg-white min-h-screen pt-24 md:pt-28 px-5 md:px-8">
        <div className="mx-auto max-w-[1600px] grid md:grid-cols-2 gap-10">
          <div className="space-y-3">
            <Skeleton className="aspect-[4/5] w-full" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          </div>
          <div className="space-y-5 pt-4">
            <Skeleton variant="text" count={1} height="h-8" />
            <Skeleton variant="text" count={1} height="h-5" />
            <Skeleton className="h-24 w-full" />
            <div className="space-y-3">
              <Skeleton variant="text" count={3} height="h-3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-white text-navy min-h-screen pt-32 px-5 text-center">
        <h1 className="nv-heading text-4xl mb-4">Product Not Found</h1>
        <button onClick={() => navigate('/shop')} className="nv-eyebrow underline">
          Back to Shop
        </button>
      </div>
    );
  }

  const color = product.colors[colorIdx];
  const wished = has(product.id);

  const handleAddToBag = () => {
    if (!size) {
      setSizeError(true);
      return;
    }
    addLine({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      image: color.image,
      price: product.price,
      color: color.name,
      size,
      quantity: qty,
    });
  };

  const handleBuyNow = () => {
    if (!size) {
      setSizeError(true);
      return;
    }
    handleAddToBag();
    openCart();
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmittingReview(true);
    const result = await reviewService.create({
      productId: product.id,
      rating: reviewForm.rating,
      title: reviewForm.title,
      comment: reviewForm.comment,
    });
    if (result.success) {
      setReviews([...reviews, result.review!]);
      setReviewForm({ rating: 5, title: '', comment: '' });
      setShowReviewForm(false);
      showToast('Review submitted successfully', 'success', 2000);
    } else {
      showToast(result.error || 'Failed to submit review', 'error', 3000);
    }
    setSubmittingReview(false);
  };

  const getAverageRating = (reviewList: ProductReview[]) => {
    if (reviewList.length === 0) return 0;
    const sum = reviewList.reduce((acc, r) => acc + r.rating, 0);
    return (sum / reviewList.length).toFixed(1);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={14}
        className={
          i < rating
            ? 'fill-navy text-navy'
            : i < Math.ceil(rating)
            ? 'fill-navy text-navy/50'
            : 'text-navy/20'
        }
      />
    ));
  };

  return (
    <div className="bg-white text-navy min-h-screen pt-24 md:pt-28">
      <div className="mx-auto max-w-[1600px] px-5 md:px-8 pb-24">
        <div className="grid md:grid-cols-2 gap-8 md:gap-14">
          <div>
            <div className="aspect-[4/5] bg-mist overflow-hidden mb-3">
              <img
                src={product.gallery[activeImage] || color.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {product.gallery.map((g, i) => (
                <button
                  key={g + i}
                  onClick={() => setActiveImage(i)}
                  className="aspect-square bg-mist overflow-hidden border-2 transition-colors"
                >
                  <img src={g} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div className="md:pt-2">
            {product.badge && (
              <span className="inline-block bg-navy text-white text-[10px] font-semibold tracking-widest2 uppercase px-2.5 py-1 mb-3">
                {product.badge}
              </span>
            )}
            <h1 className="nv-heading text-4xl md:text-5xl">{product.name}</h1>
            <div className="flex items-center gap-3 mt-3">
              <span className="text-xl font-medium">EGP {product.price.toLocaleString()}</span>
              {product.compareAtPrice && (
                <span className="text-lg text-navy/40 line-through">
                  EGP {product.compareAtPrice.toLocaleString()}
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-navy/70">
              <span className="rounded-full bg-mist px-3 py-1">Secure checkout</span>
              <span className="rounded-full bg-mist px-3 py-1">Free delivery over EGP 2,000</span>
              <span className="rounded-full bg-mist px-3 py-1">30-day easy returns</span>
            </div>

            <div className="mt-8">
              <p className="nv-eyebrow text-navy/60 mb-3">Color: {color.name}</p>
              <div className="flex gap-2">
                {product.colors.map((c, i) => (
                  <button
                    key={c.name}
                    onClick={() => {
                      setColorIdx(i);
                      setActiveImage(0);
                    }}
                    aria-label={`Choose ${c.name}`}
                    aria-pressed={i === colorIdx}
                    data-testid="color-option"
                    className="w-10 h-10 rounded-full border-2 transition-all"
                    style={{
                      boxShadow:
                        i === colorIdx
                          ? 'inset 0 0 0 2px rgba(10,10,40,0.4)'
                          : 'inset 0 0 0 1px rgba(10,10,40,0.1)',
                    }}
                  >
                    <span
                      className="block w-full h-full rounded-full"
                      style={{ backgroundColor: c.hex }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <p className="nv-eyebrow text-navy/60">Size{size ? `: ${size}` : ''}</p>
                <button
                  onClick={() => setSizeGuideOpen(true)}
                  className="text-xs underline text-navy/50"
                >
                  Size Guide
                </button>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {product.sizes.map(s => (
                  <button
                    key={s.size}
                    aria-pressed={size === s.size}
                    aria-label={`${s.size} size option`}
                    data-testid="size-option"
                    onClick={() => {
                      if (s.inStock) {
                        setSize(s.size);
                        setSizeError(false);
                        setNotifySize(null);
                      } else {
                        setNotifySize(s.size);
                        setNotifyStatus('idle');
                      }
                    }}
                    className="h-11 text-sm border transition-colors"
                  >
                    {s.size}
                  </button>
                ))}
              </div>
              {sizeError && <p className="text-xs text-red-600 mt-2">Please select a size.</p>}
              {product.fitNotes && <p className="text-xs text-navy/50 mt-2">{product.fitNotes}</p>}

              {notifySize && (
                <div className="mt-4 border border-navy/15 p-4">
                  {notifyStatus === 'done' ? (
                    <p className="text-sm">
                      We&apos;ll email you the moment <strong>{notifySize}</strong> is back.
                    </p>
                  ) : (
                    <form
                      onSubmit={async e => {
                        e.preventDefault();
                        setNotifyStatus('loading');
                        const { error } = await backInStockService.request(
                          product.id,
                          notifySize,
                          notifyEmail,
                        );
                        setNotifyStatus(error ? 'error' : 'done');
                      }}
                      className="space-y-2"
                    >
                      <p className="text-sm">
                        Size <strong>{notifySize}</strong> is out of stock. Get an email when
                        it&apos;s back:
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          required
                          value={notifyEmail}
                          onChange={e => setNotifyEmail(e.target.value)}
                          placeholder="you@email.com"
                          className="flex-1 border border-navy/20 px-3 py-2.5 text-sm focus:outline-none focus:border-navy"
                        />
                        <button
                          type="submit"
                          disabled={notifyStatus === 'loading'}
                          className="bg-navy text-white nv-eyebrow px-5 text-xs disabled:opacity-60 flex items-center gap-1.5"
                        >
                          {notifyStatus === 'loading' && (
                            <Loader2 size={13} className="animate-spin" />
                          )}
                          Notify Me
                        </button>
                      </div>
                      {notifyStatus === 'error' && (
                        <p className="text-xs text-red-600">
                          Something went wrong. Please try again.
                        </p>
                      )}
                    </form>
                  )}
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-3">
              <div className="flex items-center border border-navy/25">
                <button
                  aria-label="Decrease quantity"
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-11 h-14 flex items-center justify-center hover:bg-mist"
                >
                  <Minus size={14} />
                </button>
                <span className="w-10 text-center">{qty}</span>
                <button
                  aria-label="Increase quantity"
                  onClick={() => setQty(q => q + 1)}
                  className="w-11 h-14 flex items-center justify-center hover:bg-mist"
                >
                  <Plus size={14} />
                </button>
              </div>
              <button
                onClick={handleAddToBag}
                data-testid="add-to-bag-button"
                className="flex-1 bg-navy text-white nv-eyebrow py-4 hover:bg-navy-2 transition-colors"
              >
                Add to Bag
              </button>
              <button
                aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
                onClick={() => {
                  toggle({
                    productId: product.id,
                    name: product.name,
                    slug: product.slug,
                    image: color.image,
                    price: product.price,
                  });
                  showToast(
                    wished ? 'Removed from wishlist' : 'Added to wishlist',
                    'success',
                    2000,
                  );
                }}
                className="w-14 h-14 border border-navy/25 flex items-center justify-center hover:border-navy transition-colors flex-shrink-0"
              >
                <Heart size={18} className={wished ? 'fill-navy text-navy' : 'text-navy'} />
              </button>
            </div>
            <button
              onClick={handleBuyNow}
              data-testid="buy-now-button"
              className="mt-3 w-full border border-navy nv-eyebrow py-4 hover:bg-navy hover:text-white transition-colors"
            >
              Buy Now
            </button>

            {/* Tabs */}
            <div className="mt-10 border-t border-navy/10">
              {(
                [
                  ['description', 'Description & Material'],
                  ['size', 'Size Guide'],
                  ['shipping', 'Shipping & Returns'],
                ] as [Tab, string][]
              ).map(([key, label]) => (
                <div key={key} className="border-b border-navy/10">
                  <button
                    onClick={() => setTab(tab === key ? ('' as Tab) : key)}
                    aria-expanded={tab === key}
                    className="w-full flex items-center justify-between py-4 text-left"
                  >
                    <span className="nv-edit font-semibold text-sm uppercase">{label}</span>
                    <span className="text-lg">{tab === key ? '-' : '+'}</span>
                  </button>
                  {tab === key && (
                    <div className="pb-5 text-sm text-navy/70 leading-relaxed space-y-3">
                      {key === 'description' && (
                        <>
                          <p>{product.description}</p>
                          <p>
                            <span className="font-medium text-navy">Material:</span>{' '}
                            {product.material}
                          </p>
                          <div>
                            <p className="font-medium text-navy mb-1">Care Instructions:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                              {product.care.map(c => (
                                <li key={c}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        </>
                      )}
                      {key === 'size' && (
                        <div className="flex items-start gap-2">
                          <Ruler size={16} className="mt-0.5 flex-shrink-0" />
                          <p>
                            NERVE fits true to size unless noted. If between sizes, size up for an
                            oversized look or down for a fitted silhouette.
                          </p>
                        </div>
                      )}
                      {key === 'shipping' && (
                        <div className="space-y-3">
                          <div className="flex items-start gap-2">
                            <Truck size={16} className="mt-0.5 flex-shrink-0" />
                            <p>Standard delivery in 2-5 business days across Egypt.</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <RotateCcw size={16} className="mt-0.5 flex-shrink-0" />
                            <p>Free returns within 14 days of delivery on unworn items.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Reviews Section */}
            <div className="mt-10 border-t border-navy/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="nv-heading text-xl">Customer Reviews</h2>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">{getAverageRating(reviews)}</span>
                  <div className="flex">{renderStars(reviewStats.averageRating)}</div>
                  <span className="text-sm text-navy/60">({reviewStats.reviewCount} reviews)</span>
                </div>
              </div>

              {/* Review Form */}
              {user ? (
                <div className="mb-6">
                  {!showReviewForm ? (
                    <button
                      onClick={() => setShowReviewForm(true)}
                      className="bg-navy text-white nv-eyebrow px-4 py-2 rounded-lg hover:bg-navy-2 transition-colors"
                    >
                      Write a Review
                    </button>
                  ) : (
                    <div className="bg-mist/50 p-4 rounded-lg">
                      <form onSubmit={handleReviewSubmit} className="space-y-3">
                        <div>
                          <label
                            htmlFor="review-rating"
                            className="text-xs font-medium text-navy/60 mb-1 block"
                          >
                            Rating
                          </label>
                          <div className="flex gap-1" id="review-rating">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setReviewForm({ ...reviewForm, rating: i + 1 })}
                                className="focus:outline-none"
                              >
                                <Star
                                  size={24}
                                  className={
                                    i < reviewForm.rating ? 'fill-navy text-navy' : 'text-navy/20'
                                  }
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label
                            htmlFor="review-title"
                            className="text-xs font-medium text-navy/60 mb-1 block"
                          >
                            Title
                          </label>
                          <input
                            id="review-title"
                            type="text"
                            required
                            value={reviewForm.title}
                            onChange={e => setReviewForm({ ...reviewForm, title: e.target.value })}
                            className="w-full border border-navy/20 px-3 py-2 text-sm focus:outline-none focus:border-navy"
                            placeholder="Short summary"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="review-comment"
                            className="text-xs font-medium text-navy/60 mb-1 block"
                          >
                            Comment
                          </label>
                          <textarea
                            id="review-comment"
                            value={reviewForm.comment}
                            onChange={e =>
                              setReviewForm({ ...reviewForm, comment: e.target.value })
                            }
                            className="w-full border border-navy/20 px-3 py-2 text-sm focus:outline-none focus:border-navy"
                            placeholder="Share your thoughts"
                            rows={3}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={submittingReview}
                            className="flex-1 bg-navy text-white nv-eyebrow py-2 rounded-lg disabled:opacity-60"
                          >
                            {submittingReview ? 'Submitting...' : 'Submit Review'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowReviewForm(false)}
                            className="px-4 py-2 text-sm text-navy hover:text-navy-2"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-navy/50 mb-4">
                  Please{' '}
                  <a href="/login" className="text-navy underline">
                    sign in
                  </a>{' '}
                  to write a review.
                </p>
              )}

              {/* Review List */}
              {reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map(review => (
                    <div key={review.id} className="border-b border-navy/10 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex">{renderStars(review.rating)}</div>
                        {review.verified && (
                          <span className="inline-block bg-green-100 text-green-600 text-[10px] px-2 py-0.5 rounded-full">
                            Verified
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-sm mb-1">{review.title}</p>
                      <p className="text-sm text-navy/60">{review.comment}</p>
                      <p className="text-xs text-navy/40 mt-1">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-navy/50">No reviews yet. Be the first to review!</p>
              )}
            </div>
          </div>
        </div>

        {/* Recommended */}
        {related.length > 0 && (
          <div className="mt-24">
            <h2 className="nv-heading text-3xl md:text-4xl mb-8">You May Also Like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-10">
              {related.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/10 bg-white/95 p-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <button
            onClick={handleAddToBag}
            className="flex-1 rounded-full bg-navy px-4 py-3 text-sm font-semibold text-white"
          >
            Add to Bag
          </button>
          <button
            onClick={handleBuyNow}
            className="flex-1 rounded-full border border-navy px-4 py-3 text-sm font-semibold text-navy"
          >
            Buy Now
          </button>
        </div>
      </div>
      {sizeGuideOpen && <SizeGuideModal onClose={() => setSizeGuideOpen(false)} />}
    </div>
  );
}
