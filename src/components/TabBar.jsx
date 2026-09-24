import { NavLink } from 'react-router-dom'
import { IconBag, IconGrid, IconHome, IconUser } from './Icons.jsx'
import { useCart } from '../context/CartContext.jsx'

export default function TabBar() {
  const { count } = useCart()
  return (
    <nav className="tabbar" aria-label="Mobile">
      <NavLink to="/" end className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
        <IconHome />
        Home
      </NavLink>
      <NavLink to="/shop" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
        <IconGrid />
        Shop
      </NavLink>
      <NavLink to="/cart" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
        <span className="tab-icon">
          <IconBag />
          {count > 0 && <span className="cart-count">{count > 9 ? '9+' : count}</span>}
        </span>
        Bag
      </NavLink>
      <NavLink to="/checkout" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
        <IconUser />
        Pay
      </NavLink>
    </nav>
  )
}
