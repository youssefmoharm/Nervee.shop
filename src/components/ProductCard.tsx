import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Plus, X } from 'lucide-react';
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
  const inStock = product.sizes.some(s => s.inStock);

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

  const isSoldOut = !inStock;
  const isLimited = product.badge === 'LIMITED';

  return (
    <div
      data-testid="product-card"
      className={`group relative ${isSoldOut ? 'opacity-75 grayscale' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setQuickAddOpen(false);
      }}
    >
      {/* Badge Area */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
        {product.badge && (
          <span className="bg-navy text-white text-[10px] font-semibold tracking-widest2 uppercase px-2.5 py-1.5 shadow-sm">
            {product.badge}
          </span>
        )}
        {isSoldOut && (
          <span className="bg-red-600 text-white text-[10px] font-semibold tracking-widest2 uppercase px-2.5 py-1.5 shadow-sm animate-pulse">
            SOLD OUT
          </span>
        )}
        {isLimited && (
          <span className="bg-amber-600 text-white text-[10px] font-semibold tracking-widest2 uppercase px-2.5 py-1.5 shadow-sm">
            LIMITED
          </span>
        )}
      </div>

      <div className="relative aspect-[4/5] overflow-hidden bg-mist">
        <Link to={`/product/${product.slug}`} aria-label={product.name}>
          <img
            src={hovered && color.hoverImage ? color.hoverImage : color.image}
            alt={`${product.name} — ${color.name}`}
            loading="lazy"
            decoding="async"
            className={`w-full h-full object-cover transition-all duration-500 ease-[cubic-bezier(.65,0,.35,1)] group-hover:scale-[1.02] ${isSoldOut ? 'grayscale' : ''
              }`}
          />
        </Link>

        {/* Wishlist Button */}
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
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center transition-transform hover:scale-110 shadow-sm"
        >
          <Heart
            size={16}
            className={wished ? 'fill-navy text-navy' : 'text-navy'}
            strokeWidth={1.75}
          />
        </button>

        {/* Quick add - Desktop only */}
        <div
          className={`absolute left-0 right-0 bottom-0 transition-all duration-300 ${hovered && !isSoldOut ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 pointer-events-none'
            } hidden md:block`}
        >
          {!quickAddOpen ? (
            <button
              onClick={() => setQuickAddOpen(true)}
              disabled={isSoldOut}
              className={`w-full ${isSoldOut ? 'bg-mist text-silver cursor-not-allowed' : 'bg-navy text-white'
                } text-xs font-semibold tracking-widest2 uppercase py-3 flex items-center justify-center gap-2 hover:bg-navy-2 transition-colors`}
            >
              {isSoldOut ? (
                <>
                  <X size={14} /> Out of Stock
                </>
              ) : (
                <>
                  <Plus size={14} /> Quick Add
                </>
              )}
            </button>
          ) : (
            <div className="bg-navy p-2 flex flex-wrap gap-1.5">
              {product.sizes.map(s => {
                const isAvailable = s.inStock;
                return (
                  <button
                    key={s.size}
                    disabled={!isAvailable}
                    onClick={() => handleQuickAdd(s.size)}
                    className={`flex-1 min-w-[38px] text-[11px] font-medium py-2 border transition-colors ${isAvailable
                      ? 'border-white/25 text-white hover:bg-white hover:text-navy'
                      : 'border-white/10 text-white/30 cursor-not-allowed'
                      }`}
                  >
                    {s.size}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sold Out Overlay for Mobile */}
        {isSoldOut && (
          <div className="absolute inset-0 flex items-center justify-center md:hidden bg-navy/80">
            <p className="text-white font-semibold tracking-widest2 uppercase px-6 py-3 text-center">
              Sold Out
            </p>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="pt-3 text-navy">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/product/${product.slug}`}>
            <h3 className="nv-edit text-sm font-semibold uppercase tracking-wide hover:text-navy/60 transition-colors">
              {product.name}
            </h3>
          </Link>
          <span className="text-sm font-medium text-navy/60">
            {product.category}
          </span>
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

        {/* Color Swatches */}
        {product.colors.length > 1 && (
          <div className="flex items-center gap-1.5 mt-2">
            {product.colors.map((c, i) => (
              <button
                key={c.name}
                aria-label={c.name}
                onClick={() => setColorIdx(i)}
                className={`w-4 h-4 rounded-full border transition-all ${i === colorIdx
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
