import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import type { Product } from '../types'
import { productService } from '../services/productService'
import { categories } from '../data/products'

const POPULAR = ['Core Tee', 'Hoodie', 'Archive Denim', 'Cap']
const RECENT_KEY = 'nerve.recentSearches'

export default function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(RECENT_KEY) || '[]')
    } catch {
      return []
    }
  })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
    }
  }, [open])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    const handle = setTimeout(async () => {
      const r = await productService.search(query)
      setResults(r)
      setLoading(false)
    }, 220)
    return () => clearTimeout(handle)
  }, [query])

  const commitSearch = (term: string) => {
    if (!term.trim()) return
    const next = [term, ...recent.filter((r) => r !== term)].slice(0, 5)
    setRecent(next)
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(next))
  }

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
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitSearch(query)}
            placeholder="Search tees, hoodies, denim..."
            className="flex-1 bg-transparent nv-heading text-2xl md:text-4xl focus:outline-none placeholder:text-white/25"
            aria-label="Search query"
          />
        </div>

        <div className="mt-8 pb-20">
          {!query.trim() && (
            <div className="space-y-8">
              {/* Shop by Category */}
              <div>
                <h4 className="nv-eyebrow text-silver mb-3">Shop by Category</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {categories.map((cat) => (
                    <Link
                      key={cat}
                      to={`/shop?category=${encodeURIComponent(cat)}`}
                      onClick={() => {
                        commitSearch(cat)
                        onClose()
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
                  <h4 className="nv-eyebrow text-silver mb-3">Recent Searches</h4>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((r) => (
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
              <div>
                <h4 className="nv-eyebrow text-silver mb-3">Popular Searches</h4>
                <div className="flex flex-wrap gap-2">
                  {POPULAR.map((p) => (
                    <button
                      key={p}
                      onClick={() => setQuery(p)}
                      className="text-sm border border-white/20 px-4 py-2 hover:border-white transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {query.trim() && loading && (
            <p className="nv-edit text-silver">Searching…</p>
          )}

          {query.trim() && !loading && results.length === 0 && (
            <div className="text-center py-12">
              <p className="nv-edit text-lg text-silver">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-sm text-silver/60 mt-2">Try a different search term.</p>
            </div>
          )}

          {results.length > 0 && (
            <ul className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {results.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/product/${p.slug}`}
                    onClick={() => {
                      commitSearch(query)
                      onClose()
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
          )}
        </div>
      </div>
    </div>
  )
}
