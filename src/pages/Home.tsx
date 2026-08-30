import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { Product } from '../types';
import { productService } from '../services/productService';
import { collections } from '../data/products';
import { useSEO, seoHelpers } from '../lib/seo';
import ProductCard from '../components/ProductCard';
import Newsletter from '../components/Newsletter';
import Skeleton from '../components/Skeleton';

const categoryTiles = [
  { name: 'T-Shirts', seed: 'cat-tees' },
  { name: 'Hoodies', seed: 'cat-hoodies' },
  { name: 'Denim', seed: 'cat-denim' },
  { name: 'Jackets', seed: 'cat-jackets' },
  { name: 'Caps', seed: 'cat-caps' },
  { name: 'Accessories', seed: 'cat-acc' },
];

const gallery = ['nw-1', 'nw-2', 'nw-3', 'nw-4', 'nw-5', 'nw-6'];

export default function Home() {
  useSEO(seoHelpers.home());
  const [newDrop, setNewDrop] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    productService.getNewDrop().then(data => {
      if (mounted) {
        setNewDrop(data);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      {/* HERO */}
      <section className="relative h-[100svh] min-h-[560px] flex items-end overflow-hidden bg-navy">
        <img
          src="https://picsum.photos/seed/nerve-hero-2026/1800/2400"
          alt="NERVE new season campaign"
          fetchPriority="high"
          className="absolute inset-0 w-full h-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/30 to-navy/10" />

        <div className="relative w-full px-5 md:px-8 pb-14 md:pb-20">
          <div className="mx-auto max-w-[1600px]">
            <p
              className="nv-eyebrow text-silver mb-3 animate-fadeUp"
              style={{ animationDelay: '100ms' }}
            >
              New Season · 2026
            </p>
            <h1
              className="nv-heading text-[16vw] sm:text-[13vw] md:text-[9vw] lg:text-[7.5vw] leading-[0.85] animate-fadeUp"
              style={{ animationDelay: '200ms' }}
            >
              COOL BUT
              <br />
              CHIC
            </h1>
            <div
              className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mt-8 animate-fadeUp"
              style={{ animationDelay: '350ms' }}
            >
              <p className="text-silver max-w-sm text-sm md:text-base">
                Based in everyone&apos;s closet. NERVE is a concept store for individuality and
                movement — the new drop is here.
              </p>
              <Link
                to="/shop?category=New%20Arrivals"
                className="group inline-flex items-center gap-3 bg-white text-navy px-8 py-4 nv-eyebrow flex-shrink-0 hover:bg-mist transition-colors w-fit"
              >
                Shop the Drop
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* NEW DROP */}
      <section className="bg-white text-navy py-16 md:py-24 px-5 md:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex items-end justify-between mb-10 md:mb-14">
            <div>
              <p className="nv-eyebrow text-navy/50 mb-2">Just Landed</p>
              <h2 className="nv-heading text-4xl md:text-6xl">The New Drop</h2>
            </div>
            <Link
              to="/shop"
              className="hidden sm:inline-flex nv-eyebrow items-center gap-2 hover:opacity-60"
            >
              View All <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-10">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[4/5] w-full" />
                  <Skeleton variant="text" count={2} height="h-3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-10">
              {newDrop.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FEATURED COLLECTIONS */}
      <section className="bg-navy py-16 md:py-24 px-5 md:px-8">
        <div className="mx-auto max-w-[1600px]">
          <p className="nv-eyebrow text-silver mb-2">Curated Edits</p>
          <h2 className="nv-heading text-4xl md:text-6xl mb-10 md:mb-14">Collections</h2>

          <div className="grid md:grid-cols-3 gap-1">
            {collections.map(c => (
              <Link
                key={c.id}
                to={`/collections/${c.id}`}
                className="group relative aspect-[3/4] overflow-hidden block"
              >
                <img
                  src={c.image}
                  alt={c.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/10 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6">
                  <p className="nv-eyebrow text-silver mb-1">{c.tagline}</p>
                  <h3 className="nv-heading text-3xl mb-3">{c.name}</h3>
                  <span className="text-xs font-semibold uppercase tracking-widest2 underline underline-offset-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    Shop Now
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* SHOP BY CATEGORY */}
      <section className="bg-white text-navy py-16 md:py-24 px-5 md:px-8">
        <div className="mx-auto max-w-[1600px]">
          <h2 className="nv-heading text-4xl md:text-6xl mb-10 md:mb-14">Shop by Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categoryTiles.map(c => (
              <Link
                key={c.name}
                to={`/shop?category=${encodeURIComponent(c.name)}`}
                className="group relative aspect-[3/4] overflow-hidden block bg-mist"
              >
                <img
                  src={`https://picsum.photos/seed/${c.seed}/500/650`}
                  alt={c.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-navy/0 group-hover:bg-navy/30 transition-colors" />
                <span className="absolute bottom-3 left-3 text-white nv-edit text-sm font-semibold uppercase tracking-wide drop-shadow">
                  {c.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL / COMMUNITY */}
      <section className="bg-navy py-16 md:py-24 px-5 md:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex items-end justify-between mb-10">
            <h2 className="nv-heading text-4xl md:text-6xl">Nerve in the Wild</h2>
            <a
              href="https://www.instagram.com/gothennerve58/"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex nv-eyebrow items-center gap-2 hover:opacity-60"
            >
              @gothennerve58 <ArrowRight size={14} />
            </a>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
            {gallery.map(g => (
              <a
                key={g}
                href="https://www.instagram.com/gothennerve58/"
                target="_blank"
                rel="noreferrer"
                className="group aspect-square overflow-hidden block"
              >
                <img
                  src={`https://picsum.photos/seed/${g}/500/500`}
                  alt="Community post"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </a>
            ))}
          </div>
        </div>
      </section>

      <Newsletter />
    </>
  );
}
