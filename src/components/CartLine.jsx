import { useCart } from '../context/CartContext.jsx'

export default function CartLine({ item }) {
  const { setQty, remove } = useCart()
  return (
    <article className="cart-line">
      <img src={item.image} alt="" />
      <div>
        <h3>{item.name}</h3>
        <p className="meta">
          {item.color} / {item.size}
        </p>
        <div className="line-row">
          <div className="qty">
            <button className="qty-btn" aria-label="Decrease quantity" onClick={() => setQty(item.key, item.qty - 1)}>
              −
            </button>
            <span>{item.qty}</span>
            <button className="qty-btn" aria-label="Increase quantity" onClick={() => setQty(item.key, item.qty + 1)}>
              +
            </button>
          </div>
          <strong>${item.price * item.qty}</strong>
        </div>
        <button className="remove" onClick={() => remove(item.key)}>
          Remove
        </button>
      </div>
    </article>
  )
}
