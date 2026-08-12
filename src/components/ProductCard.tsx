import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Plus } from 'lucide-react';
import type { Product, Size } from '../types';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

export default function ProductCard({ product }: { product: Product }) {
  const [colorIdx, setColorIdx] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const { addLine } = useCart();
  const { toggle, has } = useWishlist();

  const color = product.colors[colorIdx];
  const wished = has(product.id);

  const handleQuickAdd = (size: Size) => {
    addLine({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      image: color.image,
      price: product.price,
      color: color.name,
      size,
      quantity: 1,
    });
    setQuickAddOpen(false);
  };

  return (
    <div
      data-testid="product-card"
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setQuickAddOpen(false);
      }}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-mist">
        <Link to={`/product/${product.slug}`} aria-label={product.name}>
          <img
            src={hovered && color.hoverImage ? color.hoverImage : color.image}
            alt={`${product.name} — ${color.name}`}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.045]"
          />
        </Link>

        {product.badge && (
          <span className="absolute top-3 left-3 bg-navy text-white text-[10px] font-semibold tracking-widest2 uppercase px-2.5 py-1">
            {product.badge}
          </span>
        )}

        <button
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={() =>
            toggle({
              productId: product.id,
              name: product.name,
              slug: product.slug,
              image: color.image,
              price: product.price,
            })
          }
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center transition-transform hover:scale-110"
        >
          <Heart
            size={15}
            className={wished ? 'fill-navy text-navy' : 'text-navy'}
            strokeWidth={1.75}
          />
        </button>

        {/* Quick add */}
        <div
          className={`absolute left-0 right-0 bottom-0 transition-all duration-300 ${
            hovered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 pointer-events-none'
          } hidden md:block`}
        >
          {!quickAddOpen ? (
            <button
              onClick={() => setQuickAddOpen(true)}
              className="w-full bg-navy text-white text-xs font-semibold tracking-widest2 uppercase py-3 flex items-center justify-center gap-2 hover:bg-navy-2 transition-colors"
            >
              <Plus size={14} /> Quick Add
            </button>
          ) : (
            <div className="bg-navy p-2 flex flex-wrap gap-1.5">
              {product.sizes.map(s => (
                <button
                  key={s.size}
                  disabled={!s.inStock}
                  onClick={() => handleQuickAdd(s.size)}
                  className="flex-1 min-w-[38px] text-[11px] font-medium py-2 border border-white/25 text-white disabled:text-white/25 disabled:border-white/10 hover:bg-white hover:text-navy transition-colors disabled:hover:bg-transparent disabled:hover:text-white/25"
                >
                  {s.size}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 text-navy">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/product/${product.slug}`}>
            <h3 className="nv-edit text-sm font-semibold uppercase tracking-wide hover:text-navy/60 transition-colors">
              {product.name}
            </h3>
          </Link>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span data-testid="product-price" className="text-sm font-medium">
            EGP {product.price.toLocaleString()}
          </span>
          {product.compareAtPrice && (
            <span className="text-sm text-navy/40 line-through">
              EGP {product.compareAtPrice.toLocaleString()}
            </span>
          )}
        </div>

        {product.colors.length > 1 && (
          <div className="flex items-center gap-1.5 mt-2">
            {product.colors.map((c, i) => (
              <button
                key={c.name}
                aria-label={c.name}
                onClick={() => setColorIdx(i)}
                className={`w-4 h-4 rounded-full border transition-all ${
                  i === colorIdx
                    ? 'ring-1 ring-offset-2 ring-offset-white ring-navy'
                    : 'border-navy/20'
                }`}
                style={{
                  backgroundColor: c.hex,
                  borderColor: c.hex === '#FFFFFF' ? '#A7A7A7' : c.hex,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
