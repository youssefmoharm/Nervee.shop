import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard.jsx'
import { PRODUCTS } from '../data/products.js'

export default function Home() {
  const featured = PRODUCTS.slice(0, 6)
  return (
    <>
      <section className="hero">
        <img
          className="hero-img"
          src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&h=2000&q=80"
          alt="Model in a structured coat against concrete"
        />
        <div className="hero-scrim" />
        <div className="hero-copy">
          <p className="kicker">Fall 26 / Drop 01</p>
          <h1>Cut for the body in motion.</h1>
          <p>Wool, canvas, and merino essentials with no extra noise. Built to last a season and then another.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/shop">
              Shop the drop
            </Link>
            <Link className="btn btn-ghost" to="/product/graphite-field-jacket">
              Field jacket
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2>This week</h2>
            <Link className="link-btn" to="/shop">
              View all
            </Link>
          </div>
          <div className="grid">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap editorial">
          <Link to="/shop?cat=outerwear" className="editorial-card">
            <img
              src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&h=900&q=80"
              alt=""
            />
            <div>
              <span className="kicker">Outerwear</span>
              <strong style={{ display: 'block', fontSize: 22 }}>Coats that hold a line</strong>
            </div>
          </Link>
          <Link to="/shop?cat=knitwear" className="editorial-card">
            <img
              src="https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=900&h=900&q=80"
              alt=""
            />
            <div>
              <span className="kicker">Knitwear</span>
              <strong style={{ display: 'block', fontSize: 22 }}>Merino, no logo</strong>
            </div>
          </Link>
        </div>
      </section>
    </>
  )
}
