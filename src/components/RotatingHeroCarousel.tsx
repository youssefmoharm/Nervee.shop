import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '../types';

interface RotatingHeroCarouselProps {
  products: Product[];
}

export default function RotatingHeroCarousel({ products }: RotatingHeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  // Auto-rotate every 5 seconds
  useEffect(() => {
    if (!isAutoRotating || products.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % products.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoRotating, products.length]);

  // Pause rotation on hover
  const handleMouseEnter = () => setIsAutoRotating(false);
  const handleMouseLeave = () => setIsAutoRotating(true);

  // Navigation
  const goToPrevious = () => {
    setCurrentIndex(prev => (prev - 1 + products.length) % products.length);
    setIsAutoRotating(false);
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev + 1) % products.length);
    setIsAutoRotating(false);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsAutoRotating(false);
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const end = e.changedTouches[0].clientX;
    const diff = touchStart - end;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }
    setTouchStart(null);
  };

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
    <section
      className="relative h-[100svh] min-h-[600px] w-full overflow-hidden bg-navy"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Carousel Container */}
      <div className="absolute inset-0">
        {/* Background Image with smooth fade transition */}
        <div className="absolute inset-0 transition-opacity duration-700">
          <img
            src={color?.image}
            alt={product.name}
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/40 to-navy/20" />
          <div className="absolute inset-0 bg-checker-light opacity-20" />
        </div>
      </div>

      {/* Content with fade animation */}
      <div className="relative z-10 h-full flex items-center">
        <div className="mx-auto max-w-[1600px] px-5 md:px-8 w-full">
          <div
            className="max-w-2xl animate-fadeUp transition-opacity duration-500"
            key={`slide-${currentIndex}`}
          >
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

      {/* Navigation Arrows */}
      <button
        onClick={goToPrevious}
        className="absolute left-5 md:left-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur-sm border border-white/20 hover:border-white/40 group"
        aria-label="Previous slide"
      >
        <ChevronLeft className="text-white group-hover:scale-110 transition-transform" size={24} />
      </button>

      <button
        onClick={goToNext}
        className="absolute right-5 md:right-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur-sm border border-white/20 hover:border-white/40 group"
        aria-label="Next slide"
      >
        <ChevronRight className="text-white group-hover:scale-110 transition-transform" size={24} />
      </button>

      {/* Slide Indicators */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        {products.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`transition-all duration-300 rounded-full ${
              index === currentIndex ? 'w-8 h-2 bg-white' : 'w-2 h-2 bg-white/40 hover:bg-white/60'
            }`}
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === currentIndex}
          />
        ))}
      </div>

      {/* Slide Counter */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
        <p className="nv-eyebrow text-white/60 text-xs uppercase tracking-widest">
          {currentIndex + 1} / {products.length}
        </p>
      </div>

      {/* Bottom Brand Mark */}
      <div className="absolute bottom-0 left-0 right-0 z-20 h-16 md:h-24 bg-navy/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1600px] px-5 md:px-8 flex items-center justify-between h-full">
          <div className="nv-checker-mini w-8 h-8" />
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
      </div>
    </section>
  );
}
