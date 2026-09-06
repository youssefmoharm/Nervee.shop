import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import type { Product } from '../types';
import { productService } from '../services/productService';
import { searchProducts } from '../services/searchService';
import { categories } from '../data/products';
import { useToast } from '../context/ToastContext';

const RECENT_KEY = 'nerve.recentSearches';

export default function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
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
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  // Load all products on mount for client-side search
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const products = await productService.list();
        setAllProducts(products);
      } catch (err) {
        console.error('Failed to load products for search:', err);
      }
    };
    loadProducts();
  }, []);

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
        showToast('Connection error - try again', 'error', 3000);
      }
    }, 220);
    return () => clearTimeout(handle);
  }, [query, allProducts, showToast]);

  const commitSearch = (term: string) => {
    if (!term.trim()) return;
    const next = [term, ...recent.filter(r => r !== term)].slice(0, 5);
    setRecent(next);
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  return (
    <div
      className={`fixed inset-0 z-[80] bg-navy transition-opacity duration-300 ${
        open ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Search products"
    >
      <div className="mx-auto max-w-3xl px-5 pt-24 md:pt-32 h-screen overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="nv-eyebrow text-silver">Search</span>
          <button aria-label="Close search" onClick={onClose} className="p-2">
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
            placeholder="Search tees, hoodies, denim..."
            className="flex-1 bg-transparent nv-heading text-2xl md:text-4xl focus:outline-none placeholder:text-white/25"
            aria-label="Search query"
          />
        </div>

        <div className="mt-8 pb-20">
          {state === 'idle' && (
            <div className="space-y-8">
              {/* Shop by Category */}
              <div>
                <h4 className="nv-eyebrow text-silver mb-3">Shop by Category</h4>
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
                  <h4 className="nv-eyebrow text-silver mb-3">⏱️ Recent Searches</h4>
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
                  <h4 className="nv-eyebrow text-silver mb-3">🔥 What&apos;s Hot</h4>
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

          {state === 'loading' && <p className="nv-edit text-silver">Searching…</p>}

          {state === 'error' && (
            <div className="text-center py-12">
              <p className="nv-edit text-lg text-red-400">Connection Error</p>
              <p className="text-sm text-silver/60 mt-2">
                Unable to search at the moment. Please try again.
              </p>
            </div>
          )}

          {state === 'empty' && (
            <div className="text-center py-12">
              <p className="nv-edit text-lg text-silver">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-sm text-silver/60 mt-2">Try a different search term.</p>

              {/* Show suggestions when no results */}
              {suggestions.length > 1 && (
                <div className="mt-6">
                  <p className="text-xs text-silver/60 mb-3">Did you mean:</p>
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
                  <p className="nv-eyebrow text-silver mb-3">🔍 Suggestions</p>
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
                      <p className="text-xs text-silver">EGP {p.price.toLocaleString()}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
