import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import type { Product, CartLine, Size } from '../types';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';

const BUNDLE_DISCOUNT_PERCENT = 10;

interface CompleteTheLookProps {
  mainProduct: Product;
  suggestedItems: Product[];
}

export default function CompleteTheLook({ mainProduct, suggestedItems }: CompleteTheLookProps) {
  const { addLine } = useCart();
  const { showToast } = useToast();
  const [selectedItems, setSelectedItems] = useState<string[]>([mainProduct.id]);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, Size>>({});

  if (suggestedItems.length < 2) {
    return null;
  }

  const bundleItems = [mainProduct, ...suggestedItems.filter(p => selectedItems.includes(p.id))];

  const regularTotal = bundleItems.reduce((sum, p) => sum + p.price, 0);
  const discountAmount = Math.floor(regularTotal * (BUNDLE_DISCOUNT_PERCENT / 100));
  const bundlePrice = regularTotal - discountAmount;

  const handleSelectItem = (productId: string) => {
    setSelectedItems(prev => {
      if (productId === mainProduct.id) return prev;
      return prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId];
    });
  };

  const handleAddBundle = () => {
    // Check all selected items have sizes
    const missingSize = suggestedItems
      .filter(p => selectedItems.includes(p.id) && p.id !== mainProduct.id)
      .some(p => !selectedSizes[p.id]);

    if (mainProduct.sizes.some(s => s.inStock) && !selectedSizes[mainProduct.id]) {
      showToast('Please select a size for all items', 'error', 2000);
      return;
    }

    if (missingSize) {
      showToast('Please select a size for all items', 'error', 2000);
      return;
    }

    bundleItems.forEach(product => {
      const size = selectedSizes[product.id];
      if (!size) return;

      const color = product.colors[0];
      const bundleLine: CartLine = {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        image: color.image,
        price: product.price,
        color: color.name,
        size,
        quantity: 1,
      };
      addLine(bundleLine);
    });

    showToast(`Bundle added! You saved EGP ${discountAmount}`, 'success', 2000);
  };

  return (
    <div className="mt-20 pt-12 border-t border-navy/10">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <h2 className="nv-heading text-2xl md:text-3xl mb-8">Complete the Look</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Main Product */}
          <div className="space-y-3">
            <div className="aspect-[4/5] bg-mist rounded-lg overflow-hidden">
              <img
                src={mainProduct.colors[0].image}
                alt={mainProduct.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="nv-edit text-xs font-semibold uppercase">{mainProduct.name}</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="nv-edit text-sm font-bold">
                  EGP {mainProduct.price.toLocaleString()}
                </p>
              </div>
            </div>
            {mainProduct.sizes.some(s => s.inStock) && (
              <div className="mt-3">
                <label
                  htmlFor={`size-${mainProduct.id}`}
                  className="text-xs text-navy/60 mb-2 block"
                >
                  Size
                </label>
                <select
                  id={`size-${mainProduct.id}`}
                  value={selectedSizes[mainProduct.id] || ''}
                  onChange={e =>
                    setSelectedSizes(prev => ({
                      ...prev,
                      [mainProduct.id]: e.target.value as Size,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm border border-navy/20 rounded focus:outline-none focus:border-navy"
                >
                  <option value="">Select size</option>
                  {mainProduct.sizes
                    .filter(s => s.inStock)
                    .map(s => (
                      <option key={s.size} value={s.size}>
                        {s.size}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Suggested Items */}
          {suggestedItems.slice(0, 2).map(item => {
            const isSelected = selectedItems.includes(item.id);
            return (
              <div
                key={item.id}
                className="space-y-3 opacity-75 hover:opacity-100 transition-opacity"
              >
                <div className="relative">
                  <div className="aspect-[4/5] bg-mist rounded-lg overflow-hidden">
                    <img
                      src={item.colors[0].image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={() => handleSelectItem(item.id)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-navy text-white flex items-center justify-center hover:scale-110 transition-transform"
                    aria-label={isSelected ? 'Remove from bundle' : 'Add to bundle'}
                  >
                    {isSelected ? '✓' : '+'}
                  </button>
                </div>
                <div>
                  <p className="nv-edit text-xs font-semibold uppercase">{item.name}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="nv-edit text-sm font-bold">EGP {item.price.toLocaleString()}</p>
                  </div>
                </div>
                {isSelected && item.sizes.some(s => s.inStock) && (
                  <div className="mt-3">
                    <label htmlFor={`size-${item.id}`} className="text-xs text-navy/60 mb-2 block">
                      Size
                    </label>
                    <select
                      id={`size-${item.id}`}
                      value={selectedSizes[item.id] || ''}
                      onChange={e =>
                        setSelectedSizes(prev => ({
                          ...prev,
                          [item.id]: e.target.value as Size,
                        }))
                      }
                      className="w-full px-3 py-2 text-sm border border-navy/20 rounded focus:outline-none focus:border-navy"
                    >
                      <option value="">Select size</option>
                      {item.sizes
                        .filter(s => s.inStock)
                        .map(s => (
                          <option key={s.size} value={s.size}>
                            {s.size}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bundle Summary */}
        <div className="bg-navy/5 rounded-lg p-6 md:p-8 mb-8">
          <div className="max-w-md">
            <h3 className="nv-heading text-xl mb-4">Bundle Summary</h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-navy/70">Regular price:</span>
                <span className="font-semibold">EGP {regularTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600">
                <span>Save {BUNDLE_DISCOUNT_PERCENT}% on bundle:</span>
                <span className="font-semibold">- EGP {discountAmount.toLocaleString()}</span>
              </div>
              <div className="border-t border-navy/10 pt-3 flex justify-between">
                <span className="font-semibold">Bundle Price:</span>
                <span className="nv-heading text-xl">EGP {bundlePrice.toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={handleAddBundle}
              disabled={!Object.values(selectedSizes).every(Boolean)}
              className="w-full bg-navy text-white nv-eyebrow py-3 rounded-lg hover:bg-navy-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <ShoppingBag size={18} />
              Add Bundle to Bag
            </button>
            <p className="text-xs text-navy/50 mt-3 text-center">
              Free shipping on orders over EGP 500
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
