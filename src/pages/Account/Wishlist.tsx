import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { useWishlist } from '../../context/WishlistContext'
import AccountLayout from './AccountLayout'

export default function Wishlist() {
  const { items, toggle } = useWishlist()

  return (
    <AccountLayout>
      <h2 className="nv-heading text-3xl mb-6">Wishlist</h2>

      {items.length === 0 ? (
        <div className="text-center py-16 border border-navy/10">
          <p className="text-navy/60 mb-4">Your wishlist is empty.</p>
          <Link to="/shop" className="nv-eyebrow underline">
            Browse Products
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-5">
          {items.map((item) => (
            <li key={item.productId} className="relative group">
              <button
                aria-label="Remove from wishlist"
                onClick={() => toggle(item)}
                className="absolute top-2 right-2 z-10 bg-white/90 p-1.5 hover:bg-white transition-colors"
              >
                <X size={14} />
              </button>
              <Link to={`/product/${item.slug}`} className="block">
                <div className="aspect-[3/4] bg-mist overflow-hidden mb-2">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <p className="nv-edit text-xs font-semibold uppercase truncate">{item.name}</p>
                <p className="text-xs text-navy/60 mt-0.5">EGP {item.price.toLocaleString()}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AccountLayout>
  )
}
