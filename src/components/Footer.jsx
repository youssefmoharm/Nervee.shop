import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div>
          <h2>NERVE</h2>
          <p>Contemporary essentials. Precision cut. Built for the body in motion.</p>
        </div>
        <div>
          <h3>Shop</h3>
          <div>
            <Link to="/shop">All products</Link>
          </div>
          <div>
            <Link to="/shop?cat=outerwear">Outerwear</Link>
          </div>
          <div>
            <Link to="/shop?cat=knitwear">Knitwear</Link>
          </div>
        </div>
        <div>
          <h3>Help</h3>
          <p>Shipping 3–6 days</p>
          <p>Free returns 30 days</p>
          <p>Size guide in product</p>
        </div>
        <div>
          <h3>Contact</h3>
          <p>hello@nerve.studio</p>
          <p>Mon–Fri 10–18</p>
        </div>
      </div>
      <p className="wrap footer-copy">© {new Date().getFullYear()} NERVE. All rights reserved.</p>
    </footer>
  )
}
