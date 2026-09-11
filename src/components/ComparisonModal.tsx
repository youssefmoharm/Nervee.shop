import { useEffect } from 'react';
import FocusTrap from 'focus-trap-react';
import { X } from 'lucide-react';
import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import Button from './Button';

interface ComparisonModalProps {
  products: Product[];
  onClose: () => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
}

export default function ComparisonModal({
  products,
  onClose,
  onRemove,
  onClear,
}: ComparisonModalProps) {
  const { addLine } = useCart();
  const { showToast } = useToast();

  // Escape key handler - must be before early return
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (products.length === 0) {
    return null;
  }

  const handleAddToCart = (product: Product) => {
    const defaultSize = product.sizes.find(s => s.inStock)?.size;
    const defaultColor = product.colors[0];

    if (!defaultSize) {
      showToast('Product out of stock', 'error', 3000);
      return;
    }

    addLine({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      image: defaultColor.image,
      price: product.price,
      color: defaultColor.name,
      size: defaultSize,
      quantity: 1,
    });

    showToast(`Added ${product.name} to bag`, 'success', 3000);
  };

  return (
    <FocusTrap active={products.length > 0} onClickOutside={onClose}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-modal-title"
        aria-hidden="false"
      >
        <div
          className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col outline-none"
          role="document"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-navy/10">
            <h2 id="compare-modal-title" className="text-xl md:text-2xl font-bold text-navy">
              Compare Products ({products.length}/3)
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-navy/10 rounded-full transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-navy"
              aria-label="Close modal"
            >
              <X size={24} />
            </button>
          </div>

          {/* Scrollable comparison table */}
          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full border-collapse text-sm md:text-base">
              <tbody>
                {/* Product images row */}
                <tr className="border-b border-navy/10">
                  <th className="bg-mist text-left p-3 md:p-4 font-semibold text-navy min-w-[120px] sticky left-0 z-10">
                    Product
                  </th>
                  {products.map(product => (
                    <td key={product.id} className="p-3 md:p-4 text-center min-w-[200px]">
                      <div className="space-y-2">
                        <img
                          src={product.colors[0].image}
                          alt={product.name}
                          className="w-full aspect-[4/5] object-cover rounded-lg"
                        />
                        <p className="font-semibold text-navy">{product.name}</p>
                        <button
                          onClick={() => onRemove(product.id)}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Price row */}
                <tr className="border-b border-navy/10 hover:bg-mist/50">
                  <th className="bg-mist text-left p-3 md:p-4 font-semibold text-navy sticky left-0 z-10">
                    Price
                  </th>
                  {products.map(product => (
                    <td key={`${product.id}-price`} className="p-3 md:p-4 text-center">
                      <span className="font-bold text-navy">
                        EGP {product.price.toLocaleString()}
                      </span>
                      {product.compareAtPrice && (
                        <div className="text-xs text-navy/60 line-through">
                          EGP {product.compareAtPrice.toLocaleString()}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Colors row */}
                <tr className="border-b border-navy/10 hover:bg-mist/50">
                  <th className="bg-mist text-left p-3 md:p-4 font-semibold text-navy sticky left-0 z-10">
                    Colors
                  </th>
                  {products.map(product => (
                    <td key={`${product.id}-colors`} className="p-3 md:p-4 text-center">
                      <div className="flex flex-wrap gap-2 justify-center">
                        {product.colors.map(color => (
                          <div
                            key={color.name}
                            className="flex items-center gap-1 text-xs"
                            title={color.name}
                          >
                            <div
                              className="w-5 h-5 rounded-full border border-navy/20"
                              style={{
                                backgroundColor: color.hex,
                                borderColor: color.hex === '#FFFFFF' ? '#A7A7A7' : color.hex,
                              }}
                            />
                            <span className="hidden md:inline">{color.name}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Sizes row */}
                <tr className="border-b border-navy/10 hover:bg-mist/50">
                  <th className="bg-mist text-left p-3 md:p-4 font-semibold text-navy sticky left-0 z-10">
                    Sizes
                  </th>
                  {products.map(product => (
                    <td key={`${product.id}-sizes`} className="p-3 md:p-4 text-center">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {product.sizes.map(size => (
                          <span
                            key={size.size}
                            className={`px-2 py-1 text-xs font-medium rounded border ${
                              size.inStock
                                ? 'bg-white border-navy text-navy'
                                : 'bg-navy/5 border-navy/20 text-navy/40 line-through'
                            }`}
                          >
                            {size.size}
                          </span>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Material row */}
                <tr className="border-b border-navy/10 hover:bg-mist/50">
                  <th className="bg-mist text-left p-3 md:p-4 font-semibold text-navy sticky left-0 z-10">
                    Material
                  </th>
                  {products.map(product => (
                    <td key={`${product.id}-material`} className="p-3 md:p-4 text-center">
                      <p className="text-navy">{product.material}</p>
                    </td>
                  ))}
                </tr>

                {/* Care Instructions row */}
                <tr className="border-b border-navy/10 hover:bg-mist/50">
                  <th className="bg-mist text-left p-3 md:p-4 font-semibold text-navy sticky left-0 z-10">
                    Care
                  </th>
                  {products.map(product => (
                    <td key={`${product.id}-care`} className="p-3 md:p-4 text-center">
                      <ul className="text-xs md:text-sm text-navy space-y-1">
                        {product.care.map((instruction, i) => (
                          <li key={i}>• {instruction}</li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </tr>

                {/* Badge row */}
                <tr className="border-b border-navy/10 hover:bg-mist/50">
                  <th className="bg-mist text-left p-3 md:p-4 font-semibold text-navy sticky left-0 z-10">
                    Badge
                  </th>
                  {products.map(product => (
                    <td key={`${product.id}-badge`} className="p-3 md:p-4 text-center">
                      {product.badge ? (
                        <span className="inline-block bg-navy text-white text-xs font-semibold tracking-widest px-2 py-1 rounded">
                          {product.badge}
                        </span>
                      ) : (
                        <span className="text-navy/40">—</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Add to Cart row */}
                <tr className="bg-mist">
                  <th className="bg-mist text-left p-3 md:p-4 font-semibold text-navy sticky left-0 z-10">
                    Action
                  </th>
                  {products.map(product => (
                    <td key={`${product.id}-action`} className="p-3 md:p-4 text-center">
                      <button
                        onClick={() => handleAddToCart(product)}
                        className="w-full bg-navy text-white text-xs md:text-sm font-semibold py-2 rounded hover:bg-navy-2 transition-colors"
                      >
                        Add to Bag
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex gap-2 p-4 md:p-6 border-t border-navy/10">
            <Button onClick={onClear} variant="outline" className="flex-1">
              Clear All
            </Button>
            <Button onClick={onClose} className="flex-1">
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}
