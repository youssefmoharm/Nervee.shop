import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselSlide {
  id: string;
  headline: string;
  subtitle?: string;
  ctaLabel: string;
  ctaLink: string;
  backgroundImage: string;
}

const slides: CarouselSlide[] = [
  {
    id: 'slide-1',
    headline: 'UP TO 60%\nOFF',
    subtitle: 'New Season Collection',
    ctaLabel: 'Shop Now',
    ctaLink: '/shop?category=New%20Arrivals',
    backgroundImage: 'nerve-hero-2026',
  },
  {
    id: 'slide-2',
    headline: 'EVERYDAY\nESSENTIALS',
    subtitle: 'Core Collection',
    ctaLabel: 'Shop',
    ctaLink: '/collections/core-essentials',
    backgroundImage: 'nerve-core-essentials',
  },
  {
    id: 'slide-3',
    headline: 'LIMITED\nEDITION',
    subtitle: 'Archive Pieces',
    ctaLabel: 'Browse',
    ctaLink: '/collections/nerve-archive',
    backgroundImage: 'nerve-archive-edit',
  },
  {
    id: 'slide-4',
    headline: 'TECHNICAL\nWEAR',
    subtitle: 'Street Form',
    ctaLabel: 'Explore',
    ctaLink: '/collections/street-form',
    backgroundImage: 'nerve-street-form',
  },
];

const img = (seed: string, w = 1800, h = 2400) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

export default function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setDirection('next');
      setCurrentSlide(prev => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const goToSlide = (index: number) => {
    setDirection(index > currentSlide ? 'next' : 'prev');
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 8000);
  };

  const nextSlide = () => {
    setDirection('next');
    setCurrentSlide(prev => (prev + 1) % slides.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 8000);
  };

  const prevSlide = () => {
    setDirection('prev');
    setCurrentSlide(prev => (prev - 1 + slides.length) % slides.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 8000);
  };

  const slide = slides[currentSlide];

  return (
    <section className="relative w-full h-screen min-h-[600px] overflow-hidden bg-mist">
      {/* Background Images */}
      <div className="absolute inset-0">
        {slides.map((s, index) => {
          const isVisible = index === currentSlide;
          return (
            <div
              key={s.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                isVisible ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <img
                src={img(s.backgroundImage)}
                alt={s.headline}
                fetchPriority={index === 0 ? 'high' : 'low'}
                loading={index === 0 ? 'eager' : 'lazy'}
                decoding="async"
                className="w-full h-full object-cover object-center"
              />
            </div>
          );
        })}
      </div>

      {/* Minimal Overlay - navy gradient from left */}
      <div className="absolute inset-0 bg-gradient-to-r from-navy/40 via-navy/20 to-transparent" />

      {/* Content - Left Side */}
      <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8 md:p-12">
        {/* Top - Branding */}
        <div className="z-10">
          <div className="text-paper font-black text-xs sm:text-sm tracking-widest uppercase mb-2">
            NERVE.
          </div>
        </div>

        {/* Middle - Headline (Left side) */}
        <div className="z-10 max-w-md">
          <h1
            key={`headline-${currentSlide}`}
            className={`text-warning font-black text-5xl sm:text-6xl md:text-7xl leading-none mb-4 transition-all duration-700 ease-out ${
              direction === 'next' ? 'animate-slide-in-from-left' : 'animate-slide-in-from-right'
            }`}
          >
            {slide.headline}
          </h1>
          {slide.subtitle && (
            <p className="text-silver text-xs sm:text-sm uppercase tracking-wider mb-6">
              {slide.subtitle}
            </p>
          )}
          <Link
            to={slide.ctaLink}
            className="inline-block bg-warning text-paper px-8 py-3 font-bold text-sm uppercase tracking-wider hover:bg-opacity-90 transition-all"
          >
            {slide.ctaLabel}
          </Link>
        </div>

        {/* Bottom - Navigation */}
        <div className="z-10 flex items-center justify-between">
          <div className="flex gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
                className={`transition-all duration-300 h-0.5 ${
                  index === currentSlide ? 'w-8 bg-warning' : 'w-2 bg-paper/50 hover:bg-paper/70'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-4">
            <button
              onClick={prevSlide}
              aria-label="Previous slide"
              className="p-2 text-paper hover:text-warning transition-colors"
            >
              <ChevronLeft size={28} strokeWidth={1.5} />
            </button>
            <button
              onClick={nextSlide}
              aria-label="Next slide"
              className="p-2 text-paper hover:text-warning transition-colors"
            >
              <ChevronRight size={28} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-in-from-left {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slide-in-from-right {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slide-in-from-left {
          animation: slide-in-from-left 0.7s ease-out;
        }
        .animate-slide-in-from-right {
          animation: slide-in-from-right 0.7s ease-out;
        }
      `}</style>
    </section>
  );
}
