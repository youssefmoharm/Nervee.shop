import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { Product, CartLine } from '../types';
import { comparisonService } from '../services/comparisonService';
import { cartService } from '../services/cartService';

interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CompareModal({ isOpen, onClose }: ComparisonModalProps) {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setItems(comparisonService.getItems());
    }
  }, [isOpen]);

  const handleRemove = (productId: string) => {
    comparisonService.removeItem(productId);
    setItems(comparisonService.getItems());
  };

  const handleClear = () => {
    comparisonService.clear();
    setItems([]);
  };

  const handleAddToCart = async (product: Product) => {
    setLoading(true);
    const size = product.sizes?.[0]?.size || 'M';

    try {
      const cartLine: CartLine = {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        image: product.gallery?.[0] || '',
        price: product.price,
        color: product.colors?.[0]?.name || 'Default',
        size,
        quantity: 1,
      };
      await cartService.upsertLine(cartLine);
    } catch (err) {
      console.error('Error adding to cart:', err);
    }

    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-navy/10">
          <h2 className="text-2xl font-semibold">Compare Products</h2>
          <div className="flex items-center gap-4">
            {items.length > 0 && (
              <button
                onClick={handleClear}
                className="text-red-600 hover:text-red-700 flex items-center gap-2 text-sm"
              >
                <Trash2 size={16} />
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              className="text-navy/60 hover:text-navy p-2 hover:bg-navy/5 rounded-lg"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-navy/60 mb-4">No products in comparison</p>
              <button onClick={onClose} className="bg-navy text-white px-6 py-2 rounded-lg">
                Browse Products
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-navy/10">
                    <th className="py-4 text-left font-medium">Product</th>
                    {items.map(item => (
                      <th key={item.id} className="py-4 text-center">
                        <div className="relative inline-block">
                          <img
                            src={item.gallery?.[0] || ''}
                            alt={item.name || ''}
                            className="w-24 h-24 object-cover rounded-lg mb-2"
                          />
                          <button
                            onClick={() => handleRemove(item.id)}
                            className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md hover:bg-red-50"
                            aria-label="Remove from comparison"
                          >
                            <X size={12} className="text-red-600" />
                          </button>
                        </div>
                        <p className="font-medium">{item.name || ''}</p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-navy/10">
                    <td className="py-4 text-sm text-navy/60 font-medium">Price</td>
                    {items.map(item => (
                      <td key={item.id} className="py-4 text-center font-semibold">
                        {item.price / 100} EGP
                        {item.compareAtPrice && (
                          <span className="block text-sm text-navy/40 line-through">
                            {(item.compareAtPrice / 100).toFixed(2)} EGP
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-navy/10">
                    <td className="py-4 text-sm text-navy/60 font-medium">Category</td>
                    {items.map(item => (
                      <td key={item.id} className="py-4 text-center">
                        {item.category}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-navy/10">
                    <td className="py-4 text-sm text-navy/60 font-medium">Description</td>
                    {items.map(item => (
                      <td key={item.id} className="py-4 text-center text-sm text-navy/70">
                        {item.description}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-navy/10">
                    <td className="py-4 text-sm text-navy/60 font-medium">Material</td>
                    {items.map(item => (
                      <td key={item.id} className="py-4 text-center text-sm text-navy/70">
                        {item.material}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-navy/10">
                    <td className="py-4 text-sm text-navy/60 font-medium">Sizes</td>
                    {items.map(item => (
                      <td key={item.id} className="py-4 text-center">
                        <div className="flex justify-center gap-1 flex-wrap">
                          {item.sizes?.map(size => (
                            <span
                              key={size.size}
                              className={`px-2 py-1 text-xs rounded border ${
                                size.inStock
                                  ? 'border-navy text-navy'
                                  : 'border-navy/20 text-navy/40'
                              }`}
                            >
                              {size.size}
                            </span>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-6 text-sm text-navy/60 font-medium">Action</td>
                    {items.map(item => (
                      <td key={item.id} className="py-6 text-center">
                        <button
                          onClick={() => handleAddToCart(item)}
                          disabled={loading}
                          className="bg-navy text-white px-4 py-2 rounded-lg hover:bg-navy-2 transition-colors disabled:opacity-50"
                        >
                          {loading ? 'Adding...' : 'Add to Cart'}
                        </button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-navy/10 bg-navy/5 text-center text-sm text-navy/60">
          Compare up to 4 products at a time
        </div>
      </div>
    </div>
  );
}
