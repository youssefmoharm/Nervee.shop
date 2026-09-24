import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProduct, getRelated } from '../data/products.js'
import { useCart } from '../context/CartContext.jsx'
import ProductCard from '../components/ProductCard.jsx'

export default function Product() {
  const { slug } = useParams()
  const product = getProduct(slug)
  const { add, openCart } = useCart()
  const [img, setImg] = useState(0)
  const [size, setSize] = useState('')
  const [color, setColor] = useState(product?.colors[0] || '')
  const [error, setError] = useState('')
  const [toast, setToast] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

  const related = useMemo(() => (product ? getRelated(product) : []), [product])

  useEffect(() => {
    setImg(0)
    setSize('')
    setColor(product?.colors[0] || '')
    setError('')
    setToast(false)
    setGuideOpen(false)
  }, [slug, product])

  useEffect(() => {
    document.body.style.overflow = guideOpen ? 'hidden' : ''
    const onKey = (e) => {
      if (e.key === 'Escape') setGuideOpen(false)
    }
    if (guideOpen) window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [guideOpen])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(false), 2800)
    return () => clearTimeout(t)
  }, [toast])

  if (!product) {
    return (
      <div className="wrap empty">
        <h1>Product not found</h1>
        <p>That piece is no longer in the drop.</p>
        <Link className="btn btn-primary" to="/shop" style={{ marginTop: 16 }}>
          Back to shop
        </Link>
      </div>
    )
  }

  const onAdd = () => {
    if (!size) {
      setError('Select a size to continue.')
      return
    }
    setError('')
    add({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0],
      size,
      color,
      qty: 1,
      slug: product.slug,
    })
    setToast(true)
  }

  return (
    <div className="wrap pdp">
      <div className="gallery">
        <img className="gallery-main" src={product.images[img]} alt={`${product.name} view ${img + 1}`} />
        <div className="thumbs">
          {product.images.map((src, i) => (
            <button
              key={src}
              className={`thumb${img === i ? ' active' : ''}`}
              onClick={() => setImg(i)}
              aria-label={`View image ${i + 1}`}
            >
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      </div>

      <div className="pdp-info">
        <p className="kicker">{product.tag} · {product.category}</p>
        <h1>{product.name}</h1>
        <p className="price">${product.price}</p>
        <p className="desc">{product.description}</p>

        <span className="field-label">Color</span>
        <div className="color-row">
          {product.colors.map((c) => (
            <button
              key={c}
              className={`color-btn${color === c ? ' active' : ''}`}
              onClick={() => setColor(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="size-head">
          <span className="field-label">Size</span>
          <button type="button" className="link-btn" onClick={() => setGuideOpen(true)}>
            Size guide
          </button>
        </div>
        <div className="size-row">
          {product.sizes.map((s) => (
            <button
              key={s}
              className={`size-btn${size === s ? ' active' : ''}`}
              onClick={() => {
                setSize(s)
                setError('')
              }}
            >
              {s}
            </button>
          ))}
        </div>
        {error && <p className="error">{error}</p>}

        <div className="pdp-cta">
          <button className="btn btn-primary btn-block" onClick={onAdd}>
            Add to bag
          </button>
        </div>

        <ul className="details">
          {product.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>

      {related.length > 0 && (
        <section className="section" style={{ gridColumn: '1 / -1' }}>
          <div className="section-head">
            <h2>Also in {product.category}</h2>
          </div>
          <div className="grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {toast && (
        <div className="toast" role="status">
          Added to bag
          <button
            onClick={() => {
              setToast(false)
              openCart()
            }}
          >
            View
          </button>
        </div>
      )}

      {guideOpen && (
        <>
          <button className="scrim" aria-label="Close size guide" onClick={() => setGuideOpen(false)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Size guide">
            <div className="drawer-head">
              <span className="drawer-kicker">Size guide</span>
              <button className="icon-btn" aria-label="Close size guide" onClick={() => setGuideOpen(false)}>
                ×
              </button>
            </div>
            <table className="guide-table">
              <thead>
                <tr>
                  <th>Size</th>
                  <th>Chest</th>
                  <th>Waist</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>XS</td><td>86 cm</td><td>70 cm</td></tr>
                <tr><td>S</td><td>91 cm</td><td>75 cm</td></tr>
                <tr><td>M</td><td>96 cm</td><td>80 cm</td></tr>
                <tr><td>L</td><td>101 cm</td><td>85 cm</td></tr>
                <tr><td>XL</td><td>108 cm</td><td>92 cm</td></tr>
              </tbody>
            </table>
            <p className="notice">Fit is regular unless noted. If between sizes, take the larger.</p>
          </div>
        </>
      )}
    </div>
  )
}
