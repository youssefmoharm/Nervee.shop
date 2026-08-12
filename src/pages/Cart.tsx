import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Minus, Plus, ShieldCheck, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { productService } from '../services/productService';
import type { Product } from '../types';
import ProductCard from '../components/ProductCard';

export default function Cart() {
  const { lines, removeLine, updateQuantity, subtotal } = useCart();
  const [promo, setPromo] = useState('');
  const [promoStatus, setPromoStatus] = useState<'idle' | 'applied' | 'invalid'>('idle');
  const [discount, setDiscount] = useState(0);
  const [recommended, setRecommended] = useState<Product[]>([]);

  useEffect(() => {
    productService.getBestSellers().then(p => setRecommended(p.slice(0, 4)));
  }, []);

  const applyPromo = () => {
    if (promo.trim().toUpperCase() === 'NERVE10') {
      setDiscount(subtotal * 0.1);
      setPromoStatus('applied');
    } else {
      setPromoStatus('invalid');
      setDiscount(0);
    }
  };

  const shippingEstimate = subtotal > 2000 || subtotal === 0 ? 0 : 100;
  const total = subtotal - discount + shippingEstimate;

  return (
    <div className="bg-white text-navy min-h-screen pt-24 md:pt-28 px-5 md:px-8 pb-24">
      <div className="mx-auto max-w-[1600px]">
        <h1 className="nv-heading text-5xl md:text-7xl mb-10">Your Bag</h1>

        {lines.length === 0 ? (
          <div className="text-center py-24">
            <p className="nv-edit text-xl text-navy/50 mb-6">Your bag is empty.</p>
            <Link
              to="/shop"
              className="inline-block bg-navy text-white nv-eyebrow px-8 py-4 hover:bg-navy-2 transition-colors"
            >
              Shop the Drop
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 divide-y divide-navy/10 border-y border-navy/10">
              {lines.map(line => (
                <div
                  key={`${line.productId}-${line.color}-${line.size}`}
                  className="flex gap-5 py-6"
                >
                  <Link
                    to={`/product/${line.slug}`}
                    className="w-28 h-32 bg-mist flex-shrink-0 overflow-hidden"
                  >
                    <img src={line.image} alt={line.name} className="w-full h-full object-cover" />
                  </Link>
                  <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <Link
                        to={`/product/${line.slug}`}
                        className="nv-edit font-semibold uppercase"
                      >
                        {line.name}
                      </Link>
                      <p className="text-sm text-navy/50 mt-1">
                        {line.color} / {line.size}
                      </p>
                      <p className="text-sm font-medium mt-2 sm:hidden">
                        EGP {(line.price * line.quantity).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center border border-navy/20">
                        <button
                          aria-label="Decrease quantity"
                          onClick={() =>
                            updateQuantity(line.productId, line.color, line.size, line.quantity - 1)
                          }
                          className="w-8 h-8 flex items-center justify-center hover:bg-mist"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-9 text-center text-sm">{line.quantity}</span>
                        <button
                          aria-label="Increase quantity"
                          onClick={() =>
                            updateQuantity(line.productId, line.color, line.size, line.quantity + 1)
                          }
                          className="w-8 h-8 flex items-center justify-center hover:bg-mist"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <span className="hidden sm:block text-sm font-medium w-24 text-right">
                        EGP {(line.price * line.quantity).toLocaleString()}
                      </span>
                      <button
                        aria-label="Remove item"
                        onClick={() => removeLine(line.productId, line.color, line.size)}
                        className="text-navy/40 hover:text-navy transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-1">
              <div className="bg-mist/50 p-6 space-y-5">
                <h2 className="nv-eyebrow">Order Summary</h2>
                <div className="flex gap-2">
                  <input
                    value={promo}
                    onChange={e => {
                      setPromo(e.target.value);
                      setPromoStatus('idle');
                    }}
                    placeholder="Discount code"
                    data-testid="promo-input"
                    className="flex-1 border border-navy/20 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-navy"
                  />
                  <button
                    onClick={applyPromo}
                    data-testid="promo-apply"
                    className="px-4 border border-navy text-xs font-semibold uppercase hover:bg-navy hover:text-white transition-colors"
                  >
                    Apply
                  </button>
                </div>
                {promoStatus === 'applied' && (
                  <p className="text-xs text-green-700">Code NERVE10 applied — 10% off.</p>
                )}
                {promoStatus === 'invalid' && (
                  <p className="text-xs text-red-600">Invalid discount code.</p>
                )}

                <div className="space-y-2 pt-2 border-t border-navy/10 text-sm">
                  <div className="flex justify-between">
                    <span className="text-navy/60">Subtotal</span>
                    <span>EGP {subtotal.toLocaleString()}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>Discount</span>
                      <span>-EGP {discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-navy/60">Estimated Shipping</span>
                    <span>{shippingEstimate === 0 ? 'Free' : `EGP ${shippingEstimate}`}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold pt-2 border-t border-navy/10">
                    <span>Total</span>
                    <span>EGP {total.toLocaleString()}</span>
                  </div>
                </div>

                <Link
                  to="/checkout"
                  data-testid="proceed-to-checkout"
                  className="block text-center bg-navy text-white nv-eyebrow py-4 hover:bg-navy-2 transition-colors"
                >
                  Proceed to Checkout
                </Link>
                <p className="flex items-center justify-center gap-2 text-xs text-navy/50">
                  <Lock size={12} /> Secure checkout — SSL encrypted
                </p>
                <p className="flex items-center justify-center gap-2 text-xs text-navy/50">
                  <ShieldCheck size={12} /> Free returns within 14 days
                </p>
              </div>
            </div>
          </div>
        )}

        {recommended.length > 0 && (
          <div className="mt-24">
            <h2 className="nv-heading text-3xl md:text-4xl mb-8">You May Also Like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-10">
              {recommended.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
