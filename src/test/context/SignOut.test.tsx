import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CartProvider, useCart } from '../../context/CartContext';
import { WishlistProvider, useWishlist } from '../../context/WishlistContext';
import { ToastProvider } from '../../context/ToastContext';
import { saveCheckoutSession, loadCheckoutSession } from '../../lib/checkoutSessionManager';
import type { CartLine, WishlistItem } from '../../types';

const authState: { user: { id: string } | null } = { user: null };

vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => authState,
}));

const dbCart: CartLine[] = [
  {
    productId: 'p1',
    name: 'Signed-in item',
    slug: 'signed-in-item',
    image: '/a.jpg',
    price: 500,
    color: 'Black',
    size: 'M',
    quantity: 2,
  },
];

const dbWishlist: WishlistItem[] = [
  { productId: 'p1', name: 'Signed-in item', slug: 'signed-in-item', image: '/a.jpg', price: 500 },
];

vi.mock('../../services/cartService', () => ({
  cartService: {
    mergeGuestCart: vi.fn().mockResolvedValue(undefined),
    fetchMine: vi.fn(async () => dbCart),
    upsertLine: vi.fn().mockResolvedValue(undefined),
    removeLine: vi.fn().mockResolvedValue(undefined),
    updateQuantity: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/wishlistService', () => ({
  wishlistService: {
    mergeGuestWishlist: vi.fn().mockResolvedValue(undefined),
    fetchMine: vi.fn(async () => dbWishlist),
    add: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}));

const Probe = () => {
  const cart = useCart();
  const wishlist = useWishlist();
  return (
    <>
      <span data-testid="cart-lines">{cart.lines.length}</span>
      <span data-testid="wishlist-items">{wishlist.items.length}</span>
    </>
  );
};

// Fresh JSX per call: passing React the same element object can bail out of
// re-rendering, which would skip the sign-out effects we want to exercise.
const ui = () => (
  <BrowserRouter>
    <ToastProvider>
      <CartProvider>
        <WishlistProvider>
          <Probe />
        </WishlistProvider>
      </CartProvider>
    </ToastProvider>
  </BrowserRouter>
);

describe('FLOW-05: sign-out clears per-user client state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    authState.user = null;
  });

  afterEach(() => cleanup());

  it('drops cart, wishlist and checkout session when the user signs out', async () => {
    authState.user = { id: 'user-a' };

    // A checkout form was filled in by user A before signing out.
    saveCheckoutSession({ cartLines: dbCart, formState: { email: 'a@example.com' } });

    const { rerender } = render(ui());

    await waitFor(() => expect(screen.getByTestId('cart-lines').textContent).toBe('1'));
    await waitFor(() => expect(screen.getByTestId('wishlist-items').textContent).toBe('1'));

    // User A signs out (AuthContext flips user to null).
    authState.user = null;
    rerender(ui());

    await waitFor(() => expect(screen.getByTestId('cart-lines').textContent).toBe('0'));
    await waitFor(() => expect(screen.getByTestId('wishlist-items').textContent).toBe('0'));
    // Storage must be emptied (the persist effect may rewrite it as `[]`).
    expect(JSON.parse(sessionStorage.getItem('nerve.cart') ?? '[]')).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem('nerve.wishlist') ?? '[]')).toHaveLength(0);
    expect(loadCheckoutSession()).toBeNull();
  });

  it('keeps a guest cart intact when mounting signed out', async () => {
    sessionStorage.setItem('nerve.cart', JSON.stringify(dbCart));
    localStorage.setItem('nerve.wishlist', JSON.stringify(dbWishlist));
    authState.user = null;

    render(ui());

    // The guard must only clear after an actual sign-in -> sign-out transition.
    await waitFor(() => expect(screen.getByTestId('cart-lines').textContent).toBe('1'));
    expect(screen.getByTestId('wishlist-items').textContent).toBe('1');
    expect(sessionStorage.getItem('nerve.cart')).not.toBeNull();
  });
});
