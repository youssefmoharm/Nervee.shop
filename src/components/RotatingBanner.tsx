import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface BannerItem {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  link: string;
  discount?: string;
}

interface RotatingBannerProps {
  banners: BannerItem[];
}

export default function RotatingBanner({ banners }: RotatingBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);

  // Auto-rotate every 4 seconds
  useEffect(() => {
    if (!isAutoRotating || banners.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % banners.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isAutoRotating, banners.length]);

  // Pause rotation on hover
  const handleMouseEnter = () => setIsAutoRotating(false);
  const handleMouseLeave = () => setIsAutoRotating(true);

  // Navigation
  const goToPrevious = () => {
    setCurrentIndex(prev => (prev - 1 + banners.length) % banners.length);
    setIsAutoRotating(false);
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev + 1) % banners.length);
    setIsAutoRotating(false);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsAutoRotating(false);
  };

  const banner = banners[currentIndex];

  if (!banner) return null;

  return (
    <div
      className="relative w-full overflow-hidden bg-white text-navy py-3 md:py-4 px-5"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="mx-auto max-w-[1600px] flex items-center justify-between">
        {/* Left: Discount/Title */}
        <div className="flex-1 min-w-0 mr-6 md:mr-10 animate-fadeIn">
          {banner.discount && (
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-navy text-white text-xs md:text-sm px-2 py-1 uppercase tracking-wider">
                {banner.discount}
              </span>
            </div>
          )}
          <h3 className="nv-heading text-xl md:text-3xl lg:text-4xl leading-tight mb-1 md:mb-2">
            {banner.title}
          </h3>
          <p className="nv-edit text-sm md:text-lg text-navy/70 font-light">{banner.subtitle}</p>
        </div>

        {/* Center: CTA Button */}
        <div className="hidden md:block flex-shrink-0">
          <Link
            to={banner.link}
            className="inline-flex items-center gap-2 nv-eyebrow px-6 py-3 bg-navy text-white hover:bg-amber-500 hover:text-white transition-all duration-300 uppercase tracking-widest text-sm md:text-base"
          >
            {banner.cta}
          </Link>
        </div>

        {/* Right: Mobile CTA & Indicators */}
        <div className="flex items-center gap-4 md:gap-6">
          {/* Mobile CTA Button */}
          <Link
            to={banner.link}
            className="md:hidden inline-flex nv-eyebrow px-4 py-2 bg-navy text-white uppercase tracking-widest text-xs"
          >
            {banner.cta}
          </Link>

          {/* Slide Indicators */}
          <div className="hidden md:flex items-center gap-3">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`transition-all duration-300 rounded-full ${
                  index === currentIndex ? 'w-6 h-1 bg-navy' : 'w-1 h-1 bg-navy/30 hover:bg-navy/50'
                }`}
                aria-label={`Go to banner ${index + 1}`}
                aria-current={index === currentIndex}
              />
            ))}
          </div>

          {/* Navigation Arrows (Desktop) */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={goToPrevious}
              className="w-8 h-8 rounded-full bg-navy/10 hover:bg-navy/20 flex items-center justify-center transition-colors"
              aria-label="Previous banner"
            >
              <svg
                className="w-4 h-4 text-navy"
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
              className="w-8 h-8 rounded-full bg-navy/10 hover:bg-navy/20 flex items-center justify-center transition-colors"
              aria-label="Next banner"
            >
              <svg
                className="w-4 h-4 text-navy"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          {/* Slide Counter (Mobile) */}
          <div className="md:hidden">
            <span className="text-xs text-navy/50">
              {currentIndex + 1} / {banners.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
