import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Heart, Loader2, Minus, Plus, RotateCcw, Ruler, Truck, Star, ZoomIn, Info } from 'lucide-react';
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

type Tab = 'description' | 'size' | 'shipping' | 'reviews';

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
  const [zoomOpen, setZoomOpen] = useState(false);
  const [notifySize, setNotifySize] = useState<Size | null>(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifyStatus, setNotifyStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewStats, setReviewStats] = useState({ reviewCount: 0, averageRating: 0 });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);

  const zoomRef = useRef<HTMLButtonElement>(null);

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
        url: 'https://nerveey.shop',
        sameAs: [
          'https://www.instagram.com/gothennerve58/',
          'https://www.tiktok.com/@user795916160817',
          'https://www.linkedin.com/in/nerve-shop-b67623429',
        ],
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
  const inStock = product.sizes.some(s => s.inStock);

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

  const faqs = [
    {
      question: 'How do I know my size?',
      answer: 'Our fits run true to size. If you are between sizes, we recommend sizing up for a looser fit or down for a more fitted look. Check our Size Guide for detailed measurements.',
    },
    {
      question: 'What is your return policy?',
      answer: 'We offer free returns within 14 days of delivery on all unworn items with tags attached.',
    },
    {
      question: 'Do you offer international shipping?',
      answer: 'Currently, we ship to all governorates within Egypt. International shipping is coming soon.',
    },
    {
      question: 'How can I track my order?',
      answer: 'Once your order ships, you will receive an email with tracking information. You can also track your order on our website using your order number.',
    },
  ];

  return (
    <div className="bg-white text-navy min-h-screen pt-24 md:pt-28">
      <div className="mx-auto max-w-[1600px] px-5 md:px-8 pb-24">
        <div className="grid md:grid-cols-2 gap-8 md:gap-14">
          {/* Gallery Section */}
          <div>
            <div className="aspect-[4/5] bg-mist overflow-hidden mb-3 relative group cursor-zoom-in">
              <button
                ref={zoomRef}
                onClick={() => setZoomOpen(true)}
                className="w-full h-full relative"
                aria-label="View larger image"
              >
                <img
                  src={product.gallery[activeImage] || color.image}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </button>
              <button
                aria-label="Zoom image"
                className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-sm hover:bg-navy hover:text-white transition-colors"
                onClick={() => setZoomOpen(true)}
              >
                <ZoomIn size={18} />
              </button>
              <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-2">
                {product.gallery.map((g, i) => (
                  <button
                    key={g + i}
                    onClick={() => setActiveImage(i)}
                    className={`h-2 rounded-full transition-all ${i === activeImage ? 'w-8 bg-navy' : 'w-2 bg-white/50'
                      }`}
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {product.gallery.map((g, i) => (
                <button
                  key={g + i}
                  onClick={() => setActiveImage(i)}
                  className={`aspect-square bg-mist overflow-hidden border-2 transition-colors ${i === activeImage ? 'border-navy' : 'border-transparent'
                    }`}
                >
                  <img src={g} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
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

            {/* Product Badges */}
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-navy/70">
              <span className="rounded-full bg-green-50 text-green-700 px-3 py-1 border border-green-200">
                Secure checkout
              </span>
              <span className="rounded-full bg-green-50 text-green-700 px-3 py-1 border border-green-200">
                Free delivery over EGP 2,000
              </span>
              <span className="rounded-full bg-green-50 text-green-700 px-3 py-1 border border-green-200">
                30-day easy returns
              </span>
              {inStock && (
                <span className="rounded-full bg-green-50 text-green-700 px-3 py-1 border border-green-200">
                  In Stock
                </span>
              )}
              {!inStock && (
                <span className="rounded-full bg-red-50 text-red-700 px-3 py-1 border border-red-200">
                  Out of Stock
                </span>
              )}
            </div>

            {/* Color Selection */}
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
                    className={`w-10 h-10 rounded-full border-2 transition-all shadow-sm ${i === colorIdx ? 'ring-2 ring-navy/30' : ''
                      }`}
                    style={{
                      boxShadow: i === colorIdx ? 'inset 0 0 0 2px rgba(10,10,40,0.4)' : 'inset 0 0 0 1px rgba(10,10,40,0.1)',
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

            {/* Size Selection */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <p className="nv-eyebrow text-navy/60">Size{size ? `: ${size}` : ''}</p>
                <button
                  onClick={() => setSizeGuideOpen(true)}
                  className="text-xs underline text-navy/50 hover:text-navy transition-colors"
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
                    className={`h-11 text-sm border transition-colors ${s.inStock ? 'hover:bg-navy hover:text-white' : 'opacity-50 cursor-not-allowed'
                      } ${size === s.size && s.inStock
                        ? 'bg-navy text-white border-navy'
                        : 'border-navy/25 text-navy'
                      }`}
                  >
                    {s.size}
                  </button>
                ))}
              </div>
              {sizeError && <p className="text-xs text-red-600 mt-2">Please select a size.</p>}
              {product.fitNotes && <p className="text-xs text-navy/50 mt-2">{product.fitNotes}</p>}

              {/* Back in Stock Notification */}
              {notifySize && (
                <div className="mt-4 border border-navy/15 p-4 bg-mist/30 rounded-lg">
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

            {/* Action Buttons */}
            <div className="mt-8 flex gap-3 flex-wrap">
              <div className="flex items-center border border-navy/25">
                <button
                  aria-label="Decrease quantity"
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-11 h-14 flex items-center justify-center hover:bg-mist transition-colors"
                >
                  <Minus size={14} />
                </button>
                <span className="w-10 text-center text-sm font-semibold">{qty}</span>
                <button
                  aria-label="Increase quantity"
                  onClick={() => setQty(q => q + 1)}
                  className="w-11 h-14 flex items-center justify-center hover:bg-mist transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
              <button
                onClick={handleAddToBag}
                disabled={!inStock}
                data-testid="add-to-bag-button"
                className={`flex-1 nv-eyebrow py-4 transition-colors ${inStock
                  ? 'bg-navy text-white hover:bg-navy-2'
                  : 'bg-mist text-silver cursor-not-allowed'
                  }`}
              >
                {inStock ? 'Add to Bag' : 'Sold Out'}
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
                className={`w-14 h-14 flex items-center justify-center border transition-colors flex-shrink-0 ${wished
                  ? 'border-navy bg-navy text-white'
                  : 'border-navy/25 text-navy hover:border-navy'
                  }`}
              >
                <Heart size={18} className={wished ? 'fill-current' : ''} />
              </button>
            </div>
            <button
              onClick={handleBuyNow}
              disabled={!inStock}
              data-testid="buy-now-button"
              className={`mt-3 w-full nv-eyebrow py-4 transition-colors ${inStock
                ? 'border border-navy hover:bg-navy hover:text-white'
                : 'border-mist text-silver cursor-not-allowed'
                }`}
            >
              {inStock ? 'Buy Now' : 'Sold Out'}
            </button>

            {/* Tabs */}
            <div className="mt-10 border-t border-navy/10">
              {(
                [
                  ['description', 'Description & Material'],
                  ['size', 'Size Guide'],
                  ['shipping', 'Shipping & Returns'],
                  ['reviews', `Reviews (${reviewStats.reviewCount})`],
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
                    <div className="pb-5 text-sm text-navy/70 leading-relaxed space-y-3 animate-fadeUp">
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
                      {key === 'reviews' && (
                        <div className="space-y-4">
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
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* FAQ - NEW SECTION */}
            <div className="mt-10 border-t border-navy/10">
              <button
                onClick={() => setFaqOpen(!faqOpen)}
                className="w-full flex items-center justify-between py-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <Info size={20} className="text-navy" />
                  <span className="nv-edit font-semibold text-sm uppercase">Frequently Asked Questions</span>
                </div>
                <span className="text-lg">{faqOpen ? '-' : '+'}</span>
              </button>
              {faqOpen && (
                <div className="space-y-4 pb-5 animate-fadeUp">
                  {faqs.map((faq, i) => (
                    <div key={i}>
                      <p className="font-medium text-navy mb-2">{faq.question}</p>
                      <p className="text-sm text-navy/60 leading-relaxed">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Review Form */}
            <div className="mt-10">
              {user ? (
                <div className="bg-mist/50 p-6 rounded-lg">
                  {!showReviewForm ? (
                    <button
                      onClick={() => setShowReviewForm(true)}
                      className="bg-navy text-white nv-eyebrow px-6 py-3 rounded-lg hover:bg-navy-2 transition-colors"
                    >
                      Write a Review
                    </button>
                  ) : (
                    <div className="animate-fadeUp">
                      <h3 className="nv-heading text-lg mb-4">Submit Your Review</h3>
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
                <p className="text-sm text-navy/50 mb-6">
                  Please{' '}
                  <a href="/login" className="text-navy underline hover:text-navy/70">
                    sign in
                  </a>{' '}
                  to write a review.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* You May Also Like */}
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

      {/* Mobile Bottom Actions */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/10 bg-white/95 p-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <button
            onClick={handleAddToBag}
            disabled={!inStock}
            className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold text-white ${inStock ? 'bg-navy hover:bg-navy-2' : 'bg-mist text-silver cursor-not-allowed'
              }`}
          >
            {inStock ? 'Add to Bag' : 'Sold Out'}
          </button>
          <button
            onClick={handleBuyNow}
            disabled={!inStock}
            className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold ${inStock
              ? 'border border-navy text-navy hover:bg-navy hover:text-white'
              : 'border-mist text-silver cursor-not-allowed'
              }`}
          >
            {inStock ? 'Buy Now' : 'Sold Out'}
          </button>
        </div>
      </div>

      {/* Image Zoom Modal */}
      {zoomOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={e => {
            if (e.target === e.currentTarget) setZoomOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Image zoom"
        >
          <button
            className="absolute top-6 right-6 text-white text-4xl bg-transparent border-none p-2 cursor-pointer"
            onClick={() => setZoomOpen(false)}
            aria-label="Close zoom"
          >
            ×
          </button>
          <img
            src={product.gallery[activeImage] || color.image}
            alt={product.name}
            className="max-w-full max-h-[90vh] object-contain"
          />
          <button
            className="absolute inset-0 w-full h-full cursor-pointer"
            onClick={e => {
              if (e.target === e.currentTarget) setZoomOpen(false);
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') setZoomOpen(false);
            }}
            aria-label="Close zoom"
          />
        </div>
      )}

      {sizeGuideOpen && <SizeGuideModal onClose={() => setSizeGuideOpen(false)} />}
    </div>
  );
}
