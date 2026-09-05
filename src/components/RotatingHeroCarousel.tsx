import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../types';

interface RotatingHeroCarouselProps {
  products: Product[];
}

const SLIDE_DURATION = 5500; // 5.5 seconds per product
const TRANSITION_DURATION = 800; // 800ms crossfade
const EDITORIAL_COLORS = [
  'from-teal-600 to-teal-700',
  'from-slate-700 to-slate-800',
  'from-amber-700 to-amber-800',
  'from-indigo-700 to-indigo-800',
];

export default function RotatingHeroCarousel({ products }: RotatingHeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [progress, setProgress] = useState(0);

  // Auto-rotate through products
  useEffect(() => {
    if (!products || products.length <= 1) return;

    // Timer for product rotation
    const slideTimer = setInterval(() => {
      setIsTransitioning(true);

      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % products.length);
        setNextIndex(prev => (prev + 1) % products.length);
        setProgress(0);
        setIsTransitioning(false);
      }, TRANSITION_DURATION);
    }, SLIDE_DURATION);

    // Timer for progress bar animation
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        const increment = (100 / SLIDE_DURATION) * 50; // Update every 50ms
        return prev + increment > 100 ? 100 : prev + increment;
      });
    }, 50);

    return () => {
      clearInterval(slideTimer);
      clearInterval(progressTimer);
    };
  }, [products.length]);

  // Preload next product hero image
  useEffect(() => {
    if (!products || products.length <= 1) return;
    const nextProduct = products[nextIndex];
    if (nextProduct?.colors?.[0]?.image) {
      const img = new Image();
      img.src = nextProduct.colors[0].image;
    }
  }, [nextIndex, products]);

  if (!products || products.length === 0) {
    return (
      <section className="relative h-[100svh] min-h-[600px] w-full overflow-hidden bg-slate-900 flex items-center justify-center">
        <div className="text-center px-5">
          <h1 className="text-5xl md:text-8xl text-white mb-6 font-black">NEW COLLECTION</h1>
          <p className="text-xl md:text-3xl text-white/70 mb-8">Coming Soon</p>
          <Link
            to="/shop"
            className="inline-block bg-white/95 text-slate-900 px-8 py-4 uppercase tracking-widest font-bold hover:bg-white transition-all"
          >
            SHOP NOW
          </Link>
        </div>
      </section>
    );
  }

  const currentProduct = products[currentIndex];
  const nextProduct = products[nextIndex];
  const currentHeroImage = currentProduct?.colors?.[0]?.image;
  const nextHeroImage = nextProduct?.colors?.[0]?.image;
  const price = `EGP ${currentProduct?.price?.toLocaleString()}`;
  const colorGradient = EDITORIAL_COLORS[currentIndex % EDITORIAL_COLORS.length];

  return (
    <section className="relative h-[100svh] min-h-[600px] w-full overflow-hidden bg-slate-900">
      {/* Background Gradient - Premium Editorial Color */}
      <div className={`absolute inset-0 bg-gradient-to-br ${colorGradient} opacity-90`} />

      {/* Background Product Image - Right Side */}
      <div className="absolute inset-0">
        {/* Current Image */}
        <div
          className={`absolute inset-0 transition-opacity ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ transitionDuration: `${TRANSITION_DURATION}ms` }}
        >
          <img
            src={currentHeroImage}
            alt={currentProduct?.name}
            className="w-full h-full object-cover object-center"
          />
        </div>

        {/* Next Image */}
        {products.length > 1 && (
          <div
            className={`absolute inset-0 transition-opacity ${
              isTransitioning ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ transitionDuration: `${TRANSITION_DURATION}ms` }}
          >
            <img
              src={nextHeroImage}
              alt={nextProduct?.name}
              className="w-full h-full object-cover object-center"
            />
          </div>
        )}
      </div>

      {/* Dark Overlay for Text Readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent" />

      {/* Content Layer - Left Side Editorial Layout */}
      <div className="relative z-10 h-full flex flex-col justify-between">
        {/* Top Navigation */}
        <div className="pt-8 px-8 md:px-12 flex items-center justify-between">
          <div className="w-8 h-8 rounded-full border-2 border-white/40" />
          <div className="flex gap-4 text-white/60 text-xs uppercase tracking-widest">
            <button className="hover:text-white transition-colors">SHOP</button>
            <button className="hover:text-white transition-colors">ABOUT</button>
          </div>
        </div>

        {/* Hero Content */}
        <div className="px-8 md:px-12 pb-20 max-w-2xl">
          {/* Category Label */}
          <p className="text-white/70 text-xs uppercase tracking-[0.2em] mb-6 font-light">
            {currentProduct?.badge || 'New Collection'}
          </p>

          {/* Main Headline */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-8 leading-none drop-shadow-2xl">
            {currentProduct?.name}
          </h1>

          {/* Price */}
          <p className="text-white/90 text-lg md:text-2xl mb-8 font-light tracking-wide">{price}</p>

          {/* CTA Button */}
          <Link
            to={`/product/${currentProduct?.slug}`}
            className="inline-block bg-white/95 text-slate-900 px-8 md:px-10 py-3 md:py-4 text-xs md:text-sm uppercase tracking-[0.15em] font-bold hover:bg-white transition-all duration-300 shadow-lg"
          >
            Shop Collection
          </Link>
        </div>

        {/* Bottom Counter and Progress */}
        <div className="px-8 md:px-12 pb-8">
          <div className="flex items-center gap-4 text-white/80 mb-4">
            <span className="text-sm font-semibold">
              {String(currentIndex + 1).padStart(2, '0')} /{' '}
              {String(products.length).padStart(2, '0')}
            </span>
          </div>
          <div className="w-24 h-0.5 bg-white/20">
            <div
              className="h-full bg-white transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
