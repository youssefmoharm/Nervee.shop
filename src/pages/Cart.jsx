import { Link } from 'react-router-dom'
import CartLine from '../components/CartLine.jsx'
import { useCart } from '../context/CartContext.jsx'

export default function Cart() {
  const { items, subtotal } = useCart()
  const shipping = subtotal >= 150 || subtotal === 0 ? 0 : 12
  const total = subtotal + shipping

  return (
    <div className="wrap cart-page">
      <div className="page-title">
        <h1>Bag</h1>
        <p>{items.length ? `${items.length} item${items.length > 1 ? 's' : ''}` : 'Nothing here yet'}</p>
      </div>
      {items.length === 0 ? (
        <div className="empty">
          <p>Your bag is empty.</p>
          <Link className="btn btn-primary" to="/shop" style={{ marginTop: 16 }}>
            Shop the drop
          </Link>
        </div>
      ) : (
        <>
          {items.map((item) => (
            <CartLine key={item.key} item={item} />
          ))}
          <div className="summary">
            <h2>Summary</h2>
            <div className="summary-line">
              <span>Subtotal</span>
              <span>${subtotal}</span>
            </div>
            <div className="summary-line">
              <span>Shipping</span>
              <span>{shipping === 0 ? 'Free' : `$${shipping}`}</span>
            </div>
            <div className="summary-line total">
              <span>Total</span>
              <span>${total}</span>
            </div>
            <p className="notice">Free shipping over $150.</p>
            <Link className="btn btn-primary btn-block" to="/checkout" style={{ marginTop: 12 }}>
              Checkout
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
