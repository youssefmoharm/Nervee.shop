import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../types';

interface RotatingHeroCarouselProps {
  products: Product[];
}

const SLIDE_DURATION = 5500; // 5.5 seconds per slide
const TRANSITION_DURATION = 800; // 800ms crossfade

export default function RotatingHeroCarousel({ products }: RotatingHeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [progress, setProgress] = useState(0);

  // Auto-rotate with proper lifecycle management
  useEffect(() => {
    if (products.length <= 1) return;

    // Timer for slide rotation
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

  // Preload next image
  useEffect(() => {
    if (products.length > 1) {
      const nextProduct = products[nextIndex];
      if (nextProduct?.colors[0]?.image) {
        const img = new Image();
        img.src = nextProduct.colors[0].image;
      }
    }
  }, [nextIndex, products]);

  if (!products || products.length === 0) {
    return (
      <section className="relative h-[100svh] min-h-[600px] w-full overflow-hidden bg-navy flex items-center justify-center">
        <div className="text-center px-5">
          <h1 className="nv-heading text-5xl md:text-8xl text-white mb-6 animate-fadeUp">
            NEW DROP
          </h1>
          <p
            className="nv-edit text-xl md:text-3xl text-white/70 mb-8 animate-fadeUp"
            style={{ animationDelay: '0.2s' }}
          >
            EST. 2026
          </p>
          <Link
            to="/shop"
            className="inline-block nv-eyebrow text-white border border-white/30 px-8 py-4 hover:bg-white hover:text-navy transition-all duration-300 animate-fadeUp"
            style={{ animationDelay: '0.4s' }}
          >
            SHOP NOW
          </Link>
        </div>
      </section>
    );
  }

  const product = products[currentIndex];
  const color = product.colors[0];
  const price = `EGP ${product.price.toLocaleString()}`;

  return (
    <section className="relative h-[100svh] min-h-[600px] w-full overflow-hidden bg-navy">
      {/* Background Image Layer with Crossfade Transition */}
      <div className="absolute inset-0">
        {/* Current Image */}
        <div
          className={`absolute inset-0 transition-opacity duration-800 ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <img
            src={color?.image}
            alt={product.name}
            className="w-full h-full object-cover object-center"
          />
        </div>

        {/* Next Image (preloaded, hidden) */}
        {products.length > 1 && (
          <div
            className={`absolute inset-0 transition-opacity duration-800 ${
              isTransitioning ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img
              src={products[nextIndex]?.colors[0]?.image}
              alt={products[nextIndex]?.name}
              className="w-full h-full object-cover object-center"
            />
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/40 to-navy/20" />
        <div className="absolute inset-0 bg-checker-light opacity-20" />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 h-full flex items-center">
        <div className="mx-auto max-w-[1600px] px-5 md:px-8 w-full">
          <div className="max-w-2xl">
            <p className="nv-eyebrow text-white/80 mb-4 uppercase tracking-widest">
              {product.badge || 'New Arrivals'}
            </p>
            <h1 className="nv-heading text-5xl md:text-8xl text-white mb-6 leading-tight drop-shadow-lg">
              {product.name}
            </h1>
            <p className="nv-edit text-2xl md:text-4xl text-white/90 mb-8">{price}</p>
            <Link
              to={`/product/${product.slug}`}
              className="inline-block bg-white text-navy nv-eyebrow px-10 py-5 hover:bg-navy hover:text-white transition-all duration-300 transform hover:scale-105"
            >
              Shop Collection
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Brand Mark with Counter and Progress */}
      <div className="absolute bottom-0 left-0 right-0 z-20 h-16 md:h-24 bg-navy/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1600px] px-5 md:px-8 flex items-center justify-between h-full">
          <div className="flex items-center gap-4">
            <div className="nv-checker-mini w-8 h-8" />
            <div className="flex items-baseline gap-2">
              <span className="text-sm md:text-base text-white/80 font-semibold">
                {String(currentIndex + 1).padStart(2, '0')}
              </span>
              <span className="text-white/50">/</span>
              <span className="text-sm md:text-base text-white/80 font-semibold">
                {String(products.length).padStart(2, '0')}
              </span>
            </div>
          </div>

          <p className="text-xs md:text-sm text-white/50 uppercase tracking-widest">
            EST. 2026 • CAIRO
          </p>

          <div className="flex items-center gap-4">
            <Link
              to="/shop"
              className="text-xs md:text-sm text-white/60 hover:text-white transition-colors uppercase tracking-widest"
            >
              SHOP
            </Link>
            <Link
              to="/collections"
              className="text-xs md:text-sm text-white/60 hover:text-white transition-colors uppercase tracking-widest"
            >
              COLLECT
            </Link>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white/10">
          <div
            className="h-full bg-white transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </section>
  );
}
