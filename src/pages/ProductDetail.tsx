import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  Loader2,
  Lock,
  Mail,
  Minus,
  Package,
  Plus,
  RotateCcw,
  Ruler,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  X,
} from 'lucide-react';
import type { Product, Size, ProductReview } from '../types';
import { productService } from '../services/productService';
import { backInStockService } from '../services/backInStockService';
import { reviewService } from '../services/reviewService';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useBrowsingHistory } from '../context/BrowsingHistoryContext';
import { useToast } from '../context/ToastContext';
import { useSEO, useStructuredData } from '../lib/seo';
import { ecommerce } from '../lib/analytics';
import ProductCard from '../components/ProductCard';
import SizeGuideModal from '../components/SizeGuideModal';
import ReviewPhotoGallery from '../components/ReviewPhotoGallery';
import CompleteTheLook from '../components/CompleteTheLook';
import PersonalizedRecommendations from '../components/PersonalizedRecommendations';
import Skeleton from '../components/Skeleton';
import OptimizedImage from '../components/OptimizedImage';
import { FREE_SHIPPING_THRESHOLD, EXPRESS_SHIPPING_COST } from '../lib/storeConfig';
import { formatEGP } from '../lib/format';
import { useI18n } from '../lib/i18n';

const STORE_URL = import.meta.env.VITE_APP_URL || 'https://www.nerveey.shop';
const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'nerveey.shop@gmail.com';

type PendingPhoto = { file: File; preview: string };

type Tab = 'description' | 'details' | 'shipping';

function truncateMeta(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

function discountPercent(price: number, compareAt?: number): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export default function ProductDetail() {
  const { t } = useI18n();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addLine } = useCart();
  const { toggle, has } = useWishlist();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { addView } = useBrowsingHistory();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [colorIdx, setColorIdx] = useState(0);
  const [size, setSize] = useState<Size | null>(null);
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [tab, setTab] = useState<Tab | ''>('description');
  const [sizeError, setSizeError] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [notifySize, setNotifySize] = useState<Size | null>(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifyStatus, setNotifyStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewStats, setReviewStats] = useState({ reviewCount: 0, averageRating: 0 });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewPhotos, setReviewPhotos] = useState<PendingPhoto[]>([]);
  const [reviewSort, setReviewSort] = useState<'newest' | 'helpful' | 'rating'>('newest');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'verified' | 'photos'>('all');
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, boolean>>({});
  const [shareOpen, setShareOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [addedPulse, setAddedPulse] = useState(false);

  const sizeGridRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleShare = async () => {
    const url = product ? `${STORE_URL}/product/${product.slug}` : window.location.href;
    const text = product ? `${product.name} | NERVE` : 'NERVE';
    if (navigator.share) {
      try {
        await navigator.share({ title: text, text, url });
        return;
      } catch {
        /* user cancelled or share failed — fall through to menu */
      }
    }
    setShareOpen(v => !v);
  };

  const color = product
    ? product.colors[Math.min(colorIdx, Math.max(0, product.colors.length - 1))]
    : undefined;
  const isSoldOut = !!product && product.sizes.length > 0 && product.sizes.every(s => !s.inStock);
  const hasAnyStock = !!product && product.sizes.some(s => s.inStock);
  const salePct = product ? discountPercent(product.price, product.compareAtPrice) : null;

  const galleryImages = useMemo(() => {
    if (!product) return [] as string[];
    const base = (product.gallery || []).filter(Boolean);
    const colorImg = color?.image;
    if (colorImg && !base.includes(colorImg)) {
      return [colorImg, ...base];
    }
    if (base.length === 0 && colorImg) return [colorImg];
    return base;
  }, [product, color?.image]);

  const activeSrc = galleryImages[activeImage] || color?.image || '';

  useSEO({
    title: product ? `${product.name} | NERVE` : 'NERVE — Cool but Chic',
    description: product
      ? truncateMeta(product.description)
      : 'A contemporary Egyptian concept store. Cool but chic. EST 2026.',
    type: product ? 'product' : 'website',
    ogImage: activeSrc || product?.colors[0]?.image,
    canonical: product ? `${STORE_URL}/product/${product.slug}` : undefined,
    price: product?.price,
    currency: product ? 'EGP' : undefined,
    brand: 'NERVE',
    availability: product ? (hasAnyStock ? 'InStock' : 'OutOfStock') : undefined,
    keywords: product
      ? [product.name, product.category, product.material, 'NERVE', 'Egypt']
          .filter(Boolean)
          .join(', ')
      : undefined,
  });

  useStructuredData(
    product
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          '@id': `${STORE_URL}/product/${product.slug}`,
          name: product.name,
          description: truncateMeta(product.description, 300),
          image: galleryImages.length > 0 ? galleryImages : [color?.image].filter(Boolean),
          url: `${STORE_URL}/product/${product.slug}`,
          brand: { '@type': 'Brand', name: 'NERVE' },
          category: product.category,
          material: product.material || undefined,
          offers: {
            '@type': 'Offer',
            price: product.price,
            priceCurrency: 'EGP',
            url: `${STORE_URL}/product/${product.slug}`,
            availability: hasAnyStock
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            itemCondition: 'https://schema.org/NewCondition',
            seller: { '@type': 'Organization', name: 'NERVE' },
            ...(product.compareAtPrice && product.compareAtPrice > product.price
              ? {
                  priceSpecification: {
                    '@type': 'UnitPriceSpecification',
                    price: product.price,
                    priceCurrency: 'EGP',
                    valueAddedTaxIncluded: true,
                  },
                }
              : {}),
          },
          ...(reviewStats.reviewCount > 0 && {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: reviewStats.averageRating.toFixed(1),
              reviewCount: reviewStats.reviewCount,
            },
          }),
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'NERVE',
          url: STORE_URL,
          sameAs: [
            'https://www.instagram.com/gotthenerve58/',
            'https://www.tiktok.com/@user795916160817',
            'https://www.linkedin.com/in/nerve-shop-b67623429',
          ],
        },
  );

  useStructuredData(
    product
      ? {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: STORE_URL },
            { '@type': 'ListItem', position: 2, name: 'Shop', item: `${STORE_URL}/shop` },
            {
              '@type': 'ListItem',
              position: 3,
              name: product.category,
              item: `${STORE_URL}/shop?category=${encodeURIComponent(product.category)}`,
            },
            {
              '@type': 'ListItem',
              position: 4,
              name: product.name,
              item: `${STORE_URL}/product/${product.slug}`,
            },
          ],
        }
      : {},
  );

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    setLoading(true);
    setProduct(null);
    setColorIdx(0);
    setSize(null);
    setActiveImage(0);
    setQty(1);
    setNotifySize(null);
    setNotifyStatus('idle');
    setSizeError(false);
    setTab('description');
    productService
      .getBySlug(slug)
      .then(async p => {
        if (!mounted) return;
        if (!p) {
          setProduct(null);
          setLoading(false);
          return;
        }
        setProduct(p);
        ecommerce.viewProduct(p.id, p.name, p.category, p.price);
        addView(p.id, p.category);
        try {
          const rel = await productService.getRelated(p);
          if (mounted) setRelated(rel);

          setReviewsLoading(true);
          setHelpfulVotes({});
          const reviewData = await reviewService.getByProduct(p.id);
          if (reviewData.reviews) {
            const voted: Record<string, boolean> = {};
            reviewData.reviews.forEach(r => {
              if (reviewService.hasVoted(p.id, r.id)) voted[r.id] = true;
            });
            setHelpfulVotes(voted);
            setReviews(reviewData.reviews);
          }
          const statsData = await reviewService.getStats(p.id);
          if (statsData.stats) setReviewStats(statsData.stats);
        } finally {
          if (mounted) setReviewsLoading(false);
        }
        if (mounted) setLoading(false);
      })
      .catch(err => {
        if (!mounted) return;
        console.error('Failed to load product:', err);
        setProduct(null);
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Keyboard: gallery arrows + zoom close
  useEffect(() => {
    if (!product || galleryImages.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && zoomOpen) {
        setZoomOpen(false);
        return;
      }
      if (zoomOpen) return;
      if (e.key === 'ArrowLeft') {
        setActiveImage(i => (i - 1 + galleryImages.length) % galleryImages.length);
      } else if (e.key === 'ArrowRight') {
        setActiveImage(i => (i + 1) % galleryImages.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [product, galleryImages.length, zoomOpen]);

  // Reset active image when color changes
  useEffect(() => {
    setActiveImage(0);
  }, [colorIdx]);

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
        <h1 className="nv-heading text-4xl mb-4">{t('Product Not Found')}</h1>
        <p className="text-navy/60 mb-6">
          {t('This product may have been removed or the link is wrong.')}
        </p>
        <button onClick={() => navigate('/shop')} className="nv-eyebrow underline">
          {t('Back to Shop')}
        </button>
      </div>
    );
  }

  const wished = has(product.id);

  const focusSizeGrid = () => {
    setSizeError(true);
    requestAnimationFrame(() => {
      sizeGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const first = sizeGridRef.current?.querySelector<HTMLButtonElement>(
        'button:not([aria-disabled="true"])',
      );
      first?.focus();
    });
  };

  const handleAddToBag = () => {
    if (isSoldOut) {
      showToast(t('This product is sold out.'), 'error', 2500);
      return;
    }
    if (!size) {
      focusSizeGrid();
      return;
    }
    const selected = product.sizes.find(s => s.size === size);
    if (selected && !selected.inStock) {
      setSizeError(true);
      showToast(t('That size is no longer available.'), 'error', 2500);
      return;
    }
    try {
      addLine({
        productId: product.id,
        name: product.name,
        slug: product.slug,
        image: color?.image || activeSrc,
        price: product.price,
        color: color?.name || '',
        size,
        quantity: qty,
      });
      setSizeError(false);
      setAddedPulse(true);
      setTimeout(() => setAddedPulse(false), 1200);
    } catch {
      showToast(t('Could not add to bag. Please try again.'), 'error', 3000);
    }
  };

  const handleBuyNow = () => {
    if (isSoldOut) {
      showToast(t('This product is sold out.'), 'error', 2500);
      return;
    }
    if (!size) {
      focusSizeGrid();
      return;
    }
    handleAddToBag();
    navigate('/checkout');
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmittingReview(true);

    let photoUrls: string[] = [];
    let uploadFailed = 0;
    if (reviewPhotos.length > 0) {
      const upload = await reviewService.uploadPhotos(
        user.id,
        reviewPhotos.map(p => p.file),
      );
      photoUrls = upload.urls;
      uploadFailed = upload.failed;
    }

    const result = await reviewService.create({
      productId: product.id,
      rating: reviewForm.rating,
      title: reviewForm.title,
      comment: reviewForm.comment,
      photos: photoUrls,
    });
    if (result.success) {
      setReviews([...reviews, { ...result.review!, photos: photoUrls, helpfulCount: 0 }]);
      setReviewForm({ rating: 5, title: '', comment: '' });
      reviewPhotos.forEach(p => URL.revokeObjectURL(p.preview));
      setReviewPhotos([]);
      setShowReviewForm(false);
      if (uploadFailed > 0) {
        showToast(t('Review submitted, but some photos failed to upload.'), 'info', 4000);
      } else {
        showToast(t('Review submitted successfully'), 'success', 2000);
      }
    } else {
      showToast(result.error || t('Failed to submit review'), 'error', 3000);
    }
    setSubmittingReview(false);
  };

  const handleHelpfulVote = async (review: ProductReview) => {
    if (helpfulVotes[review.id] || reviewService.hasVoted(product.id, review.id)) {
      return;
    }
    const result = await reviewService.voteHelpful(product.id, review.id);
    if (result.error) {
      showToast(result.error, 'error', 3000);
      return;
    }
    setHelpfulVotes(prev => ({ ...prev, [review.id]: true }));
    if (typeof result.count === 'number') {
      setReviews(prev =>
        prev.map(r => (r.id === review.id ? { ...r, helpfulCount: result.count } : r)),
      );
    } else if (result.voted) {
      setReviews(prev =>
        prev.map(r => (r.id === review.id ? { ...r, helpfulCount: (r.helpfulCount || 0) + 1 } : r)),
      );
    }
  };

  const getFilteredAndSortedReviews = () => {
    let filtered = reviews;

    if (reviewFilter === 'verified') {
      filtered = filtered.filter(r => r.verified);
    } else if (reviewFilter === 'photos') {
      filtered = filtered.filter(r => r.photos && r.photos.length > 0);
    }

    if (reviewSort === 'helpful') {
      filtered = [...filtered].sort((a, b) => (b.helpfulCount || 0) - (a.helpfulCount || 0));
    } else if (reviewSort === 'rating') {
      filtered = [...filtered].sort((a, b) => b.rating - a.rating);
    } else {
      filtered = [...filtered].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    return filtered;
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

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) {
      setActiveImage(i => (i + 1) % galleryImages.length);
    } else {
      setActiveImage(i => (i - 1 + galleryImages.length) % galleryImages.length);
    }
  };

  const ctaLabel = isSoldOut ? t('Sold Out') : addedPulse ? t('Added to Bag') : t('Add to Bag');

  const accordionTabs: [Tab, string][] = [
    ['description', 'Description'],
    ['details', 'Details & Care'],
    ['shipping', 'Shipping & Returns'],
  ];

  return (
    <div className="bg-white text-navy min-h-screen pt-24 md:pt-28 pb-28 md:pb-24">
      <div className="mx-auto max-w-[1600px] px-5 md:px-8">
        <div className="grid md:grid-cols-2 gap-8 md:gap-14">
          {/* Gallery */}
          <div>
            <div
              className="relative aspect-[4/5] bg-mist overflow-hidden mb-3 group"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              <button
                type="button"
                onClick={() => setZoomOpen(true)}
                className="absolute inset-0 z-10 cursor-zoom-in"
                aria-label={t('Zoom product image')}
              >
                <span className="sr-only">{t('Zoom product image')}</span>
              </button>
              <OptimizedImage
                src={activeSrc}
                alt={`${product.name} — ${color?.name || ''} ${t('view')} ${activeImage + 1}`}
                className="w-full h-full object-cover pointer-events-none"
                priority
              />
              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label={t('Previous image')}
                    onClick={e => {
                      e.stopPropagation();
                      setActiveImage(i => (i - 1 + galleryImages.length) % galleryImages.length);
                    }}
                    className="absolute start-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 border border-navy/10 flex items-center justify-center hover:bg-white shadow-sm"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label={t('Next image')}
                    onClick={e => {
                      e.stopPropagation();
                      setActiveImage(i => (i + 1) % galleryImages.length);
                    }}
                    className="absolute end-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 border border-navy/10 flex items-center justify-center hover:bg-white shadow-sm"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 rounded-full bg-navy/70 text-white text-[11px] px-2.5 py-1 tabular-nums pointer-events-none">
                    {activeImage + 1} / {galleryImages.length}
                  </span>
                </>
              )}
              <span className="absolute top-3 end-3 z-20 rounded-full bg-white/90 border border-navy/10 p-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex">
                <Eye size={14} />
              </span>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-5 gap-2">
              {galleryImages.map((g, i) => (
                <button
                  key={g + i}
                  onClick={() => setActiveImage(i)}
                  className={`aspect-square bg-mist overflow-hidden border-2 transition-colors ${
                    activeImage === i ? 'border-navy' : 'border-transparent hover:border-navy/30'
                  }`}
                  aria-label={`${t('View product image')} ${i + 1}`}
                  aria-pressed={activeImage === i}
                >
                  <OptimizedImage
                    src={g}
                    alt={`${product.name} — ${t('thumbnail')} ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Buy box */}
          <div className="md:pt-2">
            <nav className="mb-4" aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1 text-xs text-navy/60">
                <li>
                  <Link to="/" className="hover:text-navy">
                    {t('Home')}
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link to="/shop" className="hover:text-navy">
                    {t('Shop')}
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link
                    to={`/shop?category=${encodeURIComponent(product.category)}`}
                    className="hover:text-navy"
                  >
                    {product.category}
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="text-navy" aria-current="page">
                  {product.name}
                </li>
              </ol>
            </nav>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              {product.badge && (
                <span className="bg-navy text-white text-[10px] font-semibold tracking-widest2 uppercase px-2.5 py-1">
                  {product.badge}
                </span>
              )}
              {salePct !== null && (
                <span className="bg-red-600 text-white text-[10px] font-semibold tracking-widest2 uppercase px-2.5 py-1">
                  −{salePct}%
                </span>
              )}
              {isSoldOut && (
                <span className="bg-navy text-white text-[10px] font-semibold tracking-widest2 uppercase px-2.5 py-1">
                  {t('Sold Out')}
                </span>
              )}
              {product.isLowStock && !isSoldOut && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-semibold tracking-widest2 uppercase px-2.5 py-1">
                  {t('Low Stock')}
                </span>
              )}
            </div>

            <h1 className="nv-heading text-3xl md:text-5xl">{product.name}</h1>

            <div className="flex items-baseline gap-3 mt-3 flex-wrap">
              <span className="text-2xl font-semibold">{formatEGP(product.price)}</span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <>
                  <span className="text-lg text-navy/50 line-through">
                    {formatEGP(product.compareAtPrice)}
                  </span>
                  <span className="text-sm text-red-600 font-medium">
                    −{formatEGP(product.compareAtPrice - product.price)}
                  </span>
                </>
              )}
            </div>

            {reviewStats.reviewCount > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex">{renderStars(reviewStats.averageRating)}</div>
                <a href="#reviews" className="text-xs text-navy/60 underline hover:text-navy">
                  {reviewStats.averageRating.toFixed(1)} · {reviewStats.reviewCount} {t('reviews')}
                </a>
              </div>
            )}

            {/* Trust — only policies the store actually offers */}
            <ul
              className="mt-4 flex flex-wrap gap-2 text-xs text-navy/70"
              aria-label={t('Store policies')}
            >
              <li className="rounded-full bg-mist px-3 py-1 flex items-center gap-1.5">
                <Truck size={12} aria-hidden="true" />
                {t('Free delivery over')} {formatEGP(FREE_SHIPPING_THRESHOLD)}
              </li>
              <li className="rounded-full bg-mist px-3 py-1 flex items-center gap-1.5">
                <Package size={12} aria-hidden="true" />
                {t('Standard delivery in 2-5 business days across Egypt.')}
              </li>
              <li className="rounded-full bg-mist px-3 py-1 flex items-center gap-1.5">
                <RotateCcw size={12} aria-hidden="true" />
                <Link to="/returns" className="underline hover:text-navy">
                  {t('14-day returns on unworn items')}
                </Link>
              </li>
              <li className="rounded-full bg-mist px-3 py-1 flex items-center gap-1.5">
                <ShieldCheck size={12} aria-hidden="true" />
                {t('Cash on Delivery')}
              </li>
              <li className="rounded-full bg-mist px-3 py-1 flex items-center gap-1.5">
                <Lock size={12} aria-hidden="true" />
                {t('Secure checkout')}
              </li>
            </ul>

            {/* Color */}
            {product.colors.length > 0 && (
              <div className="mt-8">
                <p className="nv-eyebrow text-navy/60 mb-3">
                  {t('Color')}: {color?.name}
                </p>
                <div className="flex gap-2" role="group" aria-label={t('Color')}>
                  {product.colors.map((c, i) => (
                    <button
                      key={c.name}
                      onClick={() => setColorIdx(i)}
                      aria-label={`${t('Select color')}: ${c.name}`}
                      aria-pressed={i === colorIdx}
                      data-testid="color-option"
                      title={c.name}
                      className="w-12 h-12 rounded-full border-2 transition-all flex-shrink-0"
                      style={{
                        borderColor: i === colorIdx ? '#061735' : 'transparent',
                        boxShadow: 'inset 0 0 0 1px rgba(10,10,40,0.15)',
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
            )}

            {/* Size */}
            <div className="mt-8" ref={sizeGridRef}>
              <div className="flex items-center justify-between mb-3">
                <p className="nv-eyebrow text-navy/60" id="size-label">
                  {t('Size')}
                  {size ? `: ${size}` : ''}
                  {!size && hasAnyStock && (
                    <span className="text-navy/40 font-normal normal-case tracking-normal ms-2 text-xs">
                      {t('Select a size')}
                    </span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setSizeGuideOpen(true)}
                  data-testid="size-guide-button"
                  className="text-xs underline text-navy/60 hover:text-navy flex items-center gap-1"
                >
                  <Ruler size={12} aria-hidden="true" />
                  {t('Size Guide')}
                </button>
              </div>
              <div
                className="grid grid-cols-4 sm:grid-cols-6 gap-2"
                role="group"
                aria-labelledby="size-label"
                aria-describedby={sizeError ? 'size-error' : undefined}
              >
                {product.sizes.map(s => {
                  const selected = size === s.size;
                  const unavailable = !s.inStock;
                  return (
                    <button
                      key={s.size}
                      type="button"
                      aria-pressed={selected}
                      aria-disabled={unavailable}
                      aria-label={`${s.size} — ${unavailable ? t('Unavailable') : t('Available')}`}
                      data-testid="size-option"
                      data-size={s.size}
                      data-available={unavailable ? 'false' : 'true'}
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
                      className={`relative py-2.5 sm:py-2 px-3 text-sm sm:text-base border transition-colors rounded flex items-center justify-center ${
                        selected
                          ? 'border-navy bg-navy text-white'
                          : unavailable
                          ? 'border-navy/15 text-navy/35 bg-mist/40 cursor-not-allowed line-through decoration-navy/40'
                          : 'border-navy/30 text-navy hover:border-navy hover:bg-mist/50'
                      }`}
                    >
                      {s.size}
                    </button>
                  );
                })}
              </div>
              {sizeError && (
                <p id="size-error" role="alert" className="text-xs text-red-600 mt-2">
                  {t('Please select a size.')}
                </p>
              )}
              {product.fitNotes && <p className="text-xs text-navy/50 mt-2">{product.fitNotes}</p>}
              <p className="text-xs text-navy/45 mt-1">
                {t('True to size — check the size guide for measurements.')}
              </p>

              {notifySize && (
                <div className="mt-4 border border-navy/15 p-4">
                  {notifyStatus === 'done' ? (
                    <p className="text-sm">
                      {t("We'll email you the moment")} <strong>{notifySize}</strong>{' '}
                      {t('is back.')}
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
                        {t('Size')} <strong>{notifySize}</strong>{' '}
                        {t("is out of stock. Get an email when it's back:")}
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
                          {t('Notify Me')}
                        </button>
                      </div>
                      {notifyStatus === 'error' && (
                        <p className="text-xs text-red-600">
                          {t('Something went wrong. Please try again.')}
                        </p>
                      )}
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Quantity + CTAs */}
            <div className="mt-8 flex gap-3">
              <div className="flex items-center border border-navy/25">
                <button
                  type="button"
                  aria-label={t('Decrease quantity')}
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                  className="w-11 h-14 flex items-center justify-center hover:bg-mist disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <Minus size={14} />
                </button>
                <span className="w-10 text-center" aria-live="polite" data-testid="qty-value">
                  {qty}
                </span>
                <button
                  type="button"
                  aria-label={t('Increase quantity')}
                  onClick={() => setQty(q => Math.min(10, q + 1))}
                  disabled={qty >= 10}
                  className="w-11 h-14 flex items-center justify-center hover:bg-mist disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <Plus size={14} />
                </button>
              </div>
              <button
                type="button"
                onClick={handleAddToBag}
                disabled={isSoldOut}
                data-testid="add-to-bag-button"
                aria-disabled={isSoldOut}
                className={`flex-1 nv-eyebrow py-4 transition-colors flex items-center justify-center gap-2 ${
                  isSoldOut
                    ? 'bg-navy/20 text-navy/50 cursor-not-allowed'
                    : addedPulse
                    ? 'bg-green-700 text-white'
                    : 'bg-navy text-white hover:bg-navy-2'
                }`}
              >
                {!isSoldOut && addedPulse && <ShoppingCart size={16} aria-hidden="true" />}
                {ctaLabel}
              </button>
              <button
                type="button"
                aria-label={wished ? t('Remove from wishlist') : t('Add to wishlist')}
                aria-pressed={wished}
                onClick={() => {
                  toggle({
                    productId: product.id,
                    name: product.name,
                    slug: product.slug,
                    image: color?.image || '',
                    price: product.price,
                  });
                  showToast(
                    wished ? t('Removed from wishlist') : t('Added to wishlist'),
                    'success',
                    2000,
                  );
                }}
                className="w-14 h-14 border border-navy/25 flex items-center justify-center hover:border-navy transition-colors flex-shrink-0"
              >
                <Heart size={18} className={wished ? 'fill-navy text-navy' : 'text-navy'} />
              </button>
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  aria-label={t('Share this product')}
                  aria-expanded={shareOpen}
                  onClick={() => void handleShare()}
                  className="w-14 h-14 border border-navy/25 flex items-center justify-center hover:border-navy transition-colors"
                >
                  <Share2 size={18} aria-hidden="true" />
                </button>
                {shareOpen && (
                  <div className="absolute end-0 top-full mt-2 z-30 w-48 rounded-xl border border-navy/10 bg-white p-2 shadow-lg">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `${product.name} — ${STORE_URL}/product/${product.slug}`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg px-3 py-2 text-sm text-navy/80 hover:bg-mist"
                    >
                      WhatsApp
                    </a>
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                        `${STORE_URL}/product/${product.slug}`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg px-3 py-2 text-sm text-navy/80 hover:bg-mist"
                    >
                      Facebook
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard
                          ?.writeText(`${STORE_URL}/product/${product.slug}`)
                          .then(() => {
                            showToast(t('Link copied'), 'success', 2000);
                            setShareOpen(false);
                          });
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-start text-sm text-navy/80 hover:bg-mist"
                    >
                      {t('Copy link')}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleBuyNow}
              disabled={isSoldOut}
              data-testid="buy-now-button"
              aria-disabled={isSoldOut}
              className={`mt-3 w-full border nv-eyebrow py-4 transition-colors ${
                isSoldOut
                  ? 'border-navy/20 text-navy/40 cursor-not-allowed'
                  : 'border-navy hover:bg-navy hover:text-white'
              }`}
            >
              {isSoldOut ? t('Sold Out') : t('Buy Now')}
            </button>
            {!isSoldOut && (
              <p className="text-xs text-navy/50 mt-2 flex items-center gap-1.5">
                <Mail size={12} aria-hidden="true" />
                {t('Questions?')}{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="underline hover:text-navy">
                  {SUPPORT_EMAIL}
                </a>
              </p>
            )}

            {/* Accordions */}
            <div className="mt-10 border-t border-navy/10">
              {accordionTabs.map(([key, label]) => (
                <div key={key} className="border-b border-navy/10">
                  <button
                    type="button"
                    onClick={() => setTab(tab === key ? '' : key)}
                    aria-expanded={tab === key}
                    className="w-full flex items-center justify-between py-4 text-start"
                  >
                    <span className="nv-edit font-semibold text-sm uppercase">{t(label)}</span>
                    <span className="text-lg" aria-hidden="true">
                      {tab === key ? '−' : '+'}
                    </span>
                  </button>
                  {tab === key && (
                    <div className="pb-5 text-sm text-navy/70 leading-relaxed space-y-3">
                      {key === 'description' && (
                        <>
                          <p>{product.description}</p>
                          {product.fitNotes && (
                            <p>
                              <span className="font-medium text-navy">{t('Fit:')}</span>{' '}
                              {product.fitNotes}
                            </p>
                          )}
                        </>
                      )}
                      {key === 'details' && (
                        <>
                          {product.material && (
                            <p>
                              <span className="font-medium text-navy">{t('Material:')}</span>{' '}
                              {product.material}
                            </p>
                          )}
                          <div>
                            <p className="font-medium text-navy mb-1">{t('Care Instructions:')}</p>
                            {product.care.length > 0 ? (
                              <ul className="list-disc list-inside space-y-0.5">
                                {product.care.map(c => (
                                  <li key={c}>{c}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-navy/50">{t('No care instructions listed.')}</p>
                            )}
                          </div>
                          <div className="flex items-start gap-2 pt-1">
                            <Ruler size={16} className="mt-0.5 flex-shrink-0" />
                            <p>
                              {t(
                                'NERVE fits true to size unless noted. If between sizes, size up for an oversized look or down for a fitted silhouette.',
                              )}{' '}
                              <button
                                type="button"
                                onClick={() => setSizeGuideOpen(true)}
                                className="underline text-navy"
                              >
                                {t('Open Size Guide')}
                              </button>
                            </p>
                          </div>
                        </>
                      )}
                      {key === 'shipping' && (
                        <div className="space-y-3">
                          <div className="flex items-start gap-2">
                            <Truck size={16} className="mt-0.5 flex-shrink-0" />
                            <div>
                              <p>{t('Standard delivery in 2-5 business days across Egypt.')}</p>
                              <p>
                                {t('Express delivery:')} {t('1-2 business days')},{' '}
                                {formatEGP(EXPRESS_SHIPPING_COST)}.
                              </p>
                              <p>
                                {t('Free standard shipping on orders over')}{' '}
                                {formatEGP(FREE_SHIPPING_THRESHOLD)}.
                              </p>
                              <p>{t('Orders process within 24 hours on business days.')}</p>
                              <Link
                                to="/shipping"
                                className="underline text-navy inline-block mt-1"
                              >
                                {t('Full shipping policy')}
                              </Link>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <RotateCcw size={16} className="mt-0.5 flex-shrink-0" />
                            <div>
                              <p>{t('Free returns within 14 days of delivery on unworn items.')}</p>
                              <p>{t('Free size exchanges within 30 days.')}</p>
                              <Link to="/returns" className="underline text-navy inline-block mt-1">
                                {t('Full returns policy')}
                              </Link>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <ShieldCheck size={16} className="mt-0.5 flex-shrink-0" />
                            <div>
                              <p>
                                <span className="font-medium text-navy">
                                  {t('Cash on Delivery')}
                                </span>{' '}
                                — {t('pay the courier when your order arrives across Egypt.')}
                              </p>
                              <p className="text-navy/60">
                                {t('We never collect or store payment card details.')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reviews — full width */}
        <section id="reviews" className="mt-16 border-t border-navy/10 pt-10 scroll-mt-28">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="nv-heading text-2xl md:text-3xl">{t('Customer Reviews')}</h2>
            <div className="flex items-center gap-2">
              {reviewStats.reviewCount > 0 ? (
                <>
                  <span className="text-lg font-semibold">
                    {reviewStats.averageRating.toFixed(1)}
                  </span>
                  <div className="flex">{renderStars(reviewStats.averageRating)}</div>
                  <span className="text-sm text-navy/60">
                    ({reviewStats.reviewCount} {t('reviews')})
                  </span>
                </>
              ) : (
                <span className="text-sm text-navy/50">{t('No reviews yet')}</span>
              )}
            </div>
          </div>

          {user ? (
            <div className="mb-6">
              {!showReviewForm ? (
                <button
                  type="button"
                  onClick={() => setShowReviewForm(true)}
                  className="bg-navy text-white nv-eyebrow px-4 py-2 rounded-lg hover:bg-navy-2 transition-colors"
                >
                  {t('Write a Review')}
                </button>
              ) : (
                <div className="bg-mist/50 p-4 rounded-lg max-w-2xl">
                  <form onSubmit={handleReviewSubmit} className="space-y-3">
                    <div>
                      <span
                        className="text-xs font-medium text-navy/60 mb-1 block"
                        id="review-rating-label"
                      >
                        {t('Rating')}
                      </span>
                      <div
                        className="flex gap-1"
                        role="group"
                        aria-labelledby="review-rating-label"
                      >
                        {Array.from({ length: 5 }).map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            aria-label={`${i + 1} stars`}
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
                        {t('Title')}
                      </label>
                      <input
                        id="review-title"
                        type="text"
                        required
                        value={reviewForm.title}
                        onChange={e => setReviewForm({ ...reviewForm, title: e.target.value })}
                        className="w-full border border-navy/20 px-3 py-2 text-sm focus:outline-none focus:border-navy"
                        placeholder={t('Short summary')}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="review-comment"
                        className="text-xs font-medium text-navy/60 mb-1 block"
                      >
                        {t('Comment')}
                      </label>
                      <textarea
                        id="review-comment"
                        value={reviewForm.comment}
                        onChange={e => setReviewForm({ ...reviewForm, comment: e.target.value })}
                        className="w-full border border-navy/20 px-3 py-2 text-sm focus:outline-none focus:border-navy"
                        placeholder={t('Share your thoughts')}
                        rows={3}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="review-photos"
                        className="text-xs font-medium text-navy/60 mb-1 block"
                      >
                        {t('Add Photos (optional, max 3)')}
                      </label>
                      <input
                        id="review-photos"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={e => {
                          const files = Array.from(e.currentTarget.files || []);
                          const limited = files.slice(0, 3 - reviewPhotos.length);
                          const next = limited.map(file => ({
                            file,
                            preview: URL.createObjectURL(file),
                          }));
                          setReviewPhotos(prev => [...prev, ...next].slice(0, 3));
                          e.currentTarget.value = '';
                        }}
                        className="w-full text-xs"
                        disabled={reviewPhotos.length >= 3}
                      />
                      {reviewPhotos.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {reviewPhotos.map((photo, i) => (
                            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden">
                              <img
                                src={photo.preview}
                                alt={`${t('Uploaded')} ${i + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  URL.revokeObjectURL(photo.preview);
                                  setReviewPhotos(prev => prev.filter((_, idx) => idx !== i));
                                }}
                                className="absolute top-0 end-0 p-1 bg-red-600 text-white rounded-bl text-xs"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={submittingReview}
                        className="flex-1 bg-navy text-white nv-eyebrow py-2 rounded-lg disabled:opacity-60"
                      >
                        {submittingReview ? t('Submitting...') : t('Submit Review')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowReviewForm(false)}
                        className="px-4 py-2 text-sm text-navy hover:text-navy-2"
                      >
                        {t('Cancel')}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-navy/50 mb-4">
              {t('Please')}{' '}
              <Link to="/login" className="text-navy underline">
                {t('sign in')}
              </Link>{' '}
              {t('to write a review.')}
            </p>
          )}

          {reviews.length > 0 && (
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-2 flex-wrap">
                {(
                  [
                    ['all', t('All Reviews')],
                    ['verified', t('✓ Verified')],
                    ['photos', t('📸 With Photos')],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setReviewFilter(key)}
                    className={`text-xs px-3 py-1 rounded transition-colors ${
                      reviewFilter === key
                        ? 'bg-navy text-white'
                        : 'bg-mist text-navy hover:bg-mist/75'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                value={reviewSort}
                onChange={e => setReviewSort(e.target.value as 'newest' | 'helpful' | 'rating')}
                aria-label={t('Sort reviews')}
                className="text-xs px-3 py-1 border border-navy/20 rounded focus:outline-none focus:border-navy"
              >
                <option value="newest">{t('Newest First')}</option>
                <option value="helpful">{t('Most Helpful')}</option>
                <option value="rating">{t('Highest Rating')}</option>
              </select>
            </div>
          )}

          {reviewsLoading ? (
            <div className="space-y-4" aria-busy="true" aria-label={t('Loading reviews')}>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="border-b border-navy/10 pb-4 animate-pulse max-w-3xl">
                  <div className="flex gap-1 mb-2">
                    {[...Array(5)].map((_, j) => (
                      <div key={j} className="w-4 h-4 bg-mist rounded-full" />
                    ))}
                  </div>
                  <div className="h-4 bg-mist rounded mb-2 w-2/3" />
                  <div className="h-3 bg-mist rounded mb-2 w-full" />
                  <div className="h-3 bg-mist rounded w-1/4" />
                </div>
              ))}
            </div>
          ) : reviews.length > 0 ? (
            <div className="space-y-4 max-w-3xl">
              {getFilteredAndSortedReviews().map(review => (
                <article key={review.id} className="border-b border-navy/10 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex" aria-label={`${review.rating} / 5`}>
                      {renderStars(review.rating)}
                    </div>
                    {review.verified && (
                      <span className="inline-block bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full">
                        {t('✓ Verified Purchase')}
                      </span>
                    )}
                  </div>
                  <h3 className="font-medium text-sm mb-1">{review.title}</h3>
                  {review.comment && <p className="text-sm text-navy/60 mb-2">{review.comment}</p>}

                  <ReviewPhotoGallery photos={review.photos || []} productName={product.name} />

                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mt-3 text-xs">
                    <p className="text-navy/55">
                      {new Date(review.createdAt).toLocaleDateString()} {t('by')}{' '}
                      {review.customerName || t('Anonymous')}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleHelpfulVote(review)}
                      disabled={!!helpfulVotes[review.id]}
                      className={`px-2 py-1 rounded transition-colors ${
                        helpfulVotes[review.id]
                          ? 'bg-blue-100 text-blue-700 cursor-default'
                          : 'bg-mist text-navy hover:bg-mist/75'
                      }`}
                    >
                      👍 {review.helpfulCount || 0} {t('Helpful')}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-navy/50">{t('No reviews yet. Be the first to review!')}</p>
          )}
        </section>

        {related.length >= 2 && (
          <CompleteTheLook mainProduct={product} suggestedItems={related.slice(0, 3)} />
        )}

        {related.length > 0 && (
          <div className="mt-20">
            <h2 className="nv-heading text-3xl md:text-4xl mb-8">{t('You May Also Like')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-10">
              {related.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}

        <PersonalizedRecommendations
          currentProduct={product}
          position="below-description"
          title={t('Complete Your Style')}
        />
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/10 bg-white/95 p-3 backdrop-blur md:hidden safe-pb">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <div className="min-w-0 shrink">
            <p className="text-[11px] text-navy/50 truncate max-w-[7rem]">{product.name}</p>
            <p className="text-sm font-semibold leading-tight">
              {formatEGP(product.price)}
              {salePct !== null && (
                <span className="ms-1 text-red-600 text-[11px] font-medium">−{salePct}%</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSizeGuideOpen(true)}
            aria-label={t('Size Guide')}
            className="shrink-0 w-11 h-11 rounded-full border border-navy/25 flex items-center justify-center"
          >
            <Ruler size={16} />
          </button>
          <button
            type="button"
            onClick={handleAddToBag}
            disabled={isSoldOut}
            data-testid="sticky-add-to-bag"
            className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold ${
              isSoldOut
                ? 'bg-navy/20 text-navy/50'
                : addedPulse
                ? 'bg-green-700 text-white'
                : 'bg-navy text-white'
            }`}
          >
            {ctaLabel}
          </button>
        </div>
      </div>

      {/* Zoom lightbox */}
      {zoomOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('Product image zoom')}
        >
          <button
            type="button"
            aria-label={t('Close zoom')}
            className="absolute inset-0 border-0 p-0 bg-black/95 cursor-zoom-out"
            onClick={() => setZoomOpen(false)}
          />
          <button
            type="button"
            aria-label={t('Close zoom')}
            onClick={() => setZoomOpen(false)}
            className="absolute top-4 end-4 z-10 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
          >
            <X size={20} />
          </button>
          <img
            src={activeSrc}
            alt={product.name}
            className="relative z-[1] max-w-full max-h-full object-contain select-none"
          />
          {galleryImages.length > 1 && (
            <>
              <button
                type="button"
                aria-label={t('Previous image')}
                onClick={() =>
                  setActiveImage(i => (i - 1 + galleryImages.length) % galleryImages.length)
                }
                className="absolute start-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                aria-label={t('Next image')}
                onClick={() => setActiveImage(i => (i + 1) % galleryImages.length)}
                className="absolute end-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>
      )}

      {sizeGuideOpen && <SizeGuideModal onClose={() => setSizeGuideOpen(false)} />}
    </div>
  );
}
