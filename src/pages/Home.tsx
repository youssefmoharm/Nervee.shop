import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  AlertTriangle,
  Truck,
  Banknote,
  RotateCcw,
  Ruler,
  Headphones,
  Instagram,
} from 'lucide-react';
import type { Product } from '../types';
import { productService } from '../services/productService';
import {
  collections,
  categories,
  getNewDrop as getMockNewDrop,
  getBestSellers as getMockBestSellers,
} from '../data/products';
import { useSEO, useStructuredData } from '../lib/seo';
import { logError } from '../lib/sentry';
import HeroCarousel from '../components/HeroCarousel';
import ProductCard from '../components/ProductCard';
import Newsletter from '../components/Newsletter';
import Skeleton from '../components/Skeleton';
import { SectionErrorBoundary } from '../components/ErrorBoundary';
import { FREE_SHIPPING_THRESHOLD } from '../lib/storeConfig';
import { formatEGP } from '../lib/format';
import { useI18n } from '../lib/i18n';

const categoryTiles = categories
  .slice(1)
  .map(cat => ({
    name: cat,
    seed: `cat-${cat.toLowerCase().replace(/\s+/g, '-')}`,
  }))
  .slice(0, 6);

const socialTiles = [
  { id: 'ig-1', label: 'Lookbook' },
  { id: 'ig-2', label: 'Studio' },
  { id: 'ig-3', label: 'Street' },
  { id: 'ig-4', label: 'Drop day' },
  { id: 'ig-5', label: 'Fit check' },
  { id: 'ig-6', label: 'Community' },
];

const productGridClass = 'grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-10';

function ProductGridSkeleton() {
  return (
    <div className={productGridClass} aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-[4/5] w-full" />
          <Skeleton variant="text" count={2} height="h-3" />
        </div>
      ))}
    </div>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  href,
  linkLabel,
  eyebrowClass = 'text-navy/70',
  titleClass = '',
}: {
  id?: string;
  eyebrow: string;
  title: string;
  href?: string;
  linkLabel?: string;
  eyebrowClass?: string;
  titleClass?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-end justify-between gap-4 mb-10 md:mb-14">
      <div>
        <p className={`nv-eyebrow mb-2 ${eyebrowClass}`}>{t(eyebrow)}</p>
        <h2 id={id} className={`nv-heading text-4xl md:text-6xl ${titleClass}`}>
          {t(title)}
        </h2>
      </div>
      {href && linkLabel && (
        <Link
          to={href}
          className="hidden sm:inline-flex nv-eyebrow items-center gap-2 hover:opacity-60 shrink-0"
        >
          {t(linkLabel)} <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

const trustItems = [
  {
    id: 'shipping',
    icon: Truck,
    titleKey: 'Free shipping over threshold',
    bodyKey: 'Free standard shipping on orders over',
    link: '/shipping',
    linkKey: 'Shipping',
  },
  {
    id: 'cod',
    icon: Banknote,
    titleKey: 'Cash on Delivery',
    bodyKey: 'Cash on delivery across Egypt',
    link: '/faq',
    linkKey: 'FAQ',
  },
  {
    id: 'returns',
    icon: RotateCcw,
    titleKey: 'Easy returns',
    bodyKey: 'Free returns within 14 days of delivery on unworn items.',
    link: '/returns',
    linkKey: 'Returns',
  },
  {
    id: 'size',
    icon: Ruler,
    titleKey: 'Size Guide',
    bodyKey: 'Find your fit before you order',
    link: '/size-guide',
    linkKey: 'Size Guide',
  },
  {
    id: 'support',
    icon: Headphones,
    titleKey: 'Need help?',
    bodyKey: 'Real people, based in Alexandria',
    link: '/contact',
    linkKey: 'Contact',
  },
] as const;

export default function Home() {
  const { t } = useI18n();
  useSEO({
    title: 'NERVE — Cool but Chic | Contemporary Egyptian Concept Store',
    description:
      'A contemporary concept store built around individuality, movement, and the pieces that become part of your everyday identity. Cool but chic. EST 2026.',
    keywords: 'fashion, streetwear, concept store, contemporary clothing, Egyptian fashion',
    ogImage: 'https://www.nerveey.shop/og-image.png',
  });

  const [newDrop, setNewDrop] = useState<Product[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [loadingNewDrop, setLoadingNewDrop] = useState(true);
  const [loadingBestSellers, setLoadingBestSellers] = useState(true);

  useStructuredData({
    '@type': 'ItemList',
    name: 'NERVE New Drop',
    itemListElement: newDrop.slice(0, 8).map((p, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: p.name,
      url: `https://www.nerveey.shop/product/${p.slug}`,
    })),
  });

  useEffect(() => {
    let mounted = true;
    productService
      .getNewDrop()
      .then(data => {
        if (!mounted) return;
        const products = data && data.length > 0 ? data : getMockNewDrop();
        if (import.meta.env.DEV) {
          console.info(
            `[Home] New Drop loaded: ${products.length} products (source: ${
              data && data.length > 0 ? 'supabase' : 'mock'
            })`,
          );
        }
        setNewDrop(products);
        setLoadingNewDrop(false);
      })
      .catch(error => {
        if (!mounted) return;
        logError('Failed to load new drop:', error);
        setNewDrop(getMockNewDrop());
        setLoadingNewDrop(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    productService
      .getBestSellers()
      .then(data => {
        if (!mounted) return;
        setBestSellers(data && data.length > 0 ? data : getMockBestSellers());
        setLoadingBestSellers(false);
      })
      .catch(error => {
        if (!mounted) return;
        logError('Failed to load best sellers:', error);
        setBestSellers(getMockBestSellers());
        setLoadingBestSellers(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      {/* 1 — Hero */}
      <HeroCarousel />

      {/* 2 — New Drop / featured product grid */}
      <section
        className="bg-white text-navy py-16 md:py-24 px-5 md:px-8"
        aria-labelledby="new-drop-heading"
      >
        <div className="mx-auto max-w-[1600px]">
          <div className="flex items-end justify-between mb-10 md:mb-14">
            <div>
              <p className="nv-eyebrow text-navy/70 mb-2">{t('Just Landed')}</p>
              <h2 id="new-drop-heading" className="nv-heading text-4xl md:text-6xl">
                {t('The New Drop')}
              </h2>
            </div>
            <Link
              to="/shop"
              className="hidden sm:inline-flex nv-eyebrow items-center gap-2 hover:opacity-60"
            >
              {t('View All')} <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          <SectionErrorBoundary
            fallback={
              <div className="text-center py-12">
                <AlertTriangle className="w-8 h-8 text-navy/30 mx-auto mb-3" aria-hidden="true" />
                <p className="text-navy/55 text-sm">
                  {t('Unable to load products. Please try refreshing.')}
                </p>
              </div>
            }
          >
            {loadingNewDrop ? (
              <ProductGridSkeleton />
            ) : newDrop.length > 0 ? (
              <div className={productGridClass}>
                {newDrop.slice(0, 8).map(p => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-navy/55 text-sm">{t('No products yet')}</p>
                <p className="text-navy/50 text-sm mt-1">
                  {t('Check back soon — new drops land regularly.')}
                </p>
              </div>
            )}
          </SectionErrorBoundary>

          <div className="mt-10 sm:hidden">
            <Link to="/shop" className="nv-eyebrow inline-flex items-center gap-2 hover:opacity-60">
              {t('View All')} <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* 3 — Editorial / brand story */}
      <section
        className="bg-mist text-navy py-16 md:py-24 px-5 md:px-8"
        aria-labelledby="brand-heading"
      >
        <div className="mx-auto max-w-4xl text-center">
          <p className="nv-eyebrow text-navy/70 mb-3">{t('Alexandria, Egypt · EST 2026')}</p>
          <h2 id="brand-heading" className="nv-heading text-3xl md:text-5xl mb-6">
            NERVE — Cool but Chic
          </h2>
          <p className="text-navy/75 leading-relaxed max-w-2xl mx-auto">
            {t(
              'NERVE is a contemporary Egyptian concept store built around individuality, movement, and the pieces that become part of your everyday identity. Shop curated fashion, streetwear, and lifestyle products — with free standard shipping on orders over',
            )}{' '}
            {formatEGP(FREE_SHIPPING_THRESHOLD)} {t('and cash on delivery across Egypt.')}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
            <Link to="/about" className="nv-eyebrow underline underline-offset-4 hover:opacity-60">
              {t('About')}
            </Link>
            <Link to="/faq" className="nv-eyebrow underline underline-offset-4 hover:opacity-60">
              {t('FAQ')}
            </Link>
            <Link
              to="/shipping"
              className="nv-eyebrow underline underline-offset-4 hover:opacity-60"
            >
              {t('Shipping')}
            </Link>
            <Link
              to="/returns"
              className="nv-eyebrow underline underline-offset-4 hover:opacity-60"
            >
              {t('Returns')}
            </Link>
          </div>
        </div>
      </section>

      {/* 4 — Curated collections (brand shopping paths) */}
      <section className="bg-navy py-16 md:py-24 px-5 md:px-8">
        <div className="mx-auto max-w-[1600px]">
          <p className="nv-eyebrow text-white mb-2">{t('Curated Edits')}</p>
          <h2 className="nv-heading text-4xl md:text-6xl mb-10 md:mb-14">{t('Collections')}</h2>

          <div className="grid md:grid-cols-3 gap-1">
            {collections.map(c => (
              <Link
                key={c.id}
                to={`/collections/${c.id}`}
                className="group relative aspect-[3/4] overflow-hidden block bg-navy-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-4"
              >
                <div
                  className="absolute inset-0 nv-checker opacity-15 group-hover:opacity-25 transition-opacity duration-700"
                  aria-hidden="true"
                />
                <img
                  src={c.image}
                  alt=""
                  width={600}
                  height={800}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover mix-blend-luminosity opacity-40 transition-transform duration-700 group-hover:scale-110"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-navy via-navy/40 to-transparent"
                  aria-hidden="true"
                />
                <div className="absolute bottom-0 start-0 p-6">
                  <p className="nv-eyebrow text-white mb-1">{c.tagline}</p>
                  <h3 className="nv-heading text-3xl mb-3">{c.name}</h3>
                  <span className="text-xs font-semibold uppercase tracking-widest2 underline underline-offset-4 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                    {t('Discover')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 5 — Shop by category */}
      <section
        className="bg-white text-navy py-16 md:py-24 px-5 md:px-8"
        aria-labelledby="categories-heading"
      >
        <div className="mx-auto max-w-[1600px]">
          <SectionHeading
            id="categories-heading"
            eyebrow="Browse"
            title="Shop by Category"
            href="/shop"
            linkLabel="Shop all"
          />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categoryTiles.map((c, i) => (
              <Link
                key={c.name}
                to={`/shop?category=${encodeURIComponent(c.name)}`}
                className="group relative aspect-[3/4] overflow-hidden block bg-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy focus-visible:outline-offset-4"
              >
                <div
                  className={`absolute inset-0 ${
                    i % 2 === 0 ? 'nv-checker-inv' : 'nv-checker'
                  } opacity-25`}
                  aria-hidden="true"
                />
                <div
                  className="absolute inset-0 bg-navy/70 group-hover:bg-navy/45 transition-colors duration-500"
                  aria-hidden="true"
                />
                <div className="absolute inset-0 flex items-end p-4">
                  <span className="nv-heading text-xl md:text-2xl text-white leading-tight">
                    {c.name}
                  </span>
                </div>
                <span
                  className="absolute bottom-4 end-4 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-hidden="true"
                >
                  <ArrowRight size={16} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 6 — Best sellers */}
      <section
        className="bg-white text-navy border-t border-navy/10 py-16 md:py-24 px-5 md:px-8"
        aria-labelledby="best-sellers-heading"
      >
        <div className="mx-auto max-w-[1600px]">
          <div className="flex items-end justify-between mb-10 md:mb-14">
            <div>
              <p className="nv-eyebrow text-navy/70 mb-2">{t('Fan Favorites')}</p>
              <h2 id="best-sellers-heading" className="nv-heading text-4xl md:text-6xl">
                {t('Best Sellers')}
              </h2>
            </div>
            <Link
              to="/shop?sort=best-selling"
              className="hidden sm:inline-flex nv-eyebrow items-center gap-2 hover:opacity-60"
            >
              {t('View All')} <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          <SectionErrorBoundary
            fallback={
              <div className="text-center py-12">
                <AlertTriangle className="w-8 h-8 text-navy/30 mx-auto mb-3" aria-hidden="true" />
                <p className="text-navy/55 text-sm">
                  {t('Unable to load products. Please try refreshing.')}
                </p>
              </div>
            }
          >
            {loadingBestSellers ? (
              <ProductGridSkeleton />
            ) : bestSellers.length > 0 ? (
              <div className={productGridClass}>
                {bestSellers.slice(0, 4).map(p => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-navy/55 text-sm">{t('No products yet')}</p>
              </div>
            )}
          </SectionErrorBoundary>
        </div>
      </section>

      {/* 7 — Trust / service */}
      <section
        className="bg-mist text-navy py-14 md:py-20 px-5 md:px-8"
        aria-labelledby="trust-heading"
      >
        <div className="mx-auto max-w-[1600px]">
          <h2 id="trust-heading" className="sr-only">
            {t('Shop with confidence')}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {trustItems.map(item => {
              const Icon = item.icon;
              return (
                <li key={item.id} className="flex flex-col gap-2">
                  <Icon size={22} strokeWidth={1.5} className="text-navy" aria-hidden="true" />
                  <h3 className="nv-eyebrow text-navy">{t(item.titleKey)}</h3>
                  <p className="text-sm text-navy/70 leading-snug">
                    {item.id === 'shipping'
                      ? `${t(item.bodyKey)} ${formatEGP(FREE_SHIPPING_THRESHOLD)}`
                      : t(item.bodyKey)}
                  </p>
                  <Link
                    to={item.link}
                    className="text-xs nv-eyebrow underline underline-offset-4 hover:opacity-60 mt-1"
                  >
                    {t(item.linkKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 8 — Social proof → honest Instagram path (no fabricated UGC photos) */}
      <section className="bg-navy py-16 md:py-24 px-5 md:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <p className="nv-eyebrow text-white mb-2">{t('On Instagram')}</p>
              <h2 className="nv-heading text-4xl md:text-6xl">{t('Nerve in the Wild')}</h2>
            </div>
            <a
              href="https://www.instagram.com/gotthenerve58/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex nv-eyebrow items-center gap-2 hover:opacity-60"
            >
              <Instagram size={16} aria-hidden="true" /> @gotthenerve58{' '}
              <ArrowRight size={14} aria-hidden="true" />
            </a>
          </div>
          <ul className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
            {socialTiles.map((tile, i) => (
              <li key={tile.id}>
                <a
                  href="https://www.instagram.com/gotthenerve58/"
                  target="_blank"
                  rel="noreferrer"
                  className="group aspect-square overflow-hidden block bg-navy-2 relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  aria-label={`${t('Nerve in the Wild')} — ${tile.label} (${t('Open Instagram')})`}
                >
                  <div
                    className={`absolute inset-0 ${
                      i % 2 === 0 ? 'nv-checker-inv' : 'nv-checker'
                    } opacity-20 group-hover:opacity-40 transition-opacity`}
                    aria-hidden="true"
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-white/80 group-hover:text-white transition-colors">
                    <Instagram size={22} strokeWidth={1.5} aria-hidden="true" />
                  </div>
                  <span className="absolute bottom-2 start-2 text-[11px] nv-eyebrow text-white">
                    {tile.label}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 9 — Newsletter */}
      <Newsletter />
    </>
  );
}
