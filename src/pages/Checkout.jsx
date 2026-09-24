import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'

const empty = {
  email: '',
  name: '',
  address: '',
  city: '',
  zip: '',
  country: 'United States',
  card: '',
  exp: '',
  cvc: '',
}

export default function Checkout() {
  const { items, subtotal, clear } = useCart()
  const [form, setForm] = useState(empty)
  const [errors, setErrors] = useState({})
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  const shipping = subtotal >= 150 || subtotal === 0 ? 0 : 12
  const total = subtotal + shipping

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const validate = () => {
    const next = {}
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email.'
    if (form.name.trim().length < 2) next.name = 'Enter your name.'
    if (form.address.trim().length < 4) next.address = 'Enter a street address.'
    if (form.city.trim().length < 2) next.city = 'Enter a city.'
    if (!/^[A-Za-z0-9 \-]{3,10}$/.test(form.zip)) next.zip = 'Enter a postal code.'
    if (!/^\d{12,19}$/.test(form.card.replace(/\s/g, ''))) next.card = 'Enter a card number.'
    if (!/^\d{2}\/\d{2}$/.test(form.exp)) next.exp = 'Use MM/YY.'
    if (!/^\d{3,4}$/.test(form.cvc)) next.cvc = 'Enter CVC.'
    return next
  }

  const submit = (e) => {
    e.preventDefault()
    if (!items.length) return
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length) return
    clear()
    setDone(true)
  }

  if (!items.length && !done) {
    return (
      <div className="wrap empty">
        <h1>Checkout</h1>
        <p>Your bag is empty.</p>
        <Link className="btn btn-primary" to="/shop" style={{ marginTop: 16 }}>
          Continue shopping
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="wrap success">
        <p className="kicker">Order confirmed</p>
        <h1>Nerve received.</h1>
        <p>A confirmation is on its way. This is a demo checkout — no payment was taken.</p>
        <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/shop')}>
          Back to shop
        </button>
      </div>
    )
  }

  return (
    <div className="wrap checkout" style={{ paddingBottom: 32 }}>
      <div>
        <div className="page-title">
          <h1>Checkout</h1>
          <p>Demo form. No real payment is processed.</p>
        </div>
        <form className="form" onSubmit={submit} noValidate>
          <label className="field">
            Email
            <input type="email" autoComplete="email" value={form.email} onChange={set('email')} />
            {errors.email && <span className="error">{errors.email}</span>}
          </label>
          <label className="field">
            Full name
            <input autoComplete="name" value={form.name} onChange={set('name')} />
            {errors.name && <span className="error">{errors.name}</span>}
          </label>
          <label className="field">
            Address
            <input autoComplete="street-address" value={form.address} onChange={set('address')} />
            {errors.address && <span className="error">{errors.address}</span>}
          </label>
          <div className="form-row two">
            <label className="field">
              City
              <input autoComplete="address-level2" value={form.city} onChange={set('city')} />
              {errors.city && <span className="error">{errors.city}</span>}
            </label>
            <label className="field">
              Postal code
              <input autoComplete="postal-code" value={form.zip} onChange={set('zip')} />
              {errors.zip && <span className="error">{errors.zip}</span>}
            </label>
          </div>
          <label className="field">
            Country
            <select value={form.country} onChange={set('country')}>
              <option>United States</option>
              <option>United Kingdom</option>
              <option>Germany</option>
              <option>France</option>
              <option>Japan</option>
            </select>
          </label>
          <label className="field">
            Card number
            <input
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="4242 4242 4242 4242"
              value={form.card}
              onChange={set('card')}
            />
            {errors.card && <span className="error">{errors.card}</span>}
          </label>
          <div className="form-row two">
            <label className="field">
              Expiry
              <input autoComplete="cc-exp" placeholder="MM/YY" value={form.exp} onChange={set('exp')} />
              {errors.exp && <span className="error">{errors.exp}</span>}
            </label>
            <label className="field">
              CVC
              <input inputMode="numeric" autoComplete="cc-csc" value={form.cvc} onChange={set('cvc')} />
              {errors.cvc && <span className="error">{errors.cvc}</span>}
            </label>
          </div>
          <button className="btn btn-primary btn-block" type="submit">
            Pay ${total}
          </button>
        </form>
      </div>
      <aside className="summary">
        <h2>Order</h2>
        {items.map((i) => (
          <div className="summary-line" key={i.key}>
            <span>
              {i.name} × {i.qty}
            </span>
            <span>${i.price * i.qty}</span>
          </div>
        ))}
        <div className="summary-line">
          <span>Shipping</span>
          <span>{shipping === 0 ? 'Free' : `$${shipping}`}</span>
        </div>
        <div className="summary-line total">
          <span>Total</span>
          <span>${total}</span>
        </div>
      </aside>
    </div>
  )
}
