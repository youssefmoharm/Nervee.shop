import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react';
import FocusTrap from 'focus-trap-react';
import type { Product, SortOption } from '../types';
import { productService } from '../services/productService';
import { categories as staticCategories } from '../data/products';
import { useSEO, getItemListSchema } from '../lib/seo';
import { useStructuredData } from '../hooks/useStructuredData';
import { logError } from '../lib/sentry';
import ProductCard from '../components/ProductCard';
import { SectionErrorBoundary } from '../components/ErrorBoundary';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import {
  filterProducts,
  getDidYouMean,
  getFilterOptions,
  getSearchSuggestions,
  searchCatalog,
  sortProducts,
} from '../lib/productDiscovery';
import { Breadcrumb } from '../components/Breadcrumb';
import { formatEGP } from '../lib/format';
import { useI18n } from '../lib/i18n';

const FALLBACK_PRICE_MAX = 10000;
const PAGE_SIZE = 12;
const NEW_ARRIVALS_COUNT = 8;
const SUGGESTIONS_ID = 'shop-search-suggestions';

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'best-selling', label: 'Best Selling' },
];

const FILTER_PARAM_KEYS = ['q', 'category', 'colors', 'sizes', 'priceMax', 'availability'];

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

function clampPrice(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0 || value > max) return max;
  return Math.min(Math.max(value, min), max);
}

export default function Shop() {
  const { t } = useI18n();
  useSEO({
    title: 'Shop | NERVE — Cool but Chic',
    description: 'Browse our curated collection of contemporary clothing and lifestyle products.',
    keywords: 'fashion, clothing, streetwear, shop, buy online',
  });
  const [params, setParams] = useSearchParams();

  // URL is the single source of truth for every shareable piece of state:
  // refresh, share links and browser back/forward all round-trip cleanly.
  const qParam = params.get('q') ?? '';
  const category = params.get('category');
  const colorsParam = params.get('colors') ?? '';
  const sizesParam = params.get('sizes') ?? '';
  const priceMaxParam = params.get('priceMax') ?? '';
  const availabilityParam = params.get('availability') ?? '';
  const sortParam = params.get('sort') ?? '';

  const colors = useMemo(() => parseList(colorsParam), [colorsParam]);
  const sizes = useMemo(() => parseList(sizesParam), [sizesParam]);
  const inStockOnly = availabilityParam === 'in-stock';

  // The catalog is fetched once; every filter/search/sort below runs
  // client-side so facet changes are instant (no refetch flash).
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setStatus('loading');
    productService
      .list()
      .then(data => {
        if (mounted) {
          setCatalog(data);
          setStatus('ready');
        }
      })
      .catch(error => {
        logError('Failed to load products:', error);
        if (mounted) setStatus('error');
      });
    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  // Facet values come from the data that actually loaded — never offer a
  // color/size/category/price bound the catalog cannot satisfy.
  const options = useMemo(() => getFilterOptions(catalog), [catalog]);
  const priceBoundMin = catalog.length ? options.priceMin : 0;
  const priceBoundMax = catalog.length ? options.priceMax : FALLBACK_PRICE_MAX;
  // Round the slider floor down so a saved low priceMax stays representable.
  const sliderMin = Math.max(0, Math.floor(priceBoundMin / 500) * 500);

  const priceMaxRaw = Number(priceMaxParam);
  const priceMaxActive =
    Number.isFinite(priceMaxRaw) && priceMaxRaw > 0 && priceMaxRaw < priceBoundMax
      ? priceMaxRaw
      : undefined;

  const sort: SortOption = SORT_OPTIONS.some(option => option.value === sortParam)
    ? (sortParam as SortOption)
    : 'newest';

  const categoryOptions =
    status !== 'ready'
      ? staticCategories
      : catalog.length === 0
      ? []
      : staticCategories.filter(
          current => current === 'New Arrivals' || options.categories.includes(current),
        );

  const [searchQuery, setSearchQuery] = useState(qParam);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Local slider value so dragging doesn't rewrite the URL on every pixel.
  const [sliderValue, setSliderValue] = useState(() =>
    clampPrice(priceMaxRaw, sliderMin, priceBoundMax),
  );

  const filtersKey = [
    qParam,
    category,
    colorsParam,
    sizesParam,
    priceMaxParam,
    availabilityParam,
    sort,
  ].join('|');

  // Every URL-state change resets pagination and re-syncs local echoes of the URL.
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [filtersKey]);

  useEffect(() => {
    setSearchQuery(prev => (prev.trim() === qParam ? prev : qParam));
  }, [qParam]);

  useEffect(() => {
    setSliderValue(clampPrice(priceMaxRaw, sliderMin, priceBoundMax));
  }, [priceMaxRaw, sliderMin, priceBoundMax]);

  useEffect(() => {
    setActiveSuggestion(-1);
  }, [searchQuery]);

  const updateParams = (updater: (prev: URLSearchParams) => URLSearchParams, replace = false) => {
    setParams(prev => updater(new URLSearchParams(prev)), { replace });
  };

  /** Discrete filter changes push a history entry (so Back undoes them);
   *  continuous input (typing, slider drags) replaces to avoid history spam. */
  const setParam = (key: string, value: string | null, replace = false) =>
    updateParams(prev => {
      if (value) prev.set(key, value);
      else prev.delete(key);
      return prev;
    }, replace);

  const commitSearch = (value: string) => {
    const q = value.trim();
    if (q === qParam) return;
    const enteringSearch = q.length > 0 !== qParam.length > 0;
    setParam('q', q || null, !enteringSearch);
  };

  // Debounce the search input (300ms) before it reaches the URL/filters.
  useEffect(() => {
    const id = setTimeout(() => commitSearch(searchQuery), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, qParam]);

  // Commit slider → URL after the user stops dragging (avoids history spam).
  useEffect(() => {
    if (sliderValue === (priceMaxActive ?? priceBoundMax)) return;
    const id = setTimeout(() => {
      setParam('priceMax', sliderValue >= priceBoundMax ? null : String(sliderValue), true);
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sliderValue, priceBoundMax, priceMaxActive]);

  const filterValues = useMemo(
    () => ({
      query: qParam,
      category: category && category !== 'New Arrivals' ? category : null,
      colors,
      sizes,
      priceMax: priceMaxActive,
      inStockOnly,
    }),
    [qParam, category, colors, sizes, priceMaxActive, inStockOnly],
  );

  const { visible, fuzzy } = useMemo(() => {
    if (status !== 'ready') return { visible: [], fuzzy: false };
    const outcome = filterProducts(catalog, filterValues);
    const sorted =
      category === 'New Arrivals'
        ? sortProducts(outcome.products, 'newest').slice(0, NEW_ARRIVALS_COUNT)
        : sortProducts(outcome.products, sort);
    return { visible: sorted, fuzzy: outcome.fuzzy };
  }, [status, catalog, filterValues, category, sort]);

  const displayed = visible.slice(0, displayCount);

  // Suggestions track what is being typed (not the debounced URL) for instant feedback.
  const suggestions = useMemo(
    () => getSearchSuggestions(catalog, searchQuery),
    [catalog, searchQuery],
  );
  const suggestionsOpen = showSuggestions && suggestions.length > 0;

  // Only suggest corrections when the term itself matched nothing — if
  // facets are what removed every product, the reset action is the fix.
  const didYouMean = useMemo(() => {
    if (visible.length > 0 || !qParam) return [];
    if (searchCatalog(catalog, qParam).products.length > 0) return [];
    return getDidYouMean(catalog, qParam);
  }, [visible, catalog, qParam]);

  const hasActiveFacets =
    colors.length > 0 ||
    sizes.length > 0 ||
    priceMaxActive !== undefined ||
    inStockOnly ||
    Boolean(category);
  const hasSearch = Boolean(qParam);
  const activeFilterCount =
    colors.length +
    sizes.length +
    (priceMaxActive !== undefined ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (category ? 1 : 0);

  const toggleColor = (color: string) =>
    updateParams(prev => {
      const list = parseList(prev.get('colors'));
      const next = list.includes(color) ? list.filter(x => x !== color) : [...list, color];
      if (next.length) prev.set('colors', next.join(','));
      else prev.delete('colors');
      return prev;
    });

  const toggleSize = (size: string) =>
    updateParams(prev => {
      const list = parseList(prev.get('sizes'));
      const next = list.includes(size) ? list.filter(x => x !== size) : [...list, size];
      if (next.length) prev.set('sizes', next.join(','));
      else prev.delete('sizes');
      return prev;
    });

  const clearAllFilters = () => {
    setSearchQuery('');
    // Sort and view are preferences, not filters — keep them.
    updateParams(prev => {
      FILTER_PARAM_KEYS.forEach(key => prev.delete(key));
      return prev;
    });
  };

  const applySuggestion = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    setActiveSuggestion(-1);
    commitSearch(suggestion);
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!showSuggestions) {
        setShowSuggestions(true);
        setActiveSuggestion(suggestions.length > 0 ? 0 : -1);
      } else if (suggestions.length > 0) {
        setActiveSuggestion(prev => (prev + 1) % suggestions.length);
      }
    } else if (event.key === 'ArrowUp' && suggestionsOpen) {
      event.preventDefault();
      setActiveSuggestion(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (event.key === 'Enter') {
      if (suggestionsOpen && activeSuggestion >= 0) {
        event.preventDefault();
        applySuggestion(suggestions[activeSuggestion]);
      } else {
        event.preventDefault();
        commitSearch(searchQuery);
        setShowSuggestions(false);
      }
    } else if (event.key === 'Escape' && suggestionsOpen) {
      event.preventDefault();
      event.stopPropagation();
      setShowSuggestions(false);
      setActiveSuggestion(-1);
    }
  };

  const itemListViewKey = visible.map(p => p.id).join(',');
  const itemListView = useMemo(
    () =>
      getItemListSchema(
        visible.map(p => ({
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

  // Keep the drawer from scrolling the page behind it.
  useEffect(() => {
    if (!filtersOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [filtersOpen]);

  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFiltersOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtersOpen]);

  // Selected values stay visible even if the loaded catalog would not list them.
  const colorOptions = useMemo(
    () => Array.from(new Set([...options.colors, ...colors])),
    [options.colors, colors],
  );
  const sizeOptions = useMemo(
    () => Array.from(new Set([...options.sizes, ...sizes])),
    [options.sizes, sizes],
  );

  const chips: Array<{ key: string; label: string; remove: () => void }> = [];
  if (qParam) {
    chips.push({
      key: 'search',
      label: `${t('Search')}: ${qParam}`,
      remove: () => {
        setSearchQuery('');
        commitSearch('');
      },
    });
  }
  if (category) {
    chips.push({ key: 'category', label: category, remove: () => setParam('category', null) });
  }
  colors.forEach(color =>
    chips.push({ key: `color-${color}`, label: color, remove: () => toggleColor(color) }),
  );
  sizes.forEach(size =>
    chips.push({
      key: `size-${size}`,
      label: `${t('Size')}: ${size}`,
      remove: () => toggleSize(size),
    }),
  );
  if (priceMaxActive !== undefined) {
    chips.push({
      key: 'price',
      label: `${t('Up to')} ${formatEGP(priceMaxActive)}`,
      remove: () => {
        setSliderValue(priceBoundMax);
        setParam('priceMax', null);
      },
    });
  }
  if (inStockOnly) {
    chips.push({
      key: 'availability',
      label: t('In stock only'),
      remove: () => setParam('availability', null),
    });
  }

  const FilterPanel = (
    <div className="space-y-8">
      <div>
        <h4 className="nv-eyebrow mb-3">{t('Category')}</h4>
        <ul className="space-y-2">
          <li>
            <button
              type="button"
              onClick={() => setParam('category', null)}
              aria-pressed={!category}
              className={`text-sm ${
                !category ? 'font-semibold' : 'text-navy/60'
              } hover:text-navy transition-colors`}
            >
              {t('All')}
            </button>
          </li>
          {categoryOptions.map(current => (
            <li key={current}>
              <button
                type="button"
                onClick={() => setParam('category', current)}
                aria-pressed={category === current}
                className={`text-sm ${
                  category === current ? 'font-semibold' : 'text-navy/60'
                } hover:text-navy transition-colors`}
              >
                {current}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="nv-eyebrow mb-3">{t('Color')}</h4>
        <div className="flex flex-wrap gap-2">
          {colorOptions.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => toggleColor(color)}
              aria-pressed={colors.includes(color)}
              className={`text-xs px-3 py-1.5 border transition-colors ${
                colors.includes(color)
                  ? 'bg-navy text-white border-navy'
                  : 'border-navy/25 text-navy/70'
              }`}
            >
              {color}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="nv-eyebrow mb-3">{t('Size')}</h4>
        <div className="flex flex-wrap gap-2">
          {sizeOptions.map(size => (
            <button
              key={size}
              type="button"
              onClick={() => toggleSize(size)}
              aria-pressed={sizes.includes(size)}
              className={`w-11 h-11 text-sm border transition-colors flex items-center justify-center ${
                sizes.includes(size)
                  ? 'bg-navy text-white border-navy'
                  : 'border-navy/25 text-navy/70'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="nv-eyebrow mb-3">{t('Availability')}</h4>
        <button
          type="button"
          onClick={() => setParam('availability', inStockOnly ? null : 'in-stock')}
          aria-pressed={inStockOnly}
          className={`w-full text-sm text-start border px-3 py-2 transition-colors ${
            inStockOnly ? 'bg-navy text-white border-navy' : 'border-navy/25 text-navy/70'
          }`}
        >
          {t('In stock only')}
        </button>
      </div>

      <div>
        <h4 className="nv-eyebrow mb-3">
          {t('Max Price')} — {formatEGP(sliderValue)}
        </h4>
        <input
          type="range"
          aria-label={t('Maximum price')}
          min={sliderMin}
          max={priceBoundMax}
          step={50}
          value={sliderValue}
          onChange={e => setSliderValue(Number(e.target.value))}
          className="w-full accent-navy"
        />
      </div>

      {(hasActiveFacets || hasSearch) && (
        <button
          type="button"
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
          <h1 className="nv-heading text-4xl sm:text-5xl md:text-7xl">{category || t('Shop')}</h1>
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
              role="combobox"
              autoComplete="off"
              aria-expanded={suggestionsOpen}
              aria-controls={SUGGESTIONS_ID}
              aria-autocomplete="list"
              aria-activedescendant={
                suggestionsOpen && activeSuggestion >= 0
                  ? `${SUGGESTIONS_ID}-${activeSuggestion}`
                  : undefined
              }
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setShowSuggestions(false)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t('Search tees, hoodies, bags…')}
              className="w-full rounded-full border border-navy/20 bg-white px-10 py-3 text-sm outline-none focus:border-navy"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label={t('Clear search')}
                onClick={() => {
                  setSearchQuery('');
                  commitSearch('');
                  setShowSuggestions(false);
                }}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-sm text-navy/50"
              >
                {t('Clear')}
              </button>
            )}
          </div>
          <ul
            id={SUGGESTIONS_ID}
            role="listbox"
            aria-label={t('Search suggestions')}
            hidden={!suggestionsOpen}
            className="mt-2 rounded-2xl border border-navy/10 bg-white p-2 shadow-sm"
          >
            {suggestionsOpen &&
              suggestions.map((suggestion, index) => (
                <li
                  key={suggestion}
                  id={`${SUGGESTIONS_ID}-${index}`}
                  role="option"
                  aria-selected={index === activeSuggestion}
                  onMouseDown={event => {
                    event.preventDefault();
                    applySuggestion(suggestion);
                  }}
                  className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-start text-sm text-navy/70 ${
                    index === activeSuggestion ? 'bg-mist' : 'hover:bg-mist'
                  }`}
                >
                  <span>{suggestion}</span>
                  <span className="text-[11px] uppercase tracking-wider text-navy/55">
                    {t('Quick search')}
                  </span>
                </li>
              ))}
          </ul>
        </div>

        {chips.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={t('Active filters')}>
            {chips.map(chip => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.remove}
                aria-label={`${t('Remove filter')}: ${chip.label}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-mist px-3 py-1 text-xs text-navy/70 hover:bg-navy/10 transition-colors"
              >
                {chip.label}
                <X size={12} aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              onClick={clearAllFilters}
              className="rounded-full border border-navy/25 px-3 py-1 text-xs text-navy/70 hover:border-navy transition-colors"
            >
              {t('Clear all filters')}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-y border-navy/10 py-3 mb-8 sticky top-16 md:top-20 bg-white z-20">
          <span role="status" className="text-sm text-navy/60 min-w-0 truncate">
            {status === 'loading'
              ? t('Loading…')
              : status === 'error'
              ? t('Failed to load products')
              : `${t('Showing')} ${displayed.length} ${t('of')} ${visible.length} ${
                  visible.length === 1 ? t('product') : t('products')
                }`}
          </span>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="lg:hidden flex items-center gap-2 text-sm border border-navy/20 px-3 py-2"
              aria-label={t('Open filters')}
              aria-expanded={filtersOpen}
              aria-controls="mobile-filters-panel"
            >
              <SlidersHorizontal size={15} />
              {t('Filters')}
              {(activeFilterCount > 0 || hasSearch) && (
                <span className="bg-navy text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFilterCount + (hasSearch ? 1 : 0)}
                </span>
              )}
            </button>
            <select
              value={sort}
              onChange={e => setParam('sort', e.target.value)}
              className="text-sm border border-navy/20 px-3 py-2 bg-white focus:outline-none max-w-[10rem] sm:max-w-none"
              aria-label={t('Sort products')}
              data-testid="sort-select"
            >
              {SORT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </select>
            <div className="hidden sm:flex items-center gap-1 border border-navy/20">
              <button
                type="button"
                aria-label={t('Grid view')}
                aria-pressed={view === 'grid'}
                onClick={() => setView('grid')}
                className={`p-2 ${view === 'grid' ? 'bg-navy text-white' : ''}`}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                aria-label={t('List view')}
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
                className={`p-2 ${view === 'list' ? 'bg-navy text-white' : ''}`}
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile filter drawer — focus trapped, scroll locked, ESC to close */}
        <FocusTrap
          active={filtersOpen}
          focusTrapOptions={{
            initialFocus: '#mobile-filters-close',
            fallbackFocus: '#mobile-filters-close',
            clickOutsideDeactivates: true,
            escapeDeactivates: false,
            returnFocusOnDeactivate: true,
            // The drawer only traps while open and its contents are never
            // display-toggled, so skip layout-based tabbable checks.
            tabbableOptions: { displayCheck: 'none' },
          }}
        >
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
            {/* Decorative click-to-dismiss backdrop: not focusable and not
                announced, so the labelled X (#mobile-filters-close) stays
                the single "Close filters" control. */}
            <div
              aria-hidden="true"
              className={`absolute inset-0 bg-navy/50 transition-opacity ${
                filtersOpen ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={() => setFiltersOpen(false)}
            />
            <div
              id="mobile-filters-panel"
              className={`absolute inset-y-0 start-0 w-[min(20rem,85vw)] bg-white overflow-y-auto transition-transform duration-300 ${
                filtersOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
              }`}
            >
              <div className="flex items-center justify-between px-5 h-14 border-b border-navy/10 sticky top-0 bg-white z-10">
                <span className="nv-eyebrow">{t('Filters')}</span>
                <button
                  type="button"
                  id="mobile-filters-close"
                  aria-label={t('Close filters')}
                  onClick={() => setFiltersOpen(false)}
                  className="p-2 hover:bg-mist rounded transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-5">{FilterPanel}</div>
              <div className="px-5 pb-8 sticky bottom-0 bg-white border-t border-navy/10 pt-3 safe-pb">
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="w-full bg-navy text-white nv-eyebrow py-3.5 hover:bg-navy-2 transition-colors"
                >
                  {`${t('Show results')} (${visible.length})`}
                </button>
              </div>
            </div>
          </div>
        </FocusTrap>

        <div className="flex gap-12">
          <aside className="hidden lg:block w-56 flex-shrink-0" aria-label={t('Filters')}>
            {FilterPanel}
          </aside>

          <div className="flex-1">
            {status === 'loading' ? (
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
            ) : status === 'error' ? (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center"
              >
                <h3 className="nv-heading text-2xl mb-3 text-red-800">
                  {t('Failed to load products')}
                </h3>
                <p className="text-sm text-red-700 mb-5">
                  {t('Please refresh the page to try again.')}
                </p>
                <button
                  type="button"
                  onClick={() => setReloadKey(key => key + 1)}
                  className="rounded-full border border-red-800 px-6 py-2 text-sm font-medium text-red-800 hover:bg-red-800 hover:text-white transition-colors"
                >
                  {t('Try again')}
                </button>
              </div>
            ) : visible.length === 0 ? (
              <EmptyState
                title={
                  hasSearch
                    ? `${t('No results for')} “${qParam}”`
                    : hasActiveFacets
                    ? t('No products match your filters')
                    : t('No products yet')
                }
                body={
                  hasSearch || hasActiveFacets
                    ? t('Try a broader keyword, clear a filter, or browse our full collection.')
                    : t('Check back soon — new drops land regularly.')
                }
                actionLabel={
                  hasSearch || hasActiveFacets
                    ? hasActiveFacets
                      ? t('Reset filters')
                      : t('Clear search')
                    : undefined
                }
                onAction={hasSearch || hasActiveFacets ? clearAllFilters : undefined}
              >
                {didYouMean.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs text-navy/60 mb-2">{t('Did you mean:')}</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {didYouMean.map(suggestion => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => applySuggestion(suggestion)}
                          className="rounded-full border border-navy/30 px-3 py-1.5 text-xs text-navy/70 hover:border-navy transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </EmptyState>
            ) : (
              <SectionErrorBoundary
                fallback={
                  <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
                    <p className="text-red-800 font-medium mb-2">{t('Failed to load products')}</p>
                    <p className="text-red-600 text-sm mb-4">
                      {t('Please refresh the page to try again.')}
                    </p>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="inline-block px-6 py-2 bg-navy text-white rounded hover:opacity-90 transition-opacity"
                    >
                      {t('Refresh')}
                    </button>
                  </div>
                }
              >
                <>
                  {fuzzy && (
                    <p className="mb-4 text-sm text-navy/60">
                      {t('Including close matches for')} “{qParam}”
                    </p>
                  )}
                  <div
                    data-testid="products-grid"
                    className={`grid gap-x-5 gap-y-12 ${
                      view === 'grid' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 max-w-md'
                    }`}
                  >
                    {displayed.map(p => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                  {displayCount < visible.length && (
                    <div className="mt-12 flex justify-center">
                      <button
                        type="button"
                        onClick={() =>
                          setDisplayCount(count => Math.min(count + PAGE_SIZE, visible.length))
                        }
                        className="border border-navy px-8 py-4 nv-eyebrow hover:bg-navy hover:text-white transition-colors"
                      >
                        {t('Load More')}{' '}
                        {visible.length - displayCount > 0 &&
                          `(${visible.length - displayCount} remaining)`}
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
