import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../types';

export default function HeroProductCarousel({ products }: { products: Product[] }) {
  const items = products.slice(0, 4);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => setIdx(i => (i + 1) % items.length), [items.length]);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    const id = setInterval(next, 4000);
    return () => clearInterval(id);
  }, [paused, next, items.length]);

  if (items.length === 0) return null;

  const active = items[idx];
  const price = `EGP ${active.price.toLocaleString()}`;

  return (
    <section
      className="relative h-[100svh] min-h-[560px] w-full overflow-hidden bg-navy"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Images - crossfade */}
      {items.map((p, i) => {
        const src = p.colors?.[0]?.image || '';
        return (
          <img
            key={p.id}
            src={src}
            alt={p.name}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={i === 0 ? 'high' : undefined}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
              i === idx ? 'opacity-100' : 'opacity-0'
            }`}
          />
        );
      })}
      <div className="absolute inset-0 bg-gradient-to-t from-navy/40 via-transparent to-navy/10" />

      {/* Top-left product name - like Salty Denim */}
      <div className="absolute top-20 left-5 md:left-8 z-10">
        <Link to={`/product/${active.slug}`} className="group">
          <h2 className="text-white text-3xl md:text-5xl font-light tracking-tight drop-shadow-lg group-hover:opacity-80 transition-opacity">
            {active.name}
          </h2>
          <p className="text-white/80 text-sm mt-1">
            {price} · {active.colors[0]?.name || ''}
          </p>
        </Link>
      </div>

      {/* Bottom-right CTA - like CATCH YOURS! */}
      <Link
        to={`/product/${active.slug}`}
        className="absolute bottom-14 right-5 md:right-8 z-10 text-white text-sm tracking-widest underline underline-offset-4 hover:opacity-70 transition-opacity"
      >
        CATCH YOURS!
      </Link>

      {/* Bottom-left counter 02 / 04 */}
      <div className="absolute bottom-6 left-5 md:left-8 z-10 flex items-center gap-2 text-white/80 text-xs tracking-widest">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        <span>
          {String(idx + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
        </span>
      </div>

      {/* Bottom progress segments */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex gap-px px-5 md:px-8 pb-3 md:pb-4">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            aria-label={`Go to product ${i + 1}`}
            className="flex-1 h-[2px] bg-white/30 overflow-hidden"
          >
            <span
              className={`block h-full bg-white transition-all ${
                i === idx ? 'w-full' : i < idx ? 'w-full opacity-60' : 'w-0'
              }`}
              style={i === idx && !paused ? { animation: 'shrink 4s linear' } : undefined}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
