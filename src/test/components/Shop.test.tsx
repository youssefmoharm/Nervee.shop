import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import Shop from '../../pages/Shop';
import { CartProvider } from '../../context/CartContext';
import { WishlistProvider } from '../../context/WishlistContext';
import { ToastProvider } from '../../context/ToastContext';
import { QuickViewProvider } from '../../context/QuickViewContext';
import { ComparisonProvider } from '../../context/ComparisonContext';
import { mockProduct } from '../utils/testHelpers';
import type { Product } from '../../types';

const listMock = vi.fn();

vi.mock('../../services/productService', () => ({
  productService: {
    list: (...args: unknown[]) => listMock(...args),
  },
}));

vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({ user: null, loading: false }),
}));

const catalog: Product[] = [
  mockProduct({
    id: 'p1',
    slug: 'aaa-core-tee',
    name: 'AAA CORE TEE',
    category: 'T-Shirts',
    price: 1000,
    colors: [{ name: 'Navy', hex: '#001f3f', image: '/n.jpg' }],
    sizes: [
      { size: 'S', inStock: true },
      { size: 'M', inStock: true },
    ],
    isBestSeller: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  }),
  mockProduct({
    id: 'p2',
    slug: 'bbb-zip-hoodie',
    name: 'BBB ZIP HOODIE',
    category: 'Hoodies',
    price: 2500,
    colors: [{ name: 'Black', hex: '#000000', image: '/b.jpg' }],
    sizes: [{ size: 'L', inStock: true }],
    isBestSeller: true,
    createdAt: '2026-03-01T00:00:00.000Z',
  }),
  mockProduct({
    id: 'p3',
    slug: 'ccc-sold-out-cap',
    name: 'CCC SOLD OUT CAP',
    category: 'Caps',
    price: 500,
    colors: [{ name: 'Navy', hex: '#001f3f', image: '/c.jpg' }],
    sizes: [{ size: 'M', inStock: false }],
    isBestSeller: false,
    createdAt: '2026-02-01T00:00:00.000Z',
  }),
];

function renderShop(initialEntry = '/shop') {
  const router = createMemoryRouter([{ path: '/shop', element: <Shop /> }], {
    initialEntries: [initialEntry],
  });
  render(
    <ToastProvider>
      <CartProvider>
        <WishlistProvider>
          <QuickViewProvider>
            <ComparisonProvider>
              <RouterProvider router={router} />
            </ComparisonProvider>
          </QuickViewProvider>
        </WishlistProvider>
      </CartProvider>
    </ToastProvider>,
  );
  return router;
}

async function loadedShop(initialEntry = '/shop') {
  const router = renderShop(initialEntry);
  await screen.findByTestId('products-grid');
  return router;
}

const cardNames = () =>
  screen
    .queryAllByTestId('product-card')
    .map(card => within(card).getByRole('heading').textContent);

const sidebar = () => screen.getByRole('complementary', { name: 'Filters' });

beforeEach(() => {
  listMock.mockReset();
  listMock.mockResolvedValue(catalog);
  sessionStorage.clear();
  localStorage.clear();
});

describe('Shop — listing and states', () => {
  it('loads the catalog and reports the result count', async () => {
    await loadedShop();
    expect(screen.getAllByTestId('product-card')).toHaveLength(3);
    expect(screen.getByText('Showing 3 of 3 products')).toBeInTheDocument();
  });

  it('shows a retryable error state when the catalog fails to load', async () => {
    listMock.mockRejectedValueOnce(new Error('network down'));
    listMock.mockResolvedValueOnce(catalog);
    const user = userEvent.setup();
    renderShop();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Failed to load products');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('products-grid')).toBeInTheDocument();
  });

  it('paginates with Load More instead of rendering the whole grid at once', async () => {
    listMock.mockResolvedValue(
      Array.from({ length: 15 }, (_, index) =>
        mockProduct({
          id: `bulk-${index}`,
          slug: `bulk-${index}`,
          name: `BULK PRODUCT ${index}`,
          price: 100 * (index + 1),
        }),
      ),
    );
    const user = userEvent.setup();
    await loadedShop();
    expect(screen.getAllByTestId('product-card')).toHaveLength(12);
    await user.click(screen.getByRole('button', { name: /Load More/ }));
    await waitFor(() => expect(screen.getAllByTestId('product-card')).toHaveLength(15));
  });
});

describe('Shop — search', () => {
  it('searches as you type and writes the query to the URL', async () => {
    const user = userEvent.setup();
    const router = await loadedShop();
    await user.type(screen.getByTestId('search-input'), 'hoodie');
    await waitFor(() => expect(router.state.location.search).toContain('q=hoodie'), {
      timeout: 3000,
    });
    await waitFor(() => expect(cardNames()).toEqual(['BBB ZIP HOODIE']));
    expect(screen.getByText('Showing 1 of 1 product')).toBeInTheDocument();
  });

  it('still finds products for a misspelled query and says so', async () => {
    const user = userEvent.setup();
    const router = await loadedShop();
    await user.type(screen.getByTestId('search-input'), 'hoddie');
    await waitFor(() => expect(cardNames()).toEqual(['BBB ZIP HOODIE']), { timeout: 3000 });
    expect(router.state.location.search).toContain('q=hoddie');
    expect(screen.getByText(/Including close matches for/)).toBeInTheDocument();
  });

  it('shows an empty state with a reset action when nothing matches', async () => {
    const user = userEvent.setup();
    const router = await loadedShop();
    await user.type(screen.getByTestId('search-input'), 'sneakers');
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument(), {
      timeout: 3000,
    });
    const empty = within(screen.getByTestId('empty-state'));
    expect(empty.getByRole('heading', { name: /No results for/ })).toBeInTheDocument();
    await user.click(empty.getByRole('button', { name: 'Clear search' }));
    await waitFor(() => expect(cardNames()).toHaveLength(3));
    expect(router.state.location.search).not.toContain('q=');
  });

  it('exposes suggestions through combobox semantics and keyboard navigation', async () => {
    const user = userEvent.setup();
    const router = await loadedShop();
    const input = screen.getByTestId('search-input');
    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveAttribute('aria-expanded', 'false');

    await user.type(input, 't');
    const listbox = await screen.findByRole('listbox');
    await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'true'));
    const options = within(listbox).getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);

    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id));

    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.search).toContain('q='));
    await waitFor(() => expect(cardNames()).toHaveLength(1));
  });

  it('restores search state from a shared URL', async () => {
    await loadedShop('/shop?q=hoodie&sort=price-desc');
    expect(screen.getByTestId('search-input')).toHaveValue('hoodie');
    expect(cardNames()).toEqual(['BBB ZIP HOODIE']);
    expect(screen.getByLabelText('Sort products')).toHaveValue('price-desc');
  });
});

describe('Shop — filters, sorting and URL state', () => {
  it('applies a category filter, then undoes and redoes it with back/forward', async () => {
    const user = userEvent.setup();
    const router = await loadedShop();
    await user.click(within(sidebar()).getByRole('button', { name: 'Hoodies' }));
    await waitFor(() => expect(router.state.location.search).toContain('category=Hoodies'));
    await waitFor(() => expect(cardNames()).toHaveLength(1));

    await router.navigate(-1);
    await waitFor(() => expect(router.state.location.search).not.toContain('category'));
    await waitFor(() => expect(cardNames()).toHaveLength(3));

    await router.navigate(1);
    await waitFor(() => expect(router.state.location.search).toContain('category=Hoodies'));
    await waitFor(() => expect(cardNames()).toHaveLength(1));
  });

  it('combines color, size and availability filters', async () => {
    const user = userEvent.setup();
    const router = await loadedShop();
    const panel = within(sidebar());

    await user.click(panel.getByRole('button', { name: 'Navy' }));
    await user.click(panel.getByRole('button', { name: /^M$/ }));
    await user.click(panel.getByRole('button', { name: 'In stock only' }));

    await waitFor(() => {
      const search = router.state.location.search;
      expect(search).toContain('colors=Navy');
      expect(search).toContain('sizes=M');
      expect(search).toContain('availability=in-stock');
    });
    // Navy + size M: the cap is sold out in M and the hoodie has neither.
    await waitFor(() => expect(cardNames()).toEqual(['AAA CORE TEE']));
    expect(screen.getByText('Showing 1 of 1 product')).toBeInTheDocument();
  });

  it('excludes sold-out products when the availability filter is on', async () => {
    const user = userEvent.setup();
    const router = await loadedShop();
    await user.click(within(sidebar()).getByRole('button', { name: 'In stock only' }));
    await waitFor(() => expect(router.state.location.search).toContain('availability=in-stock'));
    await waitFor(() => expect(cardNames()).toHaveLength(2));
    expect(cardNames()).not.toContain('CCC SOLD OUT CAP');
  });

  it('removes an active filter from its chip', async () => {
    const user = userEvent.setup();
    const router = await loadedShop();
    await user.click(within(sidebar()).getByRole('button', { name: 'Navy' }));
    await waitFor(() => expect(router.state.location.search).toContain('colors=Navy'));

    const group = screen.getByRole('group', { name: 'Active filters' });
    await user.click(within(group).getByRole('button', { name: /Remove filter: Navy/ }));
    await waitFor(() => expect(router.state.location.search).not.toContain('colors'));
    await waitFor(() => expect(cardNames()).toHaveLength(3));
  });

  it('applies a price ceiling from the slider after the user stops dragging', async () => {
    const router = await loadedShop();
    const slider = within(sidebar()).getByLabelText('Maximum price');
    fireEvent.change(slider, { target: { value: '900' } });
    await waitFor(() => expect(router.state.location.search).toContain('priceMax=900'), {
      timeout: 3000,
    });
    await waitFor(() => expect(cardNames()).toEqual(['CCC SOLD OUT CAP']));
  });

  it('clears every filter but keeps the sort preference', async () => {
    const user = userEvent.setup();
    const router = renderShop('/shop?category=Hoodies&colors=Navy&sort=price-desc');
    await screen.findByTestId('empty-state');
    expect(cardNames()).toHaveLength(0);

    const group = screen.getByRole('group', { name: 'Active filters' });
    await user.click(within(group).getByRole('button', { name: 'Clear all filters' }));
    await waitFor(() => expect(cardNames()).toHaveLength(3));
    expect(router.state.location.search).toContain('sort=price-desc');
    expect(router.state.location.search).not.toContain('category');
    expect(router.state.location.search).not.toContain('colors');
  });
});

describe('Shop — sorting', () => {
  it('offers only sorts backed by product data', async () => {
    await loadedShop();
    const labels = within(screen.getByLabelText('Sort products'))
      .getAllByRole('option')
      .map(option => option.textContent);
    expect(labels).toEqual(['Newest', 'Price: Low to High', 'Price: High to Low', 'Best Selling']);
  });

  it('sorts by price and best sellers', async () => {
    const user = userEvent.setup();
    const router = await loadedShop();
    const sortSelect = screen.getByLabelText('Sort products');

    await user.selectOptions(sortSelect, 'price-asc');
    await waitFor(() =>
      expect(cardNames()).toEqual(['CCC SOLD OUT CAP', 'AAA CORE TEE', 'BBB ZIP HOODIE']),
    );

    await user.selectOptions(sortSelect, 'price-desc');
    await waitFor(() =>
      expect(cardNames()).toEqual(['BBB ZIP HOODIE', 'AAA CORE TEE', 'CCC SOLD OUT CAP']),
    );

    await user.selectOptions(sortSelect, 'best-selling');
    await waitFor(() => expect(cardNames()[0]).toBe('BBB ZIP HOODIE'));

    await user.selectOptions(sortSelect, 'newest');
    await waitFor(() =>
      expect(cardNames()).toEqual(['BBB ZIP HOODIE', 'CCC SOLD OUT CAP', 'AAA CORE TEE']),
    );
    expect(router.state.location.search).toContain('sort=newest');
  });
});

describe('Shop — data-backed filter values', () => {
  it('offers only categories, sizes and colors the catalog contains', async () => {
    await loadedShop();
    const panel = within(sidebar());
    expect(panel.getByRole('button', { name: 'New Arrivals' })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: 'T-Shirts' })).toBeInTheDocument();
    expect(panel.queryByRole('button', { name: 'Pants' })).not.toBeInTheDocument();
    expect(panel.getByRole('button', { name: 'Navy' })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: /^M$/ })).toBeInTheDocument();
    expect(panel.queryByRole('button', { name: 'XXL' })).not.toBeInTheDocument();
  });
});

describe('Shop — mobile filter drawer', () => {
  it('opens with focus inside, closes on Escape and reports its state', async () => {
    const user = userEvent.setup();
    await loadedShop();

    const trigger = screen.getByRole('button', { name: 'Open filters' });
    const drawer = screen.getByTestId('mobile-filters');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls', 'mobile-filters-panel');
    expect(drawer).toHaveAttribute('aria-hidden', 'true');

    await user.click(trigger);
    await waitFor(() => expect(drawer).toHaveAttribute('aria-hidden', 'false'));
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close filters' })),
    );

    await user.keyboard('{Escape}');
    await waitFor(() => expect(drawer).toHaveAttribute('aria-hidden', 'true'));
  });

  it('filters from the drawer and reflects it in the grid', async () => {
    const user = userEvent.setup();
    const router = await loadedShop();
    await user.click(screen.getByRole('button', { name: 'Open filters' }));
    const drawer = within(await screen.findByTestId('mobile-filters'));
    await user.click(drawer.getByRole('button', { name: 'Hoodies' }));
    await waitFor(() => expect(router.state.location.search).toContain('category=Hoodies'));
    await waitFor(() => expect(cardNames()).toHaveLength(1));
    await user.click(drawer.getByRole('button', { name: /Show results/ }));
    await waitFor(() =>
      expect(screen.getByTestId('mobile-filters')).toHaveAttribute('aria-hidden', 'true'),
    );
  });
});
