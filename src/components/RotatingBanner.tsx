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

  // Auto-rotate every 6 seconds
  useEffect(() => {
    if (!isAutoRotating || banners.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % banners.length);
    }, 6000);

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

  const banner = banners[currentIndex];

  if (!banner) return null;

  return (
    <div
      className="relative w-full h-screen md:h-[600px] overflow-hidden bg-black"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background Image - Full Screen */}
      {banner.image && (
        <div className="absolute inset-0">
          <img
            src={banner.image}
            alt={banner.title}
            className="w-full h-full object-cover object-center"
          />
          {/* Subtle Gradient Overlay - Bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>
      )}

      {/* Content Container */}
      <div className="absolute inset-0 z-10 flex flex-col justify-between p-5 md:p-8">
        {/* Top Navigation Spacer */}
        <div />

        {/* Bottom Content */}
        <div className="flex items-end justify-between">
          {/* Left: Product Info & Counter */}
          <div className="space-y-6 md:space-y-8">
            {/* Product Info */}
            <div>
              <h2 className="nv-heading text-3xl md:text-5xl lg:text-6xl text-white leading-tight mb-2">
                {banner.title}
              </h2>
              <p className="nv-eyebrow text-white/80 text-sm md:text-base uppercase tracking-widest">
                {banner.subtitle}
              </p>
            </div>

            {/* Counter - Bottom Left */}
            <div className="flex items-baseline gap-2">
              <span className="text-base md:text-lg text-white/70 uppercase tracking-widest">
                {String(currentIndex + 1).padStart(2, '0')}
              </span>
              <span className="text-white/50">/</span>
              <span className="text-base md:text-lg text-white/70 uppercase tracking-widest">
                {String(banners.length).padStart(2, '0')}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-32 md:w-48 h-0.5 bg-white/20">
              <div
                className="h-full bg-white transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / banners.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Right: CTA Button */}
          <Link to={banner.link} className="inline-flex flex-col items-end gap-3 group">
            <span className="nv-eyebrow text-white uppercase tracking-widest text-sm md:text-base font-semibold group-hover:text-amber-500 transition-colors">
              {banner.cta}
            </span>
            <div className="w-8 h-0.5 bg-white group-hover:bg-amber-500 transition-colors" />
          </Link>
        </div>
      </div>

      {/* Navigation Arrows - Hidden by Default, Show on Hover */}
      <div className="absolute left-5 md:left-8 top-1/2 -translate-y-1/2 z-20 opacity-0 hover:opacity-100 transition-opacity">
        <button
          onClick={goToPrevious}
          className="text-white/50 hover:text-white transition-colors"
          aria-label="Previous"
        >
          <svg
            className="w-6 h-6 md:w-8 md:h-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      <div className="absolute right-5 md:right-8 top-1/2 -translate-y-1/2 z-20 opacity-0 hover:opacity-100 transition-opacity">
        <button
          onClick={goToNext}
          className="text-white/50 hover:text-white transition-colors"
          aria-label="Next"
        >
          <svg
            className="w-6 h-6 md:w-8 md:h-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Dot Indicators - Bottom Center */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {banners.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setCurrentIndex(index);
              setIsAutoRotating(false);
            }}
            className={`transition-all duration-300 rounded-full ${
              index === currentIndex ? 'w-3 h-3 bg-white' : 'w-2 h-2 bg-white/40 hover:bg-white/60'
            }`}
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === currentIndex}
          />
        ))}
      </div>
    </div>
  );
}
