import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import FocusTrap from 'focus-trap-react';
import type { Product } from '../types';
import { productService } from '../services/productService';
import { searchProducts } from '../services/searchService';
import { categories } from '../data/products';
import { useToast } from '../context/ToastContext';
import { formatEGP } from '../lib/format';
import { useI18n } from '../lib/i18n';

const RECENT_KEY = 'nerve.recentSearches';

export default function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'empty' | 'loaded'>('idle');
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(RECENT_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [allProducts, setAllProducts] = useState<Product[]>([]);
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
        if (!cancelled) setAllProducts(products);
      } catch (err) {
        catalogLoadedRef.current = false;
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
      setSuggestions([]);
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
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSuggestions([]);
      setState('idle');
      // Show trending searches when idle
      if (allProducts.length > 0) {
        const searchResult = searchProducts(query, allProducts);
        setTrendingSearches(searchResult.trendingSearches);
      }
      return;
    }

    setState('loading');
    const handle = setTimeout(async () => {
      try {
        // Use Fuse.js for fuzzy search
        const searchResult = searchProducts(query, allProducts);
        setResults(searchResult.products);
        setSuggestions(searchResult.suggestions);
        setTrendingSearches(searchResult.trendingSearches);

        if (searchResult.products.length === 0) {
          setState('empty');
        } else {
          setState('loaded');
        }
      } catch (err) {
        setState('error');
        showToast(t('Connection error - try again'), 'error', 3000);
      }
    }, 220);
    return () => clearTimeout(handle);
  }, [query, allProducts, showToast, t]);

  const commitSearch = (term: string) => {
    if (!term.trim()) return;
    const next = [term, ...recent.filter(r => r !== term)].slice(0, 5);
    setRecent(next);
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
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
        <div className="mx-auto max-w-3xl px-5 pt-24 md:pt-32 h-screen overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="nv-eyebrow text-silver">{t('Search')}</span>
            <button aria-label={t('Close search')} onClick={onClose} className="p-2">
              <X size={22} />
            </button>
          </div>
          <div className="flex items-center gap-3 border-b-2 border-white pb-4">
            <Search size={22} className="text-silver flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && commitSearch(query)}
              placeholder={t('Search tees, hoodies, denim...')}
              className="flex-1 bg-transparent nv-heading text-2xl md:text-4xl focus:outline-none placeholder:text-white/25"
              aria-label={t('Search query')}
            />
          </div>

          <div className="mt-8 pb-20">
            {state === 'idle' && (
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
                      {trendingSearches.slice(0, 5).map(trend => (
                        <button
                          key={trend}
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

            {state === 'loading' && <p className="nv-edit text-silver">{t('Searching…')}</p>}

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

                {/* Show suggestions when no results */}
                {suggestions.length > 1 && (
                  <div className="mt-6">
                    <p className="text-xs text-silver/60 mb-3">{t('Did you mean:')}</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {suggestions.slice(0, 3).map(sug => (
                        <button
                          key={sug}
                          onClick={() => setQuery(sug)}
                          className="text-sm border border-white/20 px-3 py-2 hover:border-white transition-colors"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {state === 'loaded' && results.length > 0 && (
              <>
                {/* Show suggestions */}
                {suggestions.length > 1 && (
                  <div className="mb-6 pb-6 border-b border-white/10">
                    <p className="nv-eyebrow text-silver mb-3">{t('🔍 Suggestions')}</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.slice(1, 4).map(sug => (
                        <button
                          key={sug}
                          onClick={() => setQuery(sug)}
                          className="text-sm border border-white/20 px-3 py-2 hover:border-white transition-colors"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <ul className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  {results.map(p => (
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
                            src={p.colors[0].image}
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
              </>
            )}
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}
