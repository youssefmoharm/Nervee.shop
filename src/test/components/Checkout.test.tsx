import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Checkout from '../../pages/Checkout';
import { getCheckoutSummary, estimateShippingCost, EGYPT_VAT_RATE } from '../../lib/checkout';
import {
  saveCheckoutSession,
  loadCheckoutSession,
  clearCheckoutSession,
  hasValidCheckoutSession,
} from '../../lib/checkoutSessionManager';

interface TestCartLine {
  productId: string;
  name: string;
  slug: string;
  image: string;
  price: number;
  color: string;
  size: string;
  quantity: number;
}

// Mock the contexts/services Checkout consumes at render time.
const cartMock = vi.hoisted(() => ({
  lines: [] as TestCartLine[],
  subtotal: 0,
  clear: (() => {}) as () => void,
}));

vi.mock('../../context/CartContext', () => ({
  useCart: () => cartMock,
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../../services/orderService', () => ({
  orderService: { placeOrder: vi.fn() },
}));

const sampleLine: TestCartLine = {
  productId: 'p-1',
  name: 'Oversized Tee',
  slug: 'oversized-tee',
  image: '/a.jpg',
  price: 650,
  color: 'Navy',
  size: 'M',
  quantity: 1,
};

function renderCheckout() {
  return render(
    <MemoryRouter initialEntries={['/checkout']}>
      <Checkout />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  cartMock.lines = [];
  cartMock.subtotal = 0;
  cartMock.clear = vi.fn();
});

describe('Checkout page (src/pages/Checkout.tsx)', () => {
  it('shows the empty-cart state when there are no items', () => {
    renderCheckout();
    expect(screen.getByTestId('empty-cart')).toBeInTheDocument();
    expect(screen.queryByTestId('checkout-form')).not.toBeInTheDocument();
  });

  it('renders the step-1 form fields when the cart has items', () => {
    cartMock.lines = [sampleLine];
    cartMock.subtotal = 650;

    renderCheckout();
    expect(screen.getByTestId('checkout-form')).toBeInTheDocument();
    expect(screen.getByTestId('email-input')).toBeInTheDocument();
    expect(screen.getByTestId('firstName-input')).toBeInTheDocument();
    expect(screen.getByTestId('lastName-input')).toBeInTheDocument();
    expect(screen.getByTestId('phone-input')).toBeInTheDocument();
    // Address/city/governorate live on step 2 (Shipping Address)
    expect(screen.queryByTestId('address-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('city-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('governorate-select')).not.toBeInTheDocument();
  });
});

describe('getCheckoutSummary totals', () => {
  it('adds standard shipping under the free-shipping threshold', () => {
    const summary = getCheckoutSummary(500, 'standard');
    expect(summary.shipping).toBe(100);
    expect(summary.total).toBe(600);
  });

  it('gives free standard shipping over EGP 2000', () => {
    expect(estimateShippingCost(2100, 'standard')).toBe(0);
    expect(getCheckoutSummary(2100, 'standard').total).toBe(2100);
  });

  it('charges flat express shipping regardless of subtotal', () => {
    expect(getCheckoutSummary(5000, 'express').shipping).toBe(200);
  });

  it('never lets a larger discount drive the total negative', () => {
    const summary = getCheckoutSummary(500, 'standard', 10_000);
    expect(summary.total).toBe(0);
  });

  it('reports VAT as the tax portion of a VAT-inclusive subtotal', () => {
    // 1140 EGP incl. 14% VAT → exactly 140 EGP of tax
    expect(getCheckoutSummary(1140, 'standard').vatAmount).toBe(140);
    expect(getCheckoutSummary(1140, 'standard').vatAmount).toBe(
      Math.round((1140 * EGYPT_VAT_RATE) / (1 + EGYPT_VAT_RATE)),
    );
  });
});

describe('checkout session persistence (localStorage)', () => {
  it('round-trips cart lines, form state and step', () => {
    saveCheckoutSession({
      cartLines: [sampleLine] as never,
      formState: { email: 'a@b.com', firstName: 'Mariam' },
      checkoutStep: 2,
    });

    const loaded = loadCheckoutSession();
    expect(loaded).not.toBeNull();
    expect(loaded!.cartLines).toHaveLength(1);
    expect(loaded!.cartLines[0].productId).toBe('p-1');
    expect(loaded!.formState.email).toBe('a@b.com');
    expect(loaded!.checkoutStep).toBe(2);
    expect(hasValidCheckoutSession()).toBe(true);
  });

  it('treats an expired session as absent', () => {
    localStorage.setItem(
      'nerve.checkout-session',
      JSON.stringify({
        cartLines: [sampleLine],
        formState: {},
        appliedDiscount: null,
        checkoutStep: 1,
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
        expiresAt: Date.now() - 60 * 1000, // expired
      }),
    );

    expect(loadCheckoutSession()).toBeNull();
    expect(hasValidCheckoutSession()).toBe(false);
    // Expiry also clears the stale entry
    expect(localStorage.getItem('nerve.checkout-session')).toBeNull();
  });

  it('clearCheckoutSession wipes stored state', () => {
    saveCheckoutSession({ cartLines: [sampleLine] as never });
    expect(loadCheckoutSession()).not.toBeNull();

    clearCheckoutSession();
    expect(loadCheckoutSession()).toBeNull();
    expect(hasValidCheckoutSession()).toBe(false);
  });

  it('reports no valid session when storage is empty', () => {
    expect(loadCheckoutSession()).toBeNull();
    expect(hasValidCheckoutSession()).toBe(false);
  });
});
