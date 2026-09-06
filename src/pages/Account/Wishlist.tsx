import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Share2 } from 'lucide-react';
import { useWishlist } from '../../context/WishlistContext';
import WishlistShareModal from '../../components/WishlistShareModal';
import AccountLayout from './AccountLayout';

export default function Wishlist() {
  const { items, toggle } = useWishlist();
  const [shareModalOpen, setShareModalOpen] = useState(false);

  return (
    <AccountLayout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="nv-heading text-3xl">Wishlist</h2>
        {items.length > 0 && (
          <button
            onClick={() => setShareModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded font-semibold hover:bg-navy-2 transition-colors nv-eyebrow"
          >
            <Share2 size={18} />
            Share
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 border border-navy/10">
          <p className="text-navy/60 mb-4">Your wishlist is empty.</p>
          <Link to="/shop" className="nv-eyebrow underline">
            Browse Products
          </Link>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            {items.map(item => (
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

          <WishlistShareModal
            isOpen={shareModalOpen}
            onClose={() => setShareModalOpen(false)}
            wishlistSlugs={items.map(i => i.slug)}
            wishlistCount={items.length}
          />
        </>
      )}
    </AccountLayout>
  );
}
