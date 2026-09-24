import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Product, SortOption } from '../types';
import { productService, type ShopFilters } from '../services/productService';
import { categories } from '../data/products';
import { useSEO, getItemListSchema } from '../lib/seo';
import { useStructuredData } from '../hooks/useStructuredData';
import { logError } from '../lib/sentry';
import ProductCard from '../components/ProductCard';
import { SectionErrorBoundary } from '../components/ErrorBoundary';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { filterProducts, getSearchSuggestions } from '../lib/productDiscovery';
import { Breadcrumb } from '../components/Breadcrumb';
import { formatEGP } from '../lib/format';
import { useI18n } from '../lib/i18n';

const ALL_COLORS = ['Navy', 'White', 'Black', 'Gray', 'Silver', 'Raw Indigo', 'Washed Black'];
const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const PRICE_SLIDER_MAX = 10000;

const sortLabels: Record<SortOption, string> = {
  featured: 'Featured',
  newest: 'Newest',
  'price-asc': 'Price: Low to High',
  'price-desc': 'Price: High to Low',
  'best-selling': 'Best Selling',
};

const SORT_OPTIONS: SortOption[] = [
  'featured',
  'newest',
  'price-asc',
  'price-desc',
  'best-selling',
];

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

export default function Shop() {
  const { t } = useI18n();
  useSEO({
    title: 'Shop | NERVE — Cool but Chic',
    description: 'Browse our curated collection of contemporary clothing and lifestyle products.',
    keywords: 'fashion, clothing, streetwear, shop, buy online',
  });
  const [params, setParams] = useSearchParams();

  // URL is the single source of truth for all shareable filters.
  const qParam = params.get('q') ?? '';
  const category = params.get('category') as ShopFilters['category'];
  const colorsParam = params.get('colors') ?? '';
  const sizesParam = params.get('sizes') ?? '';
  const priceMaxParam = params.get('priceMax') ?? '';
  const sortParam = params.get('sort') ?? '';
  const priceMaxRaw = Number(priceMaxParam);
  const priceMax =
    priceMaxParam && Number.isFinite(priceMaxRaw) && priceMaxRaw > 0
      ? Math.min(priceMaxRaw, PRICE_SLIDER_MAX)
      : PRICE_SLIDER_MAX;
  const sort: SortOption = (SORT_OPTIONS as string[]).includes(sortParam)
    ? (sortParam as SortOption)
    : 'featured';

  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]); // All products fetched
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const [displayCount, setDisplayCount] = useState(12); // Initially show 12 products
  const [searchQuery, setSearchQuery] = useState(qParam);
  const [debouncedQuery, setDebouncedQuery] = useState(qParam);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Local slider value so dragging doesn't rewrite the URL (and refetch) on every pixel.
  const [sliderValue, setSliderValue] = useState(priceMax);

  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFiltersOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtersOpen]);

  useEffect(() => {
    setSliderValue(priceMax);
  }, [priceMax]);

  // Adopt external URL changes (back/forward, shared links) without clobbering in-progress typing.
  useEffect(() => {
    setSearchQuery(prev => (prev.trim() === qParam ? prev : qParam));
    setDebouncedQuery(qParam);
  }, [qParam]);

  const colors = useMemo(() => parseList(colorsParam), [colorsParam]);
  const sizes = useMemo(() => parseList(sizesParam), [sizesParam]);

  const filters: ShopFilters = useMemo(
    () => ({
      category,
      colors,
      sizes,
      // At slider max, apply no price filter.
      priceMax: priceMax >= PRICE_SLIDER_MAX ? undefined : priceMax,
      sort,
    }),
    [category, colors, sizes, priceMax, sort],
  );

  const filtersKey = useMemo(
    () => [category, colorsParam, sizesParam, priceMaxParam, sort].join('|'),
    [category, colorsParam, sizesParam, priceMaxParam, sort],
  );

  const updateParams = (updater: (prev: URLSearchParams) => URLSearchParams) => {
    setParams(prev => updater(new URLSearchParams(prev)), { replace: true });
  };

  const setParam = (key: string, value: string | null) =>
    updateParams(prev => {
      if (value) prev.set(key, value);
      else prev.delete(key);
      return prev;
    });

  // Debounce search input (300ms) for filtering/fetching; also mirrors q into the URL.
  useEffect(() => {
    const id = setTimeout(() => {
      const q = searchQuery.trim();
      setDebouncedQuery(prev => (prev === q ? prev : q));
      if (q !== qParam) setParam('q', q || null);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, qParam]);

  // Commit slider → URL after the user stops dragging (avoids refetch thrash + layout collapse).
  useEffect(() => {
    if (sliderValue === priceMax) return;
    const id = setTimeout(() => {
      setParam('priceMax', sliderValue >= PRICE_SLIDER_MAX ? null : String(sliderValue));
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sliderValue, priceMax]);

  const suggestions = useMemo(
    () => getSearchSuggestions(allProducts, debouncedQuery),
    [allProducts, debouncedQuery],
  );

  useEffect(() => {
    let mounted = true;
    // Skeleton only on first load — keep the previous grid mounted while
    // refetching so a filter change doesn't collapse page height (which
    // makes the browser clamp scroll and jump toward the top).
    if (!hasLoadedRef.current) setLoading(true);
    productService
      .list(filters)
      .then(data => {
        if (mounted) {
          const visible = filterProducts(data, debouncedQuery, category, colors, sizes, priceMax);
          setAllProducts(visible);
          setProducts(visible.slice(0, 12));
          setDisplayCount(Math.min(12, visible.length));
          setLoading(false);
          hasLoadedRef.current = true;
        }
      })
      .catch(error => {
        if (mounted) {
          logError('Failed to load products:', error);
          setProducts([]);
          setAllProducts([]);
          setLoading(false);
          hasLoadedRef.current = true;
        }
      });
    return () => {
      mounted = false;
    };
  }, [filtersKey, debouncedQuery, filters, category, colors, sizes, priceMax]);

  const toggleColor = (c: string) =>
    updateParams(prev => {
      const list = parseList(prev.get('colors'));
      const next = list.includes(c) ? list.filter(x => x !== c) : [...list, c];
      if (next.length) prev.set('colors', next.join(','));
      else prev.delete('colors');
      return prev;
    });

  const toggleSize = (s: string) =>
    updateParams(prev => {
      const list = parseList(prev.get('sizes'));
      const next = list.includes(s) ? list.filter(x => x !== s) : [...list, s];
      if (next.length) prev.set('sizes', next.join(','));
      else prev.delete('sizes');
      return prev;
    });

  const activeFilterCount = colors.length + sizes.length + (priceMax < PRICE_SLIDER_MAX ? 1 : 0);

  const itemListViewKey = allProducts.map(p => p.id).join(',');
  const itemListView = useMemo(
    () =>
      getItemListSchema(
        allProducts.map(p => ({
          name: p.name,
          url: `https://www.nerveey.shop/product/${p.slug ?? p.id}`,
          ...(p.colors?.[0]?.image && { image: p.colors[0].image }),
        })),
        category ? `NERVE ${category}` : 'NERVE Products',
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemListViewKey, category],
  );
  useStructuredData(itemListView);

  const clearAllFilters = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    setParams({}, { replace: true });
  };

  const FilterPanel = (
    <div className="space-y-8">
      <div>
        <h4 className="nv-eyebrow mb-3">{t('Category')}</h4>
        <ul className="space-y-2">
          <li>
            <button
              onClick={() => setParam('category', null)}
              className={`text-sm ${
                !category ? 'font-semibold' : 'text-navy/60'
              } hover:text-navy transition-colors`}
            >
              {t('All')}
            </button>
          </li>
          {categories.map(c => (
            <li key={c}>
              <button
                onClick={() => setParam('category', c)}
                className={`text-sm ${
                  category === c ? 'font-semibold' : 'text-navy/60'
                } hover:text-navy transition-colors`}
              >
                {c}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="nv-eyebrow mb-3">{t('Color')}</h4>
        <div className="flex flex-wrap gap-2">
          {ALL_COLORS.map(c => (
            <button
              key={c}
              onClick={() => toggleColor(c)}
              aria-pressed={colors.includes(c)}
              className={`text-xs px-3 py-1.5 border transition-colors ${
                colors.includes(c)
                  ? 'bg-navy text-white border-navy'
                  : 'border-navy/25 text-navy/70'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="nv-eyebrow mb-3">{t('Size')}</h4>
        <div className="flex flex-wrap gap-2">
          {ALL_SIZES.map(s => (
            <button
              key={s}
              onClick={() => toggleSize(s)}
              aria-pressed={sizes.includes(s)}
              className={`w-11 h-11 text-sm border transition-colors flex items-center justify-center ${
                sizes.includes(s) ? 'bg-navy text-white border-navy' : 'border-navy/25 text-navy/70'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="nv-eyebrow mb-3">
          {t('Max Price')} — {formatEGP(sliderValue)}
        </h4>
        <input
          type="range"
          aria-label={t('Maximum price')}
          min={500}
          max={PRICE_SLIDER_MAX}
          step={50}
          value={sliderValue}
          onChange={e => setSliderValue(Number(e.target.value))}
          className="w-full accent-navy"
        />
      </div>

      {activeFilterCount > 0 && (
        <button
          onClick={clearAllFilters}
          className="text-xs underline text-navy/60 hover:text-navy"
        >
          {t('Clear all filters')}
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-white text-navy min-h-screen pt-24 md:pt-28">
      <div className="mx-auto max-w-[1600px] px-5 md:px-8 pb-24">
        <Breadcrumb items={[{ label: t('Shop') }]} />
        <div className="mb-8 md:mb-12">
          <p className="nv-eyebrow text-navy/60 mb-2">{category || t('Shop All')}</p>
          <h1 className="nv-heading text-5xl md:text-7xl">{category || t('Shop')}</h1>
        </div>

        <div className="mb-6 max-w-2xl">
          <label htmlFor="product-search" className="sr-only">
            {t('Search products')}
          </label>
          <div className="relative">
            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-navy/40" />
            <input
              id="product-search"
              data-testid="search-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('Search tees, hoodies, bags…')}
              className="w-full rounded-full border border-navy/20 bg-white px-10 py-3 text-sm outline-none focus:border-navy"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label={t('Clear search')}
                onClick={() => setSearchQuery('')}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-sm text-navy/50"
              >
                {t('Clear')}
              </button>
            )}
          </div>
          {searchQuery && suggestions.length > 0 && (
            <ul className="mt-2 rounded-2xl border border-navy/10 bg-white p-2 shadow-sm">
              {suggestions.map(suggestion => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => setSearchQuery(suggestion)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-start text-sm text-navy/70 hover:bg-mist"
                  >
                    <span>{suggestion}</span>
                    <span className="text-[11px] uppercase tracking-wider text-navy/55">
                      {t('Quick search')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {(searchQuery || colors.length || sizes.length || priceMax < PRICE_SLIDER_MAX) && (
          <div className="mb-6 flex flex-wrap gap-2">
            {searchQuery && (
              <span className="rounded-full bg-mist px-3 py-1 text-xs text-navy/70">
                {t('Search')}: {searchQuery}
              </span>
            )}
            {colors.map(color => (
              <span key={color} className="rounded-full bg-mist px-3 py-1 text-xs text-navy/70">
                {color}
              </span>
            ))}
            {sizes.map(size => (
              <span key={size} className="rounded-full bg-mist px-3 py-1 text-xs text-navy/70">
                {t('Size')}: {size}
              </span>
            ))}
            {priceMax < PRICE_SLIDER_MAX && (
              <span className="rounded-full bg-mist px-3 py-1 text-xs text-navy/70">
                {t('Up to')} {formatEGP(priceMax)}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-y border-navy/10 py-3 mb-8 sticky top-16 md:top-20 bg-white z-20">
          <span className="text-sm text-navy/60">
            {loading
              ? t('Loading…')
              : `Showing ${products.length} of ${allProducts.length} product${
                  allProducts.length !== 1 ? 's' : ''
                }`}
          </span>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="lg:hidden flex items-center gap-2 text-sm border border-navy/20 px-3 py-2"
              aria-label={t('Open filters')}
            >
              <SlidersHorizontal size={15} />
              {t('Filters')}
              {activeFilterCount > 0 && (
                <span className="bg-navy text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <select
              value={sort}
              onChange={e => setParam('sort', e.target.value)}
              className="text-sm border border-navy/20 px-3 py-2 bg-white focus:outline-none"
              aria-label={t('Sort products')}
              data-testid="sort-select"
            >
              {(Object.keys(sortLabels) as SortOption[]).map(s => (
                <option key={s} value={s}>
                  {t(sortLabels[s])}
                </option>
              ))}
            </select>
            <div className="hidden sm:flex items-center gap-1 border border-navy/20">
              <button
                aria-label={t('Grid view')}
                onClick={() => setView('grid')}
                className={`p-2 ${view === 'grid' ? 'bg-navy text-white' : ''}`}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                aria-label={t('List view')}
                onClick={() => setView('list')}
                className={`p-2 ${view === 'list' ? 'bg-navy text-white' : ''}`}
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile filter drawer */}
        <div
          data-testid="mobile-filters"
          role="dialog"
          aria-modal="true"
          aria-label={t('Filters')}
          aria-hidden={!filtersOpen}
          tabIndex={-1}
          ref={node => {
            if (node) {
              if (!filtersOpen) node.setAttribute('inert', '');
              else node.removeAttribute('inert');
            }
          }}
          className={`fixed inset-0 z-50 lg:hidden ${filtersOpen ? '' : 'pointer-events-none'}`}
        >
          <div
            className={`absolute inset-0 bg-navy/50 transition-opacity ${
              filtersOpen ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => setFiltersOpen(false)}
            aria-hidden="true"
          />
          <div
            className={`absolute inset-y-0 start-0 w-[min(20rem,85vw)] bg-white overflow-y-auto transition-transform duration-300 ${
              filtersOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between px-5 h-14 border-b border-navy/10 sticky top-0 bg-white z-10">
              <span className="nv-eyebrow">{t('Filters')}</span>
              <button
                type="button"
                aria-label={t('Close filters')}
                onClick={() => setFiltersOpen(false)}
                className="p-2 hover:bg-mist rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5">{FilterPanel}</div>
            <div className="px-5 pb-8 sticky bottom-0 bg-white border-t border-navy/10 pt-3">
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="w-full bg-navy text-white nv-eyebrow py-3.5 hover:bg-navy-2 transition-colors"
              >
                {t('Show results')}
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-12">
          <aside className="hidden lg:block w-56 flex-shrink-0">{FilterPanel}</aside>

          <div className="flex-1">
            {loading ? (
              <div
                className={`grid gap-x-5 gap-y-10 ${
                  view === 'grid' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1'
                }`}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-[4/5] w-full" />
                    <Skeleton variant="text" count={2} height="h-3" />
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <EmptyState
                title={
                  activeFilterCount > 0 || debouncedQuery
                    ? t('No products match that search')
                    : t('No products yet')
                }
                body={
                  activeFilterCount > 0 || debouncedQuery
                    ? t('Try a broader keyword, clear a filter, or browse our full collection.')
                    : t('Check back soon — new drops land regularly.')
                }
                actionLabel={
                  activeFilterCount > 0 || debouncedQuery ? t('Reset filters') : undefined
                }
                onAction={activeFilterCount > 0 || debouncedQuery ? clearAllFilters : undefined}
              />
            ) : (
              <SectionErrorBoundary
                fallback={
                  <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
                    <p className="text-red-800 font-medium mb-2">{t('Failed to load products')}</p>
                    <p className="text-red-600 text-sm mb-4">
                      {t('Please refresh the page to try again.')}
                    </p>
                    <button
                      onClick={() => window.location.reload()}
                      className="inline-block px-6 py-2 bg-navy text-white rounded hover:opacity-90 transition-opacity"
                    >
                      {t('Refresh')}
                    </button>
                  </div>
                }
              >
                <>
                  <div
                    data-testid="products-grid"
                    className={`grid gap-x-5 gap-y-12 ${
                      view === 'grid' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 max-w-md'
                    }`}
                  >
                    {products.map(p => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                  {displayCount < allProducts.length && (
                    <div className="mt-12 flex justify-center">
                      <button
                        onClick={() => {
                          const newCount = Math.min(displayCount + 12, allProducts.length);
                          setDisplayCount(newCount);
                          setProducts(allProducts.slice(0, newCount));
                        }}
                        className="border border-navy px-8 py-4 nv-eyebrow hover:bg-navy hover:text-white transition-colors"
                      >
                        {t('Load More')}{' '}
                        {allProducts.length - displayCount > 0 &&
                          `(${allProducts.length - displayCount} remaining)`}
                      </button>
                    </div>
                  )}
                </>
              </SectionErrorBoundary>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
