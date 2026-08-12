import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { CartProvider, useCart } from '../../context/CartContext';
import { AuthProvider } from '../../context/AuthContext';
import type { CartLine } from '../../types';

// Mock cartService
vi.mock('../../services/cartService', () => ({
  cartService: {
    mergeGuestCart: vi.fn().mockResolvedValue(undefined),
    fetchMine: vi.fn().mockResolvedValue([]),
    upsertLine: vi.fn().mockResolvedValue(undefined),
    removeLine: vi.fn().mockResolvedValue(undefined),
    updateQuantity: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock AuthContext
vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: null,
    loading: false,
  }),
}));

// Test component that uses cart
const CartTestComponent = () => {
  const cart = useCart();

  const testProduct: CartLine = {
    productId: 'product-1',
    name: 'Test Product',
    slug: 'test-product',
    image: '/test.jpg',
    price: 299.99,
    color: 'Black',
    size: 'M',
    quantity: 1,
  };

  return (
    <div data-testid="cart-test">
      <div data-testid="cart-count">{cart.count}</div>
      <div data-testid="cart-subtotal">{cart.subtotal}</div>
      <div data-testid="cart-items">{cart.lines.length}</div>
      <div data-testid="cart-open">{cart.isOpen ? 'open' : 'closed'}</div>

      <button data-testid="add-item" onClick={() => cart.addLine(testProduct)}>
        Add Item
      </button>

      <button data-testid="remove-item" onClick={() => cart.removeLine('product-1', 'Black', 'M')}>
        Remove Item
      </button>

      <button
        data-testid="update-quantity"
        onClick={() => cart.updateQuantity('product-1', 'Black', 'M', 3)}
      >
        Update Quantity
      </button>

      <button data-testid="clear-cart" onClick={() => cart.clear()}>
        Clear Cart
      </button>

      <button data-testid="open-cart" onClick={() => cart.openCart()}>
        Open Cart
      </button>

      <button data-testid="close-cart" onClick={() => cart.closeCart()}>
        Close Cart
      </button>

      {cart.lastAdded && (
        <div data-testid="last-added">
          {cart.lastAdded.name} - {cart.lastAdded.color} - {cart.lastAdded.size}
        </div>
      )}

      <div data-testid="cart-lines">
        {cart.lines.map((line, index) => (
          <div key={index} data-testid={`line-${index}`}>
            {line.name} - {line.color} - {line.size} - Qty: {line.quantity} - Price: {line.price}
          </div>
        ))}
      </div>
    </div>
  );
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe('Cart Context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  describe('Initial State', () => {
    it('starts with empty cart', () => {
      render(
        <TestWrapper>
          <CartTestComponent />
        </TestWrapper>,
      );

      expect(screen.getByTestId('cart-count')).toHaveTextContent('0');
      expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('0');
      expect(screen.getByTestId('cart-items')).toHaveTextContent('0');
      expect(screen.getByTestId('cart-open')).toHaveTextContent('closed');
    });

    it('loads cart from sessionStorage', () => {
      const storedCart: CartLine[] = [
        {
          productId: 'stored-product',
          name: 'Stored Product',
          slug: 'stored-product',
          image: '/stored.jpg',
          price: 199.99,
          color: 'Red',
          size: 'L',
          quantity: 2,
        },
      ];
      sessionStorage.setItem('nerve.cart', JSON.stringify(storedCart));

      render(
        <TestWrapper>
          <CartTestComponent />
        </TestWrapper>,
      );

      expect(screen.getByTestId('cart-count')).toHaveTextContent('2');
      expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('399.98');
      expect(screen.getByTestId('cart-items')).toHaveTextContent('1');
    });
  });

  describe('Adding Items', () => {
    it('adds new item to cart', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <CartTestComponent />
        </TestWrapper>,
      );

      await user.click(screen.getByTestId('add-item'));

      expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
      expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('299.99');
      expect(screen.getByTestId('cart-items')).toHaveTextContent('1');
      expect(screen.getByTestId('cart-open')).toHaveTextContent('open');
      expect(screen.getByTestId('last-added')).toHaveTextContent('Test Product - Black - M');
    });

    it('increases quantity when adding same item', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <CartTestComponent />
        </TestWrapper>,
      );

      await user.click(screen.getByTestId('add-item'));
      await user.click(screen.getByTestId('add-item'));

      expect(screen.getByTestId('cart-count')).toHaveTextContent('2');
      expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('599.98');
      expect(screen.getByTestId('cart-items')).toHaveTextContent('1');
      expect(screen.getByTestId('line-0')).toHaveTextContent('Qty: 2');
    });

    it('adds different variants as separate lines', async () => {
      const user = userEvent.setup();

      const CartWithVariants = () => {
        const cart = useCart();

        const product1: CartLine = {
          productId: 'product-1',
          name: 'Test Product',
          slug: 'test-product',
          image: '/test.jpg',
          price: 299.99,
          color: 'Black',
          size: 'M',
          quantity: 1,
        };

        const product2: CartLine = {
          productId: 'product-1',
          name: 'Test Product',
          slug: 'test-product',
          image: '/test.jpg',
          price: 299.99,
          color: 'Red',
          size: 'M',
          quantity: 1,
        };

        return (
          <div>
            <div data-testid="cart-items">{cart.lines.length}</div>
            <div data-testid="cart-count">{cart.count}</div>
            <button onClick={() => cart.addLine(product1)}>Add Black M</button>
            <button onClick={() => cart.addLine(product2)}>Add Red M</button>
          </div>
        );
      };

      render(
        <TestWrapper>
          <CartWithVariants />
        </TestWrapper>,
      );

      await user.click(screen.getByRole('button', { name: 'Add Black M' }));
      await user.click(screen.getByRole('button', { name: 'Add Red M' }));

      expect(screen.getByTestId('cart-items')).toHaveTextContent('2');
      expect(screen.getByTestId('cart-count')).toHaveTextContent('2');
    });
  });

  describe('Removing Items', () => {
    it('removes specific item from cart', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <CartTestComponent />
        </TestWrapper>,
      );

      await user.click(screen.getByTestId('add-item'));
      expect(screen.getByTestId('cart-items')).toHaveTextContent('1');

      await user.click(screen.getByTestId('remove-item'));
      expect(screen.getByTestId('cart-items')).toHaveTextContent('0');
      expect(screen.getByTestId('cart-count')).toHaveTextContent('0');
      expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('0');
    });

    it('removes only matching variant', async () => {
      const user = userEvent.setup();

      const CartWithVariants = () => {
        const cart = useCart();

        const product1: CartLine = {
          productId: 'product-1',
          name: 'Test Product',
          slug: 'test-product',
          image: '/test.jpg',
          price: 299.99,
          color: 'Black',
          size: 'M',
          quantity: 1,
        };

        const product2: CartLine = {
          productId: 'product-1',
          name: 'Test Product',
          slug: 'test-product',
          image: '/test.jpg',
          price: 299.99,
          color: 'Red',
          size: 'M',
          quantity: 1,
        };

        return (
          <div>
            <div data-testid="cart-items">{cart.lines.length}</div>
            <button onClick={() => cart.addLine(product1)}>Add Black M</button>
            <button onClick={() => cart.addLine(product2)}>Add Red M</button>
            <button onClick={() => cart.removeLine('product-1', 'Black', 'M')}>
              Remove Black M
            </button>
          </div>
        );
      };

      render(
        <TestWrapper>
          <CartWithVariants />
        </TestWrapper>,
      );

      await user.click(screen.getByRole('button', { name: 'Add Black M' }));
      await user.click(screen.getByRole('button', { name: 'Add Red M' }));
      expect(screen.getByTestId('cart-items')).toHaveTextContent('2');

      await user.click(screen.getByRole('button', { name: 'Remove Black M' }));
      expect(screen.getByTestId('cart-items')).toHaveTextContent('1');
    });
  });

  describe('Updating Quantities', () => {
    it('updates item quantity', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <CartTestComponent />
        </TestWrapper>,
      );

      await user.click(screen.getByTestId('add-item'));
      expect(screen.getByTestId('cart-count')).toHaveTextContent('1');

      await user.click(screen.getByTestId('update-quantity'));
      expect(screen.getByTestId('cart-count')).toHaveTextContent('3');
      expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('899.97');
    });

    it('enforces minimum quantity of 1', async () => {
      const user = userEvent.setup();

      const CartWithNegativeQuantity = () => {
        const cart = useCart();

        const product: CartLine = {
          productId: 'product-1',
          name: 'Test Product',
          slug: 'test-product',
          image: '/test.jpg',
          price: 299.99,
          color: 'Black',
          size: 'M',
          quantity: 1,
        };

        return (
          <div>
            <div data-testid="cart-count">{cart.count}</div>
            <button onClick={() => cart.addLine(product)}>Add Item</button>
            <button onClick={() => cart.updateQuantity('product-1', 'Black', 'M', -5)}>
              Set Negative
            </button>
            <button onClick={() => cart.updateQuantity('product-1', 'Black', 'M', 0)}>
              Set Zero
            </button>
          </div>
        );
      };

      render(
        <TestWrapper>
          <CartWithNegativeQuantity />
        </TestWrapper>,
      );

      await user.click(screen.getByRole('button', { name: 'Add Item' }));
      expect(screen.getByTestId('cart-count')).toHaveTextContent('1');

      await user.click(screen.getByRole('button', { name: 'Set Negative' }));
      expect(screen.getByTestId('cart-count')).toHaveTextContent('1');

      await user.click(screen.getByRole('button', { name: 'Set Zero' }));
      expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
    });
  });

  describe('Cart State Management', () => {
    it('opens and closes cart', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <CartTestComponent />
        </TestWrapper>,
      );

      expect(screen.getByTestId('cart-open')).toHaveTextContent('closed');

      await user.click(screen.getByTestId('open-cart'));
      expect(screen.getByTestId('cart-open')).toHaveTextContent('open');

      await user.click(screen.getByTestId('close-cart'));
      expect(screen.getByTestId('cart-open')).toHaveTextContent('closed');
    });

    it('opens cart automatically when item added', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <CartTestComponent />
        </TestWrapper>,
      );

      expect(screen.getByTestId('cart-open')).toHaveTextContent('closed');

      await user.click(screen.getByTestId('add-item'));
      expect(screen.getByTestId('cart-open')).toHaveTextContent('open');
    });

    it('clears cart completely', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <CartTestComponent />
        </TestWrapper>,
      );

      await user.click(screen.getByTestId('add-item'));
      await user.click(screen.getByTestId('add-item'));
      expect(screen.getByTestId('cart-count')).toHaveTextContent('2');

      await user.click(screen.getByTestId('clear-cart'));
      expect(screen.getByTestId('cart-count')).toHaveTextContent('0');
      expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('0');
      expect(screen.getByTestId('cart-items')).toHaveTextContent('0');
    });
  });

  describe('Calculations', () => {
    it('calculates subtotal correctly', async () => {
      const user = userEvent.setup();

      const CartWithMultipleItems = () => {
        const cart = useCart();

        const product1: CartLine = {
          productId: 'product-1',
          name: 'Product 1',
          slug: 'product-1',
          image: '/test1.jpg',
          price: 100.0,
          color: 'Black',
          size: 'M',
          quantity: 2,
        };

        const product2: CartLine = {
          productId: 'product-2',
          name: 'Product 2',
          slug: 'product-2',
          image: '/test2.jpg',
          price: 150.5,
          color: 'Red',
          size: 'L',
          quantity: 1,
        };

        return (
          <div>
            <div data-testid="cart-subtotal">{cart.subtotal}</div>
            <button onClick={() => cart.addLine(product1)}>Add Product 1</button>
            <button onClick={() => cart.addLine(product2)}>Add Product 2</button>
          </div>
        );
      };

      render(
        <TestWrapper>
          <CartWithMultipleItems />
        </TestWrapper>,
      );

      await user.click(screen.getByRole('button', { name: 'Add Product 1' }));
      expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('200');

      await user.click(screen.getByRole('button', { name: 'Add Product 2' }));
      expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('350.5');
    });

    it('calculates item count correctly', async () => {
      const user = userEvent.setup();

      const CartWithVaryingQuantities = () => {
        const cart = useCart();

        const product1: CartLine = {
          productId: 'product-1',
          name: 'Product 1',
          slug: 'product-1',
          image: '/test1.jpg',
          price: 100.0,
          color: 'Black',
          size: 'M',
          quantity: 3,
        };

        const product2: CartLine = {
          productId: 'product-2',
          name: 'Product 2',
          slug: 'product-2',
          image: '/test2.jpg',
          price: 150.5,
          color: 'Red',
          size: 'L',
          quantity: 2,
        };

        return (
          <div>
            <div data-testid="cart-count">{cart.count}</div>
            <button onClick={() => cart.addLine(product1)}>Add Product 1 (qty 3)</button>
            <button onClick={() => cart.addLine(product2)}>Add Product 2 (qty 2)</button>
          </div>
        );
      };

      render(
        <TestWrapper>
          <CartWithVaryingQuantities />
        </TestWrapper>,
      );

      await user.click(screen.getByRole('button', { name: 'Add Product 1 (qty 3)' }));
      expect(screen.getByTestId('cart-count')).toHaveTextContent('3');

      await user.click(screen.getByRole('button', { name: 'Add Product 2 (qty 2)' }));
      expect(screen.getByTestId('cart-count')).toHaveTextContent('5');
    });
  });

  describe('SessionStorage Integration', () => {
    it('persists cart to sessionStorage for guest users', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <CartTestComponent />
        </TestWrapper>,
      );

      await user.click(screen.getByTestId('add-item'));

      const storedCart = JSON.parse(sessionStorage.getItem('nerve.cart') || '[]');
      expect(storedCart).toHaveLength(1);
      expect(storedCart[0]).toMatchObject({
        productId: 'product-1',
        name: 'Test Product',
        color: 'Black',
        size: 'M',
        quantity: 1,
      });
    });

    it('handles storage errors gracefully', async () => {
      const user = userEvent.setup();

      // Mock sessionStorage to throw an error
      const originalSetItem = sessionStorage.setItem;
      sessionStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error('Storage full');
      });

      render(
        <TestWrapper>
          <CartTestComponent />
        </TestWrapper>,
      );

      // Should not throw error even if storage fails
      await user.click(screen.getByTestId('add-item'));
      expect(screen.getByTestId('cart-count')).toHaveTextContent('1');

      // Restore original implementation
      sessionStorage.setItem = originalSetItem;
    });

    it('handles corrupted sessionStorage data gracefully', () => {
      sessionStorage.setItem('nerve.cart', 'invalid-json');

      render(
        <TestWrapper>
          <CartTestComponent />
        </TestWrapper>,
      );

      // Should start with empty cart despite corrupted data
      expect(screen.getByTestId('cart-count')).toHaveTextContent('0');
      expect(screen.getByTestId('cart-items')).toHaveTextContent('0');
    });
  });

  describe('Error Handling', () => {
    it('handles missing context gracefully', () => {
      const CartWithoutProvider = () => {
        try {
          useCart();
          return <div>Should not render</div>;
        } catch (error) {
          return <div data-testid="error">Context error caught</div>;
        }
      };

      render(<CartWithoutProvider />);
      expect(screen.getByTestId('error')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles decimal prices correctly', async () => {
      const user = userEvent.setup();

      const CartWithDecimalPrices = () => {
        const cart = useCart();

        const product: CartLine = {
          productId: 'product-1',
          name: 'Decimal Product',
          slug: 'decimal-product',
          image: '/test.jpg',
          price: 99.99,
          color: 'Black',
          size: 'M',
          quantity: 3,
        };

        return (
          <div>
            <div data-testid="cart-subtotal">{cart.subtotal}</div>
            <button onClick={() => cart.addLine(product)}>Add Decimal Product</button>
          </div>
        );
      };

      render(
        <TestWrapper>
          <CartWithDecimalPrices />
        </TestWrapper>,
      );

      await user.click(screen.getByRole('button', { name: 'Add Decimal Product' }));
      expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('299.97');
    });

    it('handles zero price items', async () => {
      const user = userEvent.setup();

      const CartWithFreeItem = () => {
        const cart = useCart();

        const freeProduct: CartLine = {
          productId: 'free-product',
          name: 'Free Product',
          slug: 'free-product',
          image: '/free.jpg',
          price: 0,
          color: 'Black',
          size: 'M',
          quantity: 1,
        };

        return (
          <div>
            <div data-testid="cart-subtotal">{cart.subtotal}</div>
            <div data-testid="cart-count">{cart.count}</div>
            <button onClick={() => cart.addLine(freeProduct)}>Add Free Item</button>
          </div>
        );
      };

      render(
        <TestWrapper>
          <CartWithFreeItem />
        </TestWrapper>,
      );

      await user.click(screen.getByRole('button', { name: 'Add Free Item' }));
      expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('0');
      expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
    });

    it('handles very large quantities', async () => {
      const user = userEvent.setup();

      const CartWithLargeQuantity = () => {
        const cart = useCart();

        const product: CartLine = {
          productId: 'product-1',
          name: 'Test Product',
          slug: 'test-product',
          image: '/test.jpg',
          price: 10.0,
          color: 'Black',
          size: 'M',
          quantity: 1000,
        };

        return (
          <div>
            <div data-testid="cart-count">{cart.count}</div>
            <div data-testid="cart-subtotal">{cart.subtotal}</div>
            <button onClick={() => cart.addLine(product)}>Add Large Quantity</button>
          </div>
        );
      };

      render(
        <TestWrapper>
          <CartWithLargeQuantity />
        </TestWrapper>,
      );

      await user.click(screen.getByRole('button', { name: 'Add Large Quantity' }));
      expect(screen.getByTestId('cart-count')).toHaveTextContent('1000');
      expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('10000');
    });
  });
});
