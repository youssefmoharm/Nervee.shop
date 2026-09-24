import { NavLink, useNavigate } from 'react-router-dom'
import { IconBag, IconClose, IconMenu, IconSearch } from './Icons.jsx'
import { useCart } from '../context/CartContext.jsx'
import { PRODUCTS } from '../data/products.js'
import { useEffect, useMemo, useRef, useState } from 'react'

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/shop', label: 'Shop' },
  { to: '/cart', label: 'Bag' },
  { to: '/checkout', label: 'Checkout' },
]

export default function Header({ navOpen, setNavOpen, searchOpen, setSearchOpen }) {
  const { count, openCart, closeCart } = useCart()
  const [q, setQ] = useState('')
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (searchOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
    setQ('')
  }, [searchOpen])

  useEffect(() => {
    document.body.style.overflow = navOpen || searchOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [navOpen, searchOpen])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setNavOpen(false)
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setNavOpen, setSearchOpen])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    return PRODUCTS.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        p.colors.some((c) => c.toLowerCase().includes(term))
    ).slice(0, 6)
  }, [q])

  return (
    <>
      <header className="header">
        <div className="wrap header-inner">
          <button
            className="icon-btn menu-btn"
            aria-label="Open menu"
            aria-expanded={navOpen}
            onClick={() => {
              closeCart()
              setNavOpen(true)
            }}
          >
            <IconMenu />
          </button>
          <NavLink to="/" className="logo" onClick={() => setNavOpen(false)}>
            NERVE
          </NavLink>
          <nav className="desktop-nav" aria-label="Primary">
            {LINKS.slice(0, 2).map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === '/'}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className="icon-btn"
              aria-label="Search"
              onClick={() => {
                closeCart()
                setSearchOpen(true)
              }}
            >
              <IconSearch />
            </button>
            <button className="icon-btn" aria-label={`Bag, ${count} items`} onClick={openCart}>
              <IconBag />
              {count > 0 && <span className="cart-count">{count > 9 ? '9+' : count}</span>}
            </button>
          </div>
        </div>
      </header>

      {navOpen && (
        <>
          <button className="scrim" aria-label="Close menu" onClick={() => setNavOpen(false)} />
          <aside className="drawer nav-drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="drawer-head">
              <span className="drawer-kicker">Menu</span>
              <button className="icon-btn" aria-label="Close menu" onClick={() => setNavOpen(false)}>
                <IconClose />
              </button>
            </div>
            <nav className="nav-list">
              {LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === '/'}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                  onClick={() => setNavOpen(false)}
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
            <p className="nav-meta">Precision cut. Built for the body in motion.</p>
          </aside>
        </>
      )}

      {searchOpen && (
        <>
          <button className="scrim" aria-label="Close search" onClick={() => setSearchOpen(false)} />
          <div className="search-panel" role="dialog" aria-modal="true" aria-label="Search">
            <div className="search-row">
              <input
                ref={inputRef}
                className="search-input"
                type="search"
                placeholder="Search jackets, tees, wool..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search products"
              />
              <button className="icon-btn" aria-label="Close search" onClick={() => setSearchOpen(false)}>
                <IconClose />
              </button>
            </div>
            <div className="search-results">
              {q && results.length === 0 && <p className="empty">No matches for “{q}”.</p>}
              {results.map((p) => (
                <button
                  key={p.id}
                  className="search-item"
                  onClick={() => {
                    setSearchOpen(false)
                    navigate(`/product/${p.slug}`)
                  }}
                >
                  <img src={p.images[0]} alt="" />
                  <div>
                    <strong>{p.name}</strong>
                    <span>{p.category}</span>
                  </div>
                  <span>${p.price}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
