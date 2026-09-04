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
      className="relative w-full overflow-hidden bg-navy text-white"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background Image */}
      {banner.image && (
        <div className="absolute inset-0 z-0">
          <img src={banner.image} alt={banner.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-navy/90 via-navy/70 to-transparent" />
        </div>
      )}

      <div className="relative z-10 w-full py-8 md:py-12 px-5">
        <div className="mx-auto max-w-[1600px] flex items-center justify-between">
          {/* Left: Product Info */}
          <div className="flex-1 min-w-0 mr-6 md:mr-12 animate-fadeIn">
            {banner.discount && (
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-amber-500 text-white text-xs md:text-sm px-3 py-1.5 uppercase tracking-wider font-semibold">
                  {banner.discount}
                </span>
                <span className="text-white/70 text-xs md:text-sm uppercase tracking-widest">
                  {banner.subtitle}
                </span>
              </div>
            )}
            <h3 className="nv-heading text-3xl md:text-5xl lg:text-6xl leading-tight mb-3 md:mb-4">
              {banner.title}
            </h3>
            <p className="nv-edit text-lg md:text-2xl text-white/80 font-light mb-6">
              Now Available
            </p>
            <Link
              to={banner.link}
              className="inline-flex items-center gap-2 nv-eyebrow px-8 py-4 bg-white text-navy hover:bg-amber-500 hover:text-white transition-all duration-300 uppercase tracking-widest text-base md:text-lg"
            >
              {banner.cta} <span className="text-lg">→</span>
            </Link>
          </div>

          {/* Right: Indicators & Controls */}
          <div className="flex items-center gap-6 md:gap-8">
            {/* Slide Indicators */}
            <div className="hidden md:flex flex-col items-center gap-3">
              {banners.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`transition-all duration-300 rounded-full ${
                    index === currentIndex
                      ? 'w-8 h-3 bg-white'
                      : 'w-3 h-3 bg-white/30 hover:bg-white/50'
                  }`}
                  aria-label={`Go to product ${index + 1}`}
                  aria-current={index === currentIndex}
                />
              ))}
            </div>

            {/* Navigation Arrows */}
            <div className="flex items-center gap-3">
              <button
                onClick={goToPrevious}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all backdrop-blur-sm border border-white/20"
                aria-label="Previous product"
              >
                <svg
                  className="w-6 h-6 text-white"
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
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all backdrop-blur-sm border border-white/20"
                aria-label="Next product"
              >
                <svg
                  className="w-6 h-6 text-white"
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

            {/* Slide Counter */}
            <div className="hidden md:flex flex-col items-end gap-1">
              <span className="text-2xl font-bold text-white">{currentIndex + 1}</span>
              <span className="text-xs text-white/50 uppercase tracking-widest">
                OF {banners.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
