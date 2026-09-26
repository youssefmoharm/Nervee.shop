import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import FocusTrap from 'focus-trap-react';
import type { Product } from '../types';
import { productService } from '../services/productService';
import { searchCatalog, getDidYouMean, getTrendingTerms } from '../lib/productDiscovery';
import { categories } from '../data/products';
import { useToast } from '../context/ToastContext';
import { formatEGP } from '../lib/format';
import { useI18n } from '../lib/i18n';

const RECENT_KEY = 'nerve.recentSearches';
const MAX_RESULTS = 8;

export default function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [fuzzy, setFuzzy] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'empty' | 'loaded'>('idle');
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(RECENT_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const catalogLoadedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  // Load catalog only when the overlay opens (once per session), so the
  // homepage's initial paint doesn't pay for a full product fetch.
  useEffect(() => {
    if (!open || catalogLoadedRef.current) return;
    catalogLoadedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const products = await productService.list();
        if (!cancelled) {
          setAllProducts(products);
          setCatalogError(false);
        }
      } catch (err) {
        catalogLoadedRef.current = false;
        if (!cancelled) setCatalogError(true);
        console.error('Failed to load products for search:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setFuzzy(false);
      setState('idle');
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  // Escape closes (FocusTrap escapeDeactivates alone does not call onClose).
  // Must be registered before any early return to keep hook order stable.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  // Same discovery engine as the shop page: exact matches first, fuzzy
  // (typo-tolerant) matches only when nothing matched exactly.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setFuzzy(false);
      setState('idle');
      return;
    }

    if (catalogError) {
      setState('error');
      return;
    }

    if (allProducts.length === 0 && !catalogLoadedRef.current) {
      setState('loading');
      return;
    }

    setState('loading');
    const handle = setTimeout(() => {
      try {
        const { products: matches, fuzzy: isFuzzy } = searchCatalog(allProducts, query);
        setResults(matches);
        setFuzzy(isFuzzy);
        setState(matches.length === 0 ? 'empty' : 'loaded');
      } catch {
        setState('error');
        showToast(t('Connection error - try again'), 'error', 3000);
      }
    }, 220);
    return () => clearTimeout(handle);
  }, [query, allProducts, catalogError, showToast, t]);

  const didYouMean = useMemo(
    () => (state === 'empty' ? getDidYouMean(allProducts, query) : []),
    [state, allProducts, query],
  );

  // Data-backed: terms are always present in the catalog, so they never
  // dead-end on an empty result set.
  const trendingSearches = useMemo(() => getTrendingTerms(allProducts), [allProducts]);

  const commitSearch = (term: string) => {
    if (!term.trim()) return;
    const next = [term, ...recent.filter(r => r !== term)].slice(0, 5);
    setRecent(next);
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  const goToShop = (term: string) => {
    if (!term.trim()) return;
    commitSearch(term.trim());
    navigate(`/shop?q=${encodeURIComponent(term.trim())}`);
    onClose();
  };

  if (!open) {
    return null;
  }

  return (
    <FocusTrap
      active={open}
      focusTrapOptions={{
        initialFocus: () => inputRef.current as HTMLElement,
        fallbackFocus: '[role="dialog"]',
        clickOutsideDeactivates: true,
        escapeDeactivates: true,
      }}
    >
      <div
        className="fixed inset-0 z-[80] bg-navy"
        role="dialog"
        aria-modal="true"
        aria-label={t('Search products')}
      >
        <div className="mx-auto max-w-3xl px-5 pt-24 md:pt-32 h-[100dvh] overflow-y-auto safe-pb">
          <div className="flex items-center justify-between mb-2">
            <span className="nv-eyebrow text-silver">{t('Search')}</span>
            <button type="button" aria-label={t('Close search')} onClick={onClose} className="p-2">
              <X size={22} />
            </button>
          </div>
          <div className="flex items-center gap-3 border-b-2 border-white pb-4">
            <Search size={22} className="text-silver flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  goToShop(query);
                }
              }}
              placeholder={t('Search tees, hoodies, denim...')}
              className="flex-1 bg-transparent nv-heading text-2xl md:text-4xl focus:outline-none placeholder:text-white/25"
              aria-label={t('Search query')}
            />
          </div>

          <div className="mt-8 pb-20">
            {catalogError && state === 'idle' && (
              <div className="text-center py-12">
                <p className="nv-edit text-lg text-red-400">{t('Connection Error')}</p>
                <p className="text-sm text-silver/60 mt-2">
                  {t('Unable to search at the moment. Please try again.')}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    catalogLoadedRef.current = false;
                    setCatalogError(false);
                    setAllProducts([]);
                    // Re-trigger load by toggling a noop — reopen effect watches `open`
                    void productService.list().then(
                      products => {
                        catalogLoadedRef.current = true;
                        setAllProducts(products);
                        setCatalogError(false);
                      },
                      () => setCatalogError(true),
                    );
                  }}
                  className="mt-6 text-sm border border-white/40 px-5 py-3 hover:border-white hover:bg-white/10 transition-colors"
                >
                  {t('Try again')}
                </button>
              </div>
            )}

            {state === 'idle' && !catalogError && (
              <div className="space-y-8">
                {/* Shop by Category */}
                <div>
                  <h4 className="nv-eyebrow text-silver mb-3">{t('Shop by Category')}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {categories.map(cat => (
                      <Link
                        key={cat}
                        to={`/shop?category=${encodeURIComponent(cat)}`}
                        onClick={() => {
                          commitSearch(cat);
                          onClose();
                        }}
                        className="text-sm border border-white/20 px-4 py-3 hover:border-white hover:bg-white/10 transition-colors"
                      >
                        {cat}
                      </Link>
                    ))}
                  </div>
                </div>

                {recent.length > 0 && (
                  <div>
                    <h4 className="nv-eyebrow text-silver mb-3">{t('⏱️ Recent Searches')}</h4>
                    <div className="flex flex-wrap gap-2">
                      {recent.map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setQuery(r)}
                          className="text-sm border border-white/20 px-4 py-2 hover:border-white transition-colors"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {trendingSearches.length > 0 && (
                  <div>
                    <h4 className="nv-eyebrow text-silver mb-3">{t("🔥 What's Hot")}</h4>
                    <div className="flex flex-wrap gap-2">
                      {trendingSearches.map(trend => (
                        <button
                          key={trend}
                          type="button"
                          onClick={() => setQuery(trend)}
                          className="text-sm border border-white/20 px-4 py-2 hover:border-white transition-colors"
                        >
                          {trend}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {state === 'loading' && (
              <p role="status" className="nv-edit text-silver">
                {t('Searching…')}
              </p>
            )}

            {state === 'error' && (
              <div className="text-center py-12">
                <p className="nv-edit text-lg text-red-400">{t('Connection Error')}</p>
                <p className="text-sm text-silver/60 mt-2">
                  {t('Unable to search at the moment. Please try again.')}
                </p>
              </div>
            )}

            {state === 'empty' && (
              <div className="text-center py-12">
                <p className="nv-edit text-lg text-silver">
                  {t('No results for')} &ldquo;{query}&rdquo;
                </p>
                <p className="text-sm text-silver/60 mt-2">{t('Try a different search term.')}</p>

                {/* Typo recovery when nothing matched exactly */}
                {didYouMean.length > 0 && (
                  <div className="mt-6">
                    <p className="text-xs text-silver/60 mb-3">{t('Did you mean:')}</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {didYouMean.map(sug => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => setQuery(sug)}
                          className="text-sm border border-white/20 px-3 py-2 hover:border-white transition-colors"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => goToShop(query)}
                  className="mt-8 text-sm border border-white/40 px-5 py-3 hover:border-white hover:bg-white/10 transition-colors"
                >
                  {t('Search the shop for')} &ldquo;{query.trim()}&rdquo;
                </button>
              </div>
            )}

            {state === 'loaded' && results.length > 0 && (
              <>
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <p role="status" className="text-sm text-silver">
                    {results.length} {t('results')}
                    {fuzzy && (
                      <span className="block text-xs text-silver/60 mt-1">
                        {t('Including close matches for')} &ldquo;{query.trim()}&rdquo;
                      </span>
                    )}
                  </p>
                  <Link
                    to={`/shop?q=${encodeURIComponent(query.trim())}`}
                    onClick={() => {
                      commitSearch(query);
                      onClose();
                    }}
                    className="text-sm border border-white/30 px-4 py-2 hover:border-white hover:bg-white/10 transition-colors"
                  >
                    {t('View all results')}
                  </Link>
                </div>

                <ul className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  {results.slice(0, MAX_RESULTS).map(p => (
                    <li key={p.id}>
                      <Link
                        to={`/product/${p.slug}`}
                        onClick={() => {
                          commitSearch(query);
                          onClose();
                        }}
                        className="block group"
                      >
                        <div className="aspect-[4/5] bg-mist overflow-hidden mb-2">
                          <img
                            src={p.colors[0]?.image}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                        <p className="nv-edit text-xs font-semibold uppercase truncate">{p.name}</p>
                        <p className="text-xs text-silver">{formatEGP(p.price)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>

                {results.length > MAX_RESULTS && (
                  <Link
                    to={`/shop?q=${encodeURIComponent(query.trim())}`}
                    onClick={() => {
                      commitSearch(query);
                      onClose();
                    }}
                    className="mt-6 inline-block text-sm text-silver underline underline-offset-4 hover:text-white transition-colors"
                  >
                    {t('View all')} {results.length} {t('results')}
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}
