import { useState, useEffect } from 'react';
import FocusTrap from 'focus-trap-react';
import { ChevronLeft, ChevronRight, Heart, X } from 'lucide-react';
import { useQuickView } from '../context/QuickViewContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import { Link } from 'react-router-dom';
import type { Size } from '../types';

export default function ProductQuickView() {
  const { isOpen, product, close } = useQuickView();
  const { addLine } = useCart();
  const { toggle, has } = useWishlist();
  const { showToast } = useToast();

  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [galleryIdx, setGalleryIdx] = useState(0);

  // Reset state when product changes
  useEffect(() => {
    if (product) {
      setSelectedColorIdx(0);
      setSelectedSize(null);
      setQuantity(1);
      setGalleryIdx(0);
    }
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        close();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevImage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, galleryIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle click outside modal
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      close();
    }
  };

  if (!isOpen || !product) return null;

  const color = product.colors[selectedColorIdx];
  const gallery = [color.image, ...(product.gallery || [])];
  const image = gallery[galleryIdx] || color.image;
  const wished = has(product.id);

  const handlePrevImage = () => {
    setGalleryIdx(prev => (prev === 0 ? gallery.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setGalleryIdx(prev => (prev === gallery.length - 1 ? 0 : prev + 1));
  };

  const handleAddToBag = () => {
    if (!selectedSize) {
      showToast('Please select a size', 'error', 3000);
      return;
    }

    addLine({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      image: color.image,
      price: product.price,
      color: color.name,
      size: selectedSize,
      quantity,
    });

    showToast(`Added ${product.name} to bag`, 'success', 3000);
    close();
  };

  const handleWishlist = () => {
    toggle({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      image: color.image,
      price: product.price,
    });

    const action = wished ? 'removed from' : 'added to';
    showToast(`${product.name} ${action} wishlist`, 'success', 2000);
  };

  const inStockForSize = selectedSize
    ? product.sizes.find(s => s.size === selectedSize)?.inStock
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleBackdropClick}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            close();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Close modal"
        className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-30' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={isOpen ? 'false' : 'true'}
      />

      {/* Modal */}
      <FocusTrap active={isOpen} onClickOutside={close}>
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center px-4 transition-opacity duration-300 ${
            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="quickview-modal-title"
        >
          <div
            className={`bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl transition-transform duration-300 outline-none`}
          >
            <div className="grid md:grid-cols-2 gap-8 p-6 md:p-8">
              {/* Image Gallery */}
              <div className="flex flex-col gap-4">
                <div className="relative bg-mist aspect-[4/5] rounded-lg overflow-hidden group">
                  <img
                    src={image}
                    alt={`${product.name} — ${color.name}`}
                    className="w-full h-full object-cover"
                  />

                  {/* Close button */}
                  <button
                    onClick={close}
                    className="absolute top-3 right-3 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-navy"
                    aria-label="Close modal"
                  >
                    <X size={16} className="text-navy" />
                  </button>

                  {/* Gallery Navigation */}
                  {gallery.length > 1 && (
                    <>
                      <button
                        onClick={handlePrevImage}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
                        aria-label="Previous image"
                      >
                        <ChevronLeft size={16} className="text-navy" />
                      </button>
                      <button
                        onClick={handleNextImage}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
                        aria-label="Next image"
                      >
                        <ChevronRight size={16} className="text-navy" />
                      </button>
                    </>
                  )}

                  {/* Gallery counter */}
                  {gallery.length > 1 && (
                    <div
                      className="absolute bottom-3 left-3 bg-navy/80 text-white text-xs px-2.5 py-1 rounded"
                      role="status"
                      aria-live="polite"
                    >
                      {galleryIdx + 1} / {gallery.length}
                    </div>
                  )}
                </div>

                {/* Thumbnail strip */}
                {gallery.length > 1 && (
                  <div className="flex gap-2">
                    {gallery.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setGalleryIdx(idx)}
                        className={`w-16 h-20 rounded overflow-hidden border-2 transition-all ${
                          idx === galleryIdx ? 'border-navy' : 'border-navy/20'
                        }`}
                      >
                        <img
                          src={img}
                          alt={`Product ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="flex flex-col gap-6">
                {/* Header */}
                <div>
                  <h2 className="nv-edit text-xl md:text-2xl font-semibold uppercase mb-2">
                    {product.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-medium text-navy">
                      EGP {product.price.toLocaleString()}
                    </span>
                    {product.compareAtPrice && (
                      <span className="text-sm text-navy/40 line-through">
                        EGP {product.compareAtPrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Colors */}
                {product.colors.length > 1 && (
                  <div>
                    <p className="text-sm font-semibold text-navy mb-2">Color: {color.name}</p>
                    <div className="flex items-center gap-2">
                      {product.colors.map((c, i) => (
                        <button
                          key={c.name}
                          onClick={() => {
                            setSelectedColorIdx(i);
                            setGalleryIdx(0);
                          }}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${
                            i === selectedColorIdx
                              ? 'ring-2 ring-offset-2 ring-navy'
                              : 'border-navy/20'
                          }`}
                          style={{
                            backgroundColor: c.hex,
                            borderColor: c.hex === '#FFFFFF' ? '#A7A7A7' : c.hex,
                          }}
                          title={c.name}
                          aria-label={`Select ${c.name}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Sizes */}
                <div>
                  <p className="text-sm font-semibold text-navy mb-2">
                    Size: {selectedSize || 'Select a size'}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {product.sizes.map(s => (
                      <button
                        key={s.size}
                        onClick={() => setSelectedSize(s.size)}
                        disabled={!s.inStock}
                        className={`py-2 text-xs font-semibold uppercase transition-colors ${
                          s.size === selectedSize
                            ? 'bg-navy text-white'
                            : s.inStock
                            ? 'border border-navy text-navy hover:bg-navy hover:text-white'
                            : 'border border-navy/20 text-navy/30 cursor-not-allowed'
                        }`}
                      >
                        {s.size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <p className="text-sm font-semibold text-navy mb-2">Quantity</p>
                  <div className="flex items-center border border-navy/20 w-fit">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="w-10 h-10 flex items-center justify-center hover:bg-mist"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-sm font-medium">{quantity}</span>
                    <button
                      onClick={() => setQuantity(q => q + 1)}
                      className="w-10 h-10 flex items-center justify-center hover:bg-mist"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Stock Status */}
                {selectedSize && (
                  <div
                    className={`text-xs font-medium ${
                      inStockForSize ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {inStockForSize ? '✓ In Stock' : '✗ Out of Stock'}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={handleAddToBag}
                    disabled={!selectedSize || !inStockForSize}
                    className="flex-1 bg-navy text-white nv-eyebrow py-3 hover:bg-navy-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add to Bag
                  </button>
                  <button
                    onClick={handleWishlist}
                    className="w-12 h-12 border border-navy text-navy flex items-center justify-center hover:bg-mist transition-colors"
                    aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
                  >
                    <Heart
                      size={18}
                      className={wished ? 'fill-navy text-navy' : 'text-navy'}
                      strokeWidth={1.5}
                    />
                  </button>
                </div>

                {/* View Full Details */}
                <Link
                  to={`/product/${product.slug}`}
                  onClick={close}
                  className="text-sm text-navy hover:text-navy/60 transition-colors font-medium text-center py-2 border-t border-navy/10"
                >
                  View Full Details
                </Link>

                {/* Info */}
                <div className="text-xs text-navy/50 space-y-1 pt-2 border-t border-navy/10">
                  <p>Free returns within 14 days</p>
                  <p>Cash on delivery available</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FocusTrap>
    </>
  );
}
