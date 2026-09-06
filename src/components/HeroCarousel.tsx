import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselSlide {
  id: string;
  headline: string;
  description?: string;
  ctaLabel: string;
  ctaLink: string;
  backgroundImage: string;
}

const slides: CarouselSlide[] = [
  {
    id: 'slide-1',
    headline: 'UP TO 60%\nOFF',
    description: 'New Season Collection',
    ctaLabel: 'SHOP',
    ctaLink: '/shop?category=New%20Arrivals',
    backgroundImage: 'nerve-hero-2026',
  },
  {
    id: 'slide-2',
    headline: 'EVERYDAY\nESSENTIALS',
    description: 'Core Collection',
    ctaLabel: 'SHOP',
    ctaLink: '/collections/core-essentials',
    backgroundImage: 'nerve-core-essentials',
  },
  {
    id: 'slide-3',
    headline: 'LIMITED\nEDITION',
    description: 'Archive Pieces',
    ctaLabel: 'SHOP',
    ctaLink: '/collections/nerve-archive',
    backgroundImage: 'nerve-archive-edit',
  },
  {
    id: 'slide-4',
    headline: 'TECHNICAL\nWEAR',
    description: 'Street Form',
    ctaLabel: 'SHOP',
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextSlide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    <section
      className="relative w-full h-screen min-h-[600px] overflow-hidden focus:outline-navy focus:ring-2"
      style={{ backgroundColor: '#FFFFFF' }}
      aria-label="Featured products carousel"
    >
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
              style={{ backgroundColor: '#031230' }}
            >
              <img
                src={img(s.backgroundImage)}
                alt={s.headline}
                fetchPriority={index === 0 ? 'high' : 'low'}
                loading={index === 0 ? 'eager' : 'lazy'}
                decoding="async"
                className="w-full h-full object-cover object-center"
                onError={e => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.parentElement) {
                    e.currentTarget.parentElement.style.backgroundColor = '#031230';
                  }
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Subtle Overlay - minimal, lets image show */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-opacity-60 via-opacity-40 to-transparent"
        style={{
          background:
            'linear-gradient(to right, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.4), transparent)',
        }}
      />

      {/* Content - Left Side */}
      <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12 pb-1/3">
        {/* Headline (Left side) - positioned much lower */}
        <div className="z-10 max-w-lg mb-auto pt-96">
          <h1
            key={`headline-${currentSlide}`}
            className={`nv-heading font-black text-6xl md:text-7xl lg:text-8xl leading-none mb-6 transition-all duration-700 ease-out whitespace-pre-line ${
              direction === 'next' ? 'animate-slide-in-from-left' : 'animate-slide-in-from-right'
            }`}
            style={{ color: '#031230' }}
          >
            {slide.headline}
          </h1>
          {slide.description && (
            <p
              className="nv-eyebrow text-xs mb-8 uppercase tracking-wider"
              style={{ color: '#000000' }}
            >
              {slide.description}
            </p>
          )}
          <Link
            to={slide.ctaLink}
            className="inline-block px-6 py-3 nv-eyebrow font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#031230', color: '#FFFFFF' }}
          >
            {slide.ctaLabel}
          </Link>
        </div>

        {/* Bottom - Navigation */}
        <div className="z-10 flex items-center justify-between mt-12">
          <div className="flex gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
                className="transition-all duration-300 h-1"
                style={{
                  width: index === currentSlide ? '32px' : '8px',
                  backgroundColor: index === currentSlide ? '#031230' : '#AAAAAA',
                }}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={prevSlide}
              aria-label="Previous slide"
              className="p-2 transition-colors hover:opacity-70 focus:outline-navy focus:ring-2 focus:ring-offset-2"
              style={{ color: '#AAAAAA' }}
            >
              <ChevronLeft size={24} strokeWidth={1.5} />
            </button>
            <button
              onClick={nextSlide}
              aria-label="Next slide"
              className="p-2 transition-colors hover:opacity-70 focus:outline-navy focus:ring-2 focus:ring-offset-2"
              style={{ color: '#AAAAAA' }}
            >
              <ChevronRight size={24} strokeWidth={1.5} />
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
