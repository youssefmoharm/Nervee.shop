import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface BannerItem {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  link: string;
  discount?: string;
  image?: string;
}

interface RotatingBannerProps {
  banners: BannerItem[];
}

export default function RotatingBanner({ banners }: RotatingBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Auto-rotate every 5 seconds
  useEffect(() => {
    if (!isAutoRotating || banners.length <= 1) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % banners.length);
        setIsTransitioning(false);
      }, 300);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoRotating, banners.length]);

  // Pause rotation on hover
  const handleMouseEnter = () => setIsAutoRotating(false);
  const handleMouseLeave = () => setIsAutoRotating(true);

  // Navigation
  const goToPrevious = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => (prev - 1 + banners.length) % banners.length);
      setIsTransitioning(false);
    }, 300);
    setIsAutoRotating(false);
  };

  const goToNext = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % banners.length);
      setIsTransitioning(false);
    }, 300);
    setIsAutoRotating(false);
  };

  const goToSlide = (index: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(index);
      setIsTransitioning(false);
    }, 300);
    setIsAutoRotating(false);
  };

  const banner = banners[currentIndex];

  if (!banner) return null;

  return (
    <div
      className="relative w-full h-96 md:h-[500px] lg:h-[600px] overflow-hidden bg-black"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background Image - Right Side */}
      {banner.image && (
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <img
            src={banner.image}
            alt={banner.title}
            className="w-full h-full object-cover object-center"
          />
          {/* Gradient Overlay - Left to Right */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
        </div>
      )}

      {/* Content - Left Side */}
      <div className="absolute inset-0 z-10 flex items-center">
        <div className="w-full px-5 md:px-8 md:max-w-[50%]">
          <div className="space-y-4 md:space-y-6">
            {/* Discount Badge */}
            {banner.discount && (
              <div className="flex items-center gap-3">
                <div className="h-1 w-8 bg-amber-500" />
                <span className="nv-eyebrow text-amber-500 text-xs md:text-sm uppercase tracking-widest font-semibold">
                  {banner.discount}
                </span>
              </div>
            )}

            {/* Title */}
            <h2 className="nv-heading text-4xl md:text-6xl lg:text-7xl leading-tight text-white">
              {banner.title}
            </h2>

            {/* Subtitle */}
            <p className="nv-edit text-lg md:text-xl text-white/80 max-w-md">{banner.subtitle}</p>

            {/* CTA Button */}
            <div className="pt-4">
              <Link
                to={banner.link}
                className="inline-flex items-center gap-3 nv-eyebrow px-8 md:px-10 py-4 md:py-5 bg-white text-black hover:bg-amber-500 hover:text-white transition-all duration-300 uppercase tracking-widest text-sm md:text-base font-semibold"
              >
                {banner.cta}
                <span className="text-lg">→</span>
              </Link>
            </div>

            {/* Counter */}
            <div className="pt-6 flex items-baseline gap-2">
              <span className="text-4xl md:text-5xl font-bold text-white">
                {String(currentIndex + 1).padStart(2, '0')}
              </span>
              <span className="text-white/50 text-sm uppercase tracking-widest">
                / {String(banners.length).padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation Indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        {banners.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`transition-all duration-300 ${
              index === currentIndex
                ? 'w-12 h-1.5 bg-white'
                : 'w-6 h-1 bg-white/40 hover:bg-white/60'
            }`}
            aria-label={`Go to product ${index + 1}`}
            aria-current={index === currentIndex}
          />
        ))}
      </div>

      {/* Navigation Arrows */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-4">
        <button
          onClick={goToPrevious}
          className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all backdrop-blur-sm border border-white/20 group"
          aria-label="Previous product"
        >
          <svg
            className="w-5 h-5 text-white group-hover:scale-110 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <button
          onClick={goToNext}
          className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all backdrop-blur-sm border border-white/20 group"
          aria-label="Next product"
        >
          <svg
            className="w-5 h-5 text-white group-hover:scale-110 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
