import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Plus, Eye, BarChart3, Ruler } from 'lucide-react';
import type { Product, Size } from '../types';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import { useQuickView } from '../context/QuickViewContext';
import { useComparison } from '../hooks/useComparison';
import OptimizedImage from './OptimizedImage';

export default function ProductCard({ product }: { product: Product }) {
  const [colorIdx, setColorIdx] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const { addLine } = useCart();
  const { toggle, has } = useWishlist();
  const { showToast } = useToast();
  const { open: openQuickView } = useQuickView();
  const {
    add: addToComparison,
    remove: removeFromComparison,
    has: inComparison,
    isFull,
  } = useComparison();

  const color = product.colors[colorIdx] ??
    product.colors[0] ?? { name: '', hex: '#ccc', image: '/placeholder-product.jpg' };
  const wished = has(product.id);

  // Check for low stock (any size < 5 items)
  const minStock =
    product.sizes.length > 0
      ? Math.min(...product.sizes.map(() => 1)) // Simplified - would need stock data
      : 0;
  const hasLowStock = product.sizes.some(s => s.inStock) && minStock < 5;

  // Check if product is new (created within last 7 days)
  const createdDate = new Date(product.createdAt);
  const daysSinceCreation = Math.floor(
    (new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const isNew = daysSinceCreation <= 7;

  // Mock trending indicator (would be based on views/sales in real app)
  const isTrending = product.isBestSeller || product.badge === 'BEST SELLER';

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
    showToast(`Added ${product.name} to bag`, 'success', 3000);
    setQuickAddOpen(false);
  };

  const handleToggleComparison = () => {
    if (inComparison(product.id)) {
      removeFromComparison(product.id);
      showToast(`Removed from comparison`, 'info', 3000);
    } else {
      if (isFull) {
        showToast('You can only compare up to 3 products', 'error', 3000);
        return;
      }
      addToComparison(product);
      showToast(`Added to comparison`, 'success', 3000);
    }
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
          <OptimizedImage
            slug={product.slug}
            color={product.colors[colorIdx].name}
            imageType={hovered ? '02-back' : '01-front'}
            size="card"
            productName={product.name}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.045]"
            testId="product-card-image"
          />
        </Link>

        {product.badge && (
          <span className="absolute top-3 left-3 bg-navy text-white text-[10px] font-semibold tracking-widest2 uppercase px-2.5 py-1">
            {product.badge}
          </span>
        )}

        {/* Scarcity badges */}
        <div className="absolute top-3 left-3 space-y-2 flex flex-col">
          {product.badge && (
            <span className="block bg-navy text-white text-[10px] font-semibold tracking-widest2 uppercase px-2.5 py-1">
              {product.badge}
            </span>
          )}

          {hasLowStock && !product.badge && (
            <span className="block bg-red-600 text-white text-[10px] font-semibold tracking-widest2 uppercase px-2.5 py-1">
              Low Stock
            </span>
          )}

          {isTrending && !product.badge && (
            <span className="block bg-orange-500 text-white text-[10px] font-semibold tracking-widest2 uppercase px-2.5 py-1">
              🔥 Trending
            </span>
          )}

          {isNew && !product.badge && (
            <span className="block bg-green-600 text-white text-[10px] font-semibold tracking-widest2 uppercase px-2.5 py-1">
              ✨ New
            </span>
          )}
        </div>

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

        {/* Quick add + Quick view */}
        <div
          className={`absolute left-0 right-0 bottom-0 transition-all duration-300 ${
            hovered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 pointer-events-none'
          } hidden md:flex flex-col gap-1`}
        >
          {!quickAddOpen ? (
            <>
              <button
                onClick={() => setQuickAddOpen(true)}
                className="w-full bg-navy text-white text-xs font-semibold tracking-widest2 uppercase py-2.5 flex items-center justify-center gap-2 hover:bg-navy-2 transition-colors"
              >
                <Plus size={14} /> Quick Add
              </button>
              <button
                onClick={() => openQuickView(product)}
                className="w-full bg-navy/80 text-white text-xs font-semibold tracking-widest2 uppercase py-2.5 flex items-center justify-center gap-2 hover:bg-navy transition-colors"
              >
                <Eye size={14} /> Quick View
              </button>
            </>
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
                aria-label={`Select color: ${c.name}`}
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

        {/* Compare button */}
        <button
          onClick={handleToggleComparison}
          className={`w-full mt-3 text-xs font-semibold tracking-widest2 uppercase py-2 px-3 rounded flex items-center justify-center gap-2 transition-colors ${
            inComparison(product.id)
              ? 'bg-navy text-white hover:bg-navy-2'
              : 'bg-navy/10 text-navy hover:bg-navy/20'
          }`}
        >
          <BarChart3 size={14} />
          {inComparison(product.id) ? 'In Comparison' : 'Compare'}
        </button>

        {/* Find My Size button */}
        <Link
          to="/size-guide"
          className="w-full mt-2 text-xs font-semibold tracking-widest2 uppercase py-2 px-3 rounded flex items-center justify-center gap-2 transition-colors bg-mist text-navy hover:bg-mist/75"
        >
          <Ruler size={14} />
          Find My Size
        </Link>
      </div>
    </div>
  );
}
