import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useI18n } from '../lib/i18n';

interface CarouselSlide {
  id: string;
  eyebrow: string;
  description: string;
  ctaLabel: string;
  ctaLink: string;
}

/** Editorial slides — no discount claims unless a live promo backs them. */
const slides: CarouselSlide[] = [
  {
    id: 'slide-1',
    eyebrow: 'New Season',
    description: 'The pieces that become part of who you are. Shop the new collection.',
    ctaLabel: 'Shop New Drop',
    ctaLink: '/shop?category=New%20Arrivals',
  },
  {
    id: 'slide-2',
    eyebrow: 'Core Essentials',
    description: 'Heavyweight cotton staples you reach for first. Cool but chic, always.',
    ctaLabel: 'Shop Core',
    ctaLink: '/collections/core-essentials',
  },
  {
    id: 'slide-3',
    eyebrow: 'Nerve Archive',
    description: 'Numbered releases. Small batches. Never coming back.',
    ctaLabel: 'Shop Archive',
    ctaLink: '/collections/nerve-archive',
  },
  {
    id: 'slide-4',
    eyebrow: 'Street Form',
    description: 'Technical cuts built for the pace of the city.',
    ctaLabel: 'Shop Street Form',
    ctaLink: '/collections/street-form',
  },
];

const AUTOPLAY_MS = 6000;

export default function HeroCarousel() {
  const { t } = useI18n();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clearResumeTimer = () => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  };

  useEffect(() => () => clearResumeTimer(), []);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
    clearResumeTimer();
    resumeTimerRef.current = setTimeout(() => {
      resumeTimerRef.current = null;
    }, AUTOPLAY_MS);
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentSlide(prev => (prev + 1) % slides.length);
    clearResumeTimer();
    resumeTimerRef.current = setTimeout(() => {
      resumeTimerRef.current = null;
    }, AUTOPLAY_MS);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide(prev => (prev - 1 + slides.length) % slides.length);
    clearResumeTimer();
    resumeTimerRef.current = setTimeout(() => {
      resumeTimerRef.current = null;
    }, AUTOPLAY_MS);
  }, []);

  const autoplayActive = !prefersReducedMotion && !isPaused && !userPaused;

  useEffect(() => {
    if (!autoplayActive) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(interval);
  }, [autoplayActive]);

  // Attach interaction handlers via the ref (section is non-interactive in JSX —
  // arrow keys / hover pause only apply while the hero itself is engaged).
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextSlide();
      }
    };
    const onPointerEnter = () => setIsPaused(true);
    const onPointerLeave = () => setIsPaused(false);
    const onFocusIn = () => setIsPaused(true);
    const onFocusOut = (e: FocusEvent) => {
      if (!el.contains(e.relatedTarget as Node | null)) setIsPaused(false);
    };

    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('pointerenter', onPointerEnter);
    el.addEventListener('pointerleave', onPointerLeave);
    el.addEventListener('focusin', onFocusIn);
    el.addEventListener('focusout', onFocusOut);
    return () => {
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('pointerenter', onPointerEnter);
      el.removeEventListener('pointerleave', onPointerLeave);
      el.removeEventListener('focusin', onFocusIn);
      el.removeEventListener('focusout', onFocusOut);
    };
  }, [nextSlide, prevSlide]);

  const slide = slides[currentSlide];

  return (
    <section
      ref={sectionRef}
      className="relative w-full min-h-[100svh] overflow-hidden bg-navy text-paper"
      aria-roledescription="carousel"
      aria-label={t('Featured collections')}
    >
      {/* Brand surface — navy field + signature checker accents (no stock filler art) */}
      <div className="absolute inset-0 bg-navy" aria-hidden="true">
        <div className="absolute inset-0 opacity-[0.07] nv-checker-inv" />
        <div className="absolute -end-24 -top-24 w-[420px] h-[420px] md:w-[560px] md:h-[560px] bg-navy-2 rotate-12" />
        <div className="absolute -start-32 -bottom-40 w-[380px] h-[380px] md:w-[520px] md:h-[520px] nv-checker opacity-20" />
        <div
          className="absolute inset-y-0 start-0 w-full md:w-1/2 bg-gradient-to-r from-navy via-navy/85 to-transparent"
          style={{
            background:
              'linear-gradient(90deg, #061735 0%, rgba(6,23,53,0.92) 42%, rgba(6,23,53,0) 100%)',
          }}
        />
      </div>

      {/* Slide indicator bar */}
      <div
        className="absolute top-0 start-0 h-1 bg-white/15"
        aria-hidden="true"
        style={{
          width: `${((currentSlide + 1) / slides.length) * 100}%`,
          transition: 'width 0.5s ease',
        }}
      />

      <div className="relative z-10 mx-auto max-w-[1600px] min-h-[100svh] px-5 md:px-8 pt-24 md:pt-28 pb-10 flex flex-col justify-end">
        <div className="max-w-xl md:max-w-2xl" aria-live="polite" aria-atomic="true">
          <p className="nv-eyebrow text-white mb-4">{t(slide.eyebrow)}</p>
          {/* Single stable H1 — does not swap with slide content (SEO + a11y) */}
          <h1 className="nv-heading text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[0.92] mb-5">
            Cool but Chic
          </h1>
          <p key={slide.id} className="text-base md:text-lg text-white max-w-md mb-8">
            {t(slide.description)}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={slide.ctaLink}
              className="inline-flex items-center justify-center bg-white text-navy nv-eyebrow px-7 py-3.5 hover:bg-mist transition-colors"
            >
              {t(slide.ctaLabel)}
            </Link>
            <Link
              to="/shop"
              className="inline-flex items-center justify-center border border-white/40 text-white nv-eyebrow px-7 py-3.5 hover:bg-white/10 transition-colors"
            >
              {t('Shop all')}
            </Link>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="mt-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2" role="tablist" aria-label={t('Slide controls')}>
            {slides.map((s, index) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={index === currentSlide}
                aria-label={`${t('Go to slide')} ${index + 1}`}
                onClick={() => goToSlide(index)}
                className="h-1.5 transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-4"
                style={{
                  width: index === currentSlide ? '36px' : '12px',
                  backgroundColor: index === currentSlide ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1">
            {!prefersReducedMotion && (
              <button
                type="button"
                onClick={() => setUserPaused(p => !p)}
                aria-label={userPaused ? t('Play slideshow') : t('Pause slideshow')}
                aria-pressed={userPaused}
                className="p-2 text-white/70 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                {userPaused ? (
                  <Play size={18} strokeWidth={1.5} />
                ) : (
                  <Pause size={18} strokeWidth={1.5} />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={prevSlide}
              aria-label={t('Previous slide')}
              className="p-2 text-white/70 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <ChevronLeft size={22} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              aria-label={t('Next slide')}
              className="p-2 text-white/70 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <ChevronRight size={22} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
