import { Link } from 'react-router-dom';
import { Minus, Plus, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useRef, useEffect } from 'react';

export default function CartDrawer() {
  const { lines, isOpen, closeCart, removeLine, updateQuantity, subtotal } = useCart();
  const firstItemRef = useRef<HTMLDivElement>(null);

  // Focus management: move focus to first item when drawer opens
  useEffect(() => {
    if (isOpen && firstItemRef.current) {
      firstItemRef.current.focus();
    }
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        aria-label="Close overlay"
        className={`fixed inset-0 z-[60] bg-navy/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } border-0 p-0`}
        onClick={closeCart}
      />
      <aside
        data-testid="cart-drawer"
        className={`fixed top-0 right-0 z-[70] h-full w-full sm:w-[420px] bg-white text-navy flex flex-col transition-transform duration-500 ease-[cubic-bezier(.65,0,.35,1)] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between px-6 h-16 border-b border-navy/10">
          <h2 className="nv-eyebrow">Your Bag ({lines.reduce((n, l) => n + l.quantity, 0)})</h2>
          <button
            aria-label="Close bag"
            data-testid="close-bag"
            onClick={closeCart}
            className="p-1"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto nv-scroll px-6 py-6">
          {lines.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4">
              <p className="nv-edit text-navy/50">Your bag is empty.</p>
              <Link
                to="/shop"
                onClick={closeCart}
                className="nv-eyebrow border border-navy px-6 py-3 hover:bg-navy hover:text-white transition-colors"
              >
                Shop the Drop
              </Link>
            </div>
          ) : (
            <ul className="space-y-6">
              {lines.map((line, idx) => (
                <div
                  key={`${line.productId}-${line.color}-${line.size}`}
                  data-testid="cart-item"
                  ref={idx === 0 ? firstItemRef : null}
                  tabIndex={idx === 0 ? 0 : -1}
                  className="flex gap-4"
                >
                  <Link
                    to={`/product/${line.slug}`}
                    onClick={closeCart}
                    className="w-20 h-24 bg-mist flex-shrink-0 overflow-hidden"
                  >
                    <img src={line.image} alt={line.name} className="w-full h-full object-cover" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <Link
                        to={`/product/${line.slug}`}
                        onClick={closeCart}
                        className="nv-edit text-sm font-semibold uppercase truncate"
                      >
                        {line.name}
                      </Link>
                      <button
                        aria-label="Remove item"
                        data-testid="remove-item"
                        onClick={() => removeLine(line.productId, line.color, line.size)}
                        className="text-navy/40 hover:text-navy transition-colors flex-shrink-0"
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <p className="text-xs text-navy/50 mt-1">
                      {line.color} / {line.size}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-navy/20">
                        <button
                          aria-label="Decrease quantity"
                          onClick={() =>
                            updateQuantity(line.productId, line.color, line.size, line.quantity - 1)
                          }
                          className="w-7 h-7 flex items-center justify-center hover:bg-mist transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-8 text-center text-sm">{line.quantity}</span>
                        <button
                          aria-label="Increase quantity"
                          onClick={() =>
                            updateQuantity(line.productId, line.color, line.size, line.quantity + 1)
                          }
                          className="w-7 h-7 flex items-center justify-center hover:bg-mist transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <span className="text-sm font-medium">
                        EGP {(line.price * line.quantity).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </ul>
          )}
        </div>

        {lines.length > 0 && (
          <div className="border-t border-navy/10 px-6 py-6 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-navy/60">Subtotal</span>
              <span data-testid="cart-subtotal" className="font-semibold">
                EGP {subtotal.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-navy/50">Shipping and taxes calculated at checkout.</p>
            <Link
              to="/checkout"
              onClick={closeCart}
              className="block text-center bg-navy text-white nv-eyebrow py-4 hover:bg-navy-2 transition-colors"
            >
              Checkout
            </Link>
            <Link
              to="/cart"
              onClick={closeCart}
              className="block text-center nv-eyebrow py-3 text-navy/60 hover:text-navy transition-colors"
            >
              View Bag
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
