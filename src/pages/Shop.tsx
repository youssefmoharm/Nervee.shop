import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react'
import type { Product, SortOption } from '../types'
import { productService, type ShopFilters } from '../services/productService'
import { categories } from '../data/products'
import ProductCard from '../components/ProductCard'
import Skeleton from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { filterProducts, getSearchSuggestions } from '../lib/productDiscovery'

const ALL_COLORS = ['Navy', 'White', 'Black', 'Gray', 'Silver', 'Raw Indigo', 'Washed Black']
const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

const sortLabels: Record<SortOption, string> = {
  featured: 'Featured',
  newest: 'Newest',
  'price-asc': 'Price: Low to High',
  'price-desc': 'Price: High to Low',
  'best-selling': 'Best Selling',
}

export default function Shop() {
  const [params, setParams] = useSearchParams()
  const category = params.get('category') as ShopFilters['category']
  const [products, setProducts] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([]) // All products fetched
  const [loading, setLoading] = useState(true)
  const [displayCount, setDisplayCount] = useState(12) // Initially show 12 products
  const [searchQuery, setSearchQuery] = useState('')
  const [sort, setSort] = useState<SortOption>('featured')
  const [colors, setColors] = useState<string[]>([])
  const [sizes, setSizes] = useState<string[]>([])
  const [priceMax, setPriceMax] = useState(3500)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filterOpen, setFilterOpen] = useState(false)

  const filters: ShopFilters = useMemo(
    () => ({ category, colors, sizes, priceMax, sort }),
    [category, colors, sizes, priceMax, sort]
  )

  const suggestions = useMemo(() => getSearchSuggestions(allProducts, searchQuery), [allProducts, searchQuery])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setDisplayCount(12) // Reset display count when filters change
    productService.list(filters).then((data) => {
      if (mounted) {
        const visible = filterProducts(data, searchQuery, category, colors, sizes, priceMax)
        setAllProducts(visible)
        setProducts(visible.slice(0, 12))
        setLoading(false)
      }
    })
    return () => {
      mounted = false
    }
  }, [category, colors, filters, priceMax, searchQuery, sizes])

  const toggleColor = (c: string) =>
    setColors((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  const toggleSize = (s: string) =>
    setSizes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  const activeFilterCount = colors.length + sizes.length + (priceMax < 3500 ? 1 : 0)

  const FilterPanel = (
    <div className="space-y-8">
      <div>
        <h4 className="nv-eyebrow mb-3">Category</h4>
        <ul className="space-y-2">
          <li>
            <button
              onClick={() => setParams((p) => { p.delete('category'); return p })}
              className={`text-sm ${!category ? 'font-semibold' : 'text-navy/60'} hover:text-navy transition-colors`}
            >
              All
            </button>
          </li>
          {categories.map((c) => (
            <li key={c}>
              <button
                onClick={() => setParams({ category: c })}
                className={`text-sm ${category === c ? 'font-semibold' : 'text-navy/60'} hover:text-navy transition-colors`}
              >
                {c}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="nv-eyebrow mb-3">Color</h4>
        <div className="flex flex-wrap gap-2">
          {ALL_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => toggleColor(c)}
              aria-pressed={colors.includes(c)}
              className={`text-xs px-3 py-1.5 border transition-colors ${
                colors.includes(c) ? 'bg-navy text-white border-navy' : 'border-navy/25 text-navy/70'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="nv-eyebrow mb-3">Size</h4>
        <div className="flex flex-wrap gap-2">
          {ALL_SIZES.map((s) => (
            <button
              key={s}
              onClick={() => toggleSize(s)}
              aria-pressed={sizes.includes(s)}
              className={`w-10 h-10 text-xs border transition-colors ${
                sizes.includes(s) ? 'bg-navy text-white border-navy' : 'border-navy/25 text-navy/70'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="nv-eyebrow mb-3">Max Price — EGP {priceMax.toLocaleString()}</h4>
        <input
          type="range"
          min={500}
          max={3500}
          step={50}
          value={priceMax}
          onChange={(e) => setPriceMax(Number(e.target.value))}
          className="w-full accent-navy"
        />
      </div>

      {activeFilterCount > 0 && (
        <button
          onClick={() => {
            setColors([])
            setSizes([])
            setPriceMax(3500)
          }}
          className="text-xs underline text-navy/60 hover:text-navy"
        >
          Clear all filters
        </button>
      )}
    </div>
  )

  return (
    <div className="bg-white text-navy min-h-screen pt-24 md:pt-28">
      <div className="mx-auto max-w-[1600px] px-5 md:px-8 pb-24">
        <div className="mb-8 md:mb-12">
          <p className="nv-eyebrow text-navy/50 mb-2">{category || 'Shop All'}</p>
          <h1 className="nv-heading text-5xl md:text-7xl">{category || 'Shop'}</h1>
        </div>

        <div className="mb-6 max-w-2xl">
          <label htmlFor="product-search" className="sr-only">Search products</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/40" />
            <input
              id="product-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tees, hoodies, bags…"
              className="w-full rounded-full border border-navy/20 bg-white px-10 py-3 text-sm outline-none focus:border-navy"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-navy/50"
              >
                Clear
              </button>
            )}
          </div>
          {searchQuery && suggestions.length > 0 && (
            <ul className="mt-2 rounded-2xl border border-navy/10 bg-white p-2 shadow-sm">
              {suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => setSearchQuery(suggestion)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-navy/70 hover:bg-mist"
                  >
                    <span>{suggestion}</span>
                    <span className="text-[11px] uppercase tracking-wider text-navy/40">Quick search</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {(searchQuery || colors.length || sizes.length || priceMax < 3500) && (
          <div className="mb-6 flex flex-wrap gap-2">
            {searchQuery && (
              <span className="rounded-full bg-mist px-3 py-1 text-xs text-navy/70">Search: {searchQuery}</span>
            )}
            {colors.map((color) => (
              <span key={color} className="rounded-full bg-mist px-3 py-1 text-xs text-navy/70">{color}</span>
            ))}
            {sizes.map((size) => (
              <span key={size} className="rounded-full bg-mist px-3 py-1 text-xs text-navy/70">Size: {size}</span>
            ))}
            {priceMax < 3500 && <span className="rounded-full bg-mist px-3 py-1 text-xs text-navy/70">Up to EGP {priceMax.toLocaleString()}</span>}
          </div>
        )}

        <div className="flex items-center justify-between border-y border-navy/10 py-3 mb-8 sticky top-16 md:top-20 bg-white z-20">
          <button
            onClick={() => setFilterOpen(true)}
            className="lg:hidden flex items-center gap-2 text-sm font-medium"
          >
            <SlidersHorizontal size={16} /> Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
          <span className="hidden lg:block text-sm text-navy/50">
            {loading ? 'Loading…' : `Showing ${products.length} of ${allProducts.length} product${allProducts.length !== 1 ? 's' : ''}`}
          </span>

          <div className="flex items-center gap-4">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="text-sm border border-navy/20 px-3 py-2 bg-white focus:outline-none"
              aria-label="Sort products"
            >
              {(Object.keys(sortLabels) as SortOption[]).map((s) => (
                <option key={s} value={s}>
                  {sortLabels[s]}
                </option>
              ))}
            </select>
            <div className="hidden sm:flex items-center gap-1 border border-navy/20">
              <button
                aria-label="Grid view"
                onClick={() => setView('grid')}
                className={`p-2 ${view === 'grid' ? 'bg-navy text-white' : ''}`}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                aria-label="List view"
                onClick={() => setView('list')}
                className={`p-2 ${view === 'list' ? 'bg-navy text-white' : ''}`}
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-12">
          <aside className="hidden lg:block w-56 flex-shrink-0">{FilterPanel}</aside>

          <div className="flex-1">
            {loading ? (
              <div className={`grid gap-x-5 gap-y-10 ${view === 'grid' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1'}`}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-[4/5] w-full" />
                    <Skeleton variant="text" count={2} height="h-3" />
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <EmptyState
                title="No products match that search"
                body="Try a broader keyword, clear a filter, or browse our full collection."
                actionLabel="Reset filters"
                onAction={() => {
                  setColors([])
                  setSizes([])
                  setPriceMax(3500)
                  setSearchQuery('')
                  setParams({})
                }}
              />
            ) : (
              <>
                <div
                  className={`grid gap-x-5 gap-y-12 ${
                    view === 'grid' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 max-w-md'
                  }`}
                >
                  {products.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
                {displayCount < allProducts.length && (
                  <div className="mt-12 flex justify-center">
                    <button
                      onClick={() => {
                        const newCount = Math.min(displayCount + 12, allProducts.length)
                        setDisplayCount(newCount)
                        setProducts(allProducts.slice(0, newCount))
                      }}
                      className="border border-navy px-8 py-4 nv-eyebrow hover:bg-navy hover:text-white transition-colors"
                    >
                      Load More {allProducts.length - displayCount > 0 && `(${allProducts.length - displayCount} remaining)`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      <button
        type="button"
        aria-label="Close filters"
        className={`fixed inset-0 z-[90] bg-navy/40 lg:hidden transition-opacity border-0 p-0 ${
          filterOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setFilterOpen(false)}
      />
      <div
        className={`fixed top-0 left-0 z-[95] h-full w-[85%] max-w-sm bg-white text-navy p-6 overflow-y-auto nv-scroll transition-transform duration-400 lg:hidden ${
          filterOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between mb-8">
          <h3 className="nv-eyebrow">Filters</h3>
          <button onClick={() => setFilterOpen(false)} aria-label="Close filters">
            <X size={20} />
          </button>
        </div>
        {FilterPanel}
        <button
          onClick={() => setFilterOpen(false)}
          className="mt-8 w-full bg-navy text-white nv-eyebrow py-4"
        >
          Show {products.length} Results
        </button>
      </div>
    </div>
  )
}
