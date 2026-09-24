import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { IconClose } from './Icons.jsx'
import CartLine from './CartLine.jsx'

export default function CartDrawer() {
  const { items, open, closeCart, subtotal } = useCart()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') closeCart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closeCart])

  if (!open) return null

  return (
    <>
      <button className="scrim" aria-label="Close bag" onClick={closeCart} />
      <aside className="drawer cart-drawer" role="dialog" aria-modal="true" aria-label="Bag">
        <div className="drawer-head">
          <span className="drawer-kicker">Bag</span>
          <button className="icon-btn" aria-label="Close bag" onClick={closeCart}>
            <IconClose />
          </button>
        </div>
        <div className="cart-body">
          {items.length === 0 && <p className="cart-empty">Your bag is empty. Start with the shop.</p>}
          {items.map((item) => (
            <CartLine key={item.key} item={item} />
          ))}
        </div>
        <div className="cart-foot">
          <div className="totals">
            <span>Subtotal</span>
            <strong>${subtotal}</strong>
          </div>
          <button
            className="btn btn-primary btn-block"
            disabled={!items.length}
            onClick={() => {
              closeCart()
              navigate('/checkout')
            }}
          >
            Checkout
          </button>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => {
              closeCart()
              navigate('/cart')
            }}
          >
            View bag
          </button>
        </div>
      </aside>
    </>
  )
}
