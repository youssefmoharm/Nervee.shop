import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard.jsx'
import { CATEGORIES, PRODUCTS } from '../data/products.js'

export default function Shop() {
  const [params, setParams] = useSearchParams()
  const cat = params.get('cat') || 'all'
  const [sort, setSort] = useState('featured')

  const items = useMemo(() => {
    let list = PRODUCTS.filter((p) => cat === 'all' || p.category === cat)
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price)
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [cat, sort])

  return (
    <div className="wrap">
      <div className="page-title">
        <h1>Shop</h1>
        <p>{items.length} pieces in rotation</p>
      </div>
      <div className="filters" role="toolbar" aria-label="Categories">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`filter-chip${cat === c.id ? ' active' : ''}`}
            onClick={() => setParams(c.id === 'all' ? {} : { cat: c.id })}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <span>{items.length} results</span>
        <select className="sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort products">
          <option value="featured">Featured</option>
          <option value="price-asc">Price: low</option>
          <option value="price-desc">Price: high</option>
          <option value="name">Name</option>
        </select>
      </div>
      {items.length === 0 ? (
        <p className="empty">Nothing in this category yet.</p>
      ) : (
        <div className="grid" style={{ paddingBottom: 28 }}>
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
