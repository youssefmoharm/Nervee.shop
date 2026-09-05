import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselSlide {
  id: string;
  headline: string;
  description: string;
  ctaLabel: string;
  ctaLink: string;
  backgroundImage: string;
  eyebrow: string;
}

const slides: CarouselSlide[] = [
  {
    id: 'slide-1',
    eyebrow: 'New Season - 2026',
    headline: 'COOL BUT\nCHIC',
    description:
      "Based in everyone's closet. NERVE is a concept store for individuality and movement - the new drop is here.",
    ctaLabel: 'Shop the Drop',
    ctaLink: '/shop?category=New%20Arrivals',
    backgroundImage: 'nerve-hero-2026',
  },
  {
    id: 'slide-2',
    eyebrow: 'Core Essentials',
    headline: 'EVERYDAY\nPIECES',
    description:
      'Heavyweight cotton staples designed to be lived in, worn out, and reached for first. The foundation of the NERVE closet.',
    ctaLabel: 'Shop Essentials',
    ctaLink: '/collections/core-essentials',
    backgroundImage: 'nerve-core-essentials',
  },
  {
    id: 'slide-3',
    eyebrow: 'Archive Edition',
    headline: 'SMALL\nBATCH',
    description:
      "Limited editions that don't come back. Numbered pieces for the ones who were there first. Each piece is unique.",
    ctaLabel: 'Browse Archive',
    ctaLink: '/collections/nerve-archive',
    backgroundImage: 'nerve-archive-edit',
  },
  {
    id: 'slide-4',
    eyebrow: 'Street Form',
    headline: 'BUILT FOR\nMOVEMENT',
    description:
      'Technical fabrics and articulated cuts built for the pace of the city - engineered comfort with a sharp silhouette.',
    ctaLabel: 'Explore Street Form',
    ctaLink: '/collections/street-form',
    backgroundImage: 'nerve-street-form',
  },
];

const img = (seed: string, w = 1800, h = 2400) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

export default function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slides.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const nextSlide = () => {
    setCurrentSlide(prev => (prev + 1) % slides.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const prevSlide = () => {
    setCurrentSlide(prev => (prev - 1 + slides.length) % slides.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const slide = slides[currentSlide];

  return (
    <section className="relative h-[100svh] min-h-[560px] flex items-end overflow-hidden bg-navy">
      <div className="absolute inset-0">
        {slides.map((s, index) => (
          <div
            key={s.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img
              src={img(s.backgroundImage)}
              alt={s.headline}
              fetchPriority={index === 0 ? 'high' : 'low'}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/40 to-navy/20" />

      <div className="relative w-full px-5 md:px-8 pb-14 md:pb-20">
        <div className="mx-auto max-w-[1600px]">
          <div className="transition-all duration-700 ease-out" key={`content-${currentSlide}`}>
            <p className="nv-eyebrow text-silver mb-3">{slide.eyebrow}</p>
            <h1 className="nv-heading text-[16vw] sm:text-[13vw] md:text-[9vw] lg:text-[7.5vw] leading-[0.85] whitespace-pre-line">
              {slide.headline}
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mt-8">
              <p className="text-silver max-w-sm text-sm md:text-base">{slide.description}</p>
              <Link
                to={slide.ctaLink}
                className="group inline-flex items-center gap-3 bg-white text-navy px-8 py-4 nv-eyebrow flex-shrink-0 hover:bg-mist transition-colors w-fit"
              >
                {slide.ctaLabel}
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4">
        <div className="flex gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
              className={`h-2 transition-all duration-300 ${
                index === currentSlide ? 'w-8 bg-white' : 'w-2 bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>

      <button
        onClick={prevSlide}
        aria-label="Previous slide"
        className="absolute left-5 md:left-8 top-1/2 -translate-y-1/2 z-10 p-2 text-white/60 hover:text-white transition-colors"
      >
        <ChevronLeft size={24} />
      </button>

      <button
        onClick={nextSlide}
        aria-label="Next slide"
        className="absolute right-5 md:right-8 top-1/2 -translate-y-1/2 z-10 p-2 text-white/60 hover:text-white transition-colors"
      >
        <ChevronRight size={24} />
      </button>
    </section>
  );
}
