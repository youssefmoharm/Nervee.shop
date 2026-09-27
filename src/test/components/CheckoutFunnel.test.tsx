/**
 * Funnel wiring: Checkout must report each stage of the purchase funnel
 * exactly once, with real data, and never with anything identifying.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Checkout from '../../pages/Checkout';
import { ecommerce, resetAnalyticsState } from '../../lib/analytics';

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

const cartMock = vi.hoisted(() => ({
  lines: [] as TestCartLine[],
  subtotal: 0,
  clear: (() => {}) as () => void,
  restoreLines: (() => {}) as (lines: TestCartLine[]) => void,
}));

const placeOrderMock = vi.hoisted(() => vi.fn());

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
  orderService: { placeOrder: placeOrderMock },
}));

const gtag = vi.fn();

type GtagCall = unknown[];

function events(name: string): Record<string, unknown>[] {
  return gtag.mock.calls
    .filter((c: GtagCall) => c[0] === 'event' && c[1] === name)
    .map((c: GtagCall) => c[2] as Record<string, unknown>);
}

function eventNames(): string[] {
  return gtag.mock.calls
    .filter((c: GtagCall) => c[0] === 'event')
    .map((c: GtagCall) => c[1] as string);
}

function eventParams(): Record<string, unknown>[] {
  return gtag.mock.calls
    .filter((c: GtagCall) => c[0] === 'event')
    .map(c => (c[2] ?? {}) as Record<string, unknown>);
}

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

/** Step 1 — contact details. */
async function fillStep1(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId('email-input'), 'mariam@example.com');
  await user.type(screen.getByTestId('firstName-input'), 'Mariam');
  await user.type(screen.getByTestId('lastName-input'), 'Hassan');
  await user.type(screen.getByTestId('phone-input'), '01012345678');
}

/** Step 2 — shipping address. */
async function fillStep2(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId('address-input'), '15 Road 9, Maadi');
  await user.type(screen.getByTestId('city-input'), 'Cairo');
  fireEvent.change(screen.getByTestId('governorate-select'), { target: { value: 'Cairo' } });
}

async function next(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('place-order-button'));
}

beforeEach(() => {
  gtag.mockClear();
  localStorage.clear();
  resetAnalyticsState();
  window.gtag = gtag as unknown as Window['gtag'];

  cartMock.lines = [sampleLine];
  cartMock.subtotal = 650;
  cartMock.clear = vi.fn();
  cartMock.restoreLines = vi.fn();

  placeOrderMock.mockReset();
  placeOrderMock.mockResolvedValue({
    order: {
      order_number: 'NERVE-1001',
      total: 750,
      subtotal: 650,
      shipping_cost: 100,
      discount_amount: 0,
    },
    error: null,
    details: [],
  });
});

afterEach(() => {
  delete window.gtag;
  localStorage.clear();
  resetAnalyticsState();
});

describe('Checkout purchase funnel', () => {
  it('reports each stage once, in order, with real ecommerce data', async () => {
    const user = userEvent.setup();
    renderCheckout();

    expect(eventNames()).toEqual(['begin_checkout']);
    expect(events('begin_checkout')[0]).toEqual({
      currency: 'EGP',
      value: 650,
      items: [
        {
          item_id: 'p-1',
          item_name: 'Oversized Tee',
          item_variant: 'Navy / M',
          price: 650,
          quantity: 1,
        },
      ],
    });

    await fillStep1(user);
    await next(user); // 1 → 2
    expect(eventNames()).toEqual(['begin_checkout']);

    await fillStep2(user);
    await next(user); // 2 → 3
    expect(eventNames()).toEqual(['begin_checkout', 'add_shipping_info']);

    await next(user); // 3 → 4
    expect(eventNames()).toEqual(['begin_checkout', 'add_shipping_info', 'add_payment_info']);
    expect(events('add_payment_info')[0]).toMatchObject({
      currency: 'EGP',
      shipping_tier: 'standard',
      payment_type: 'cod',
    });

    await next(user); // 4 → place order
    await screen.findByTestId('order-success');

    expect(eventNames()).toEqual([
      'begin_checkout',
      'add_shipping_info',
      'add_payment_info',
      'purchase',
    ]);

    expect(events('purchase')[0]).toMatchObject({
      transaction_id: 'NERVE-1001',
      currency: 'EGP',
      value: 750,
      shipping_tier: 'standard',
      payment_type: 'cod',
    });
    expect(events('purchase')[0].items).toEqual([
      {
        item_id: 'p-1',
        item_name: 'Oversized Tee',
        item_variant: 'Navy / M',
        price: 650,
        quantity: 1,
      },
    ]);
  });

  it('never sends a name, email, phone or address to analytics', async () => {
    const user = userEvent.setup();
    renderCheckout();

    await fillStep1(user);
    await next(user);
    await fillStep2(user);
    await next(user);
    await next(user);
    await next(user);
    await screen.findByTestId('order-success');

    const forbidden =
      /^(email|e_mail|phone|mobile|telephone|address|street|city|governorate|first_?name|last_?name|full_?name|user_?id|message|subject)$/i;

    for (const params of eventParams()) {
      const keys = Object.keys(params);
      expect(
        keys.filter(key => forbidden.test(key)),
        JSON.stringify(params),
      ).toEqual([]);
    }
  });

  it('cannot double-count a purchase', async () => {
    const user = userEvent.setup();
    renderCheckout();

    await fillStep1(user);
    await next(user);
    await fillStep2(user);
    await next(user);
    await next(user);
    await next(user);
    await screen.findByTestId('order-success');

    expect(events('purchase')).toHaveLength(1);

    // A refreshed confirmation screen re-runs the same reporting path.
    ecommerce.purchase('NERVE-1001', 750, [
      { item_id: 'p-1', item_name: 'Oversized Tee', price: 650, quantity: 1 },
    ]);

    expect(events('purchase')).toHaveLength(1);
  });

  it('fires begin_checkout when the cart arrives after mount', () => {
    cartMock.lines = [];
    cartMock.subtotal = 0;

    const view = renderCheckout();
    expect(eventNames()).toEqual([]);

    cartMock.lines = [sampleLine];
    cartMock.subtotal = 650;
    view.rerender(
      <MemoryRouter initialEntries={['/checkout']}>
        <Checkout />
      </MemoryRouter>,
    );

    expect(eventNames()).toEqual(['begin_checkout']);
    expect(events('begin_checkout')[0]).toMatchObject({ value: 650 });
  });

  it('stays quiet when no analytics provider is listening', async () => {
    delete window.gtag;
    const user = userEvent.setup();
    renderCheckout();

    await fillStep1(user);
    await next(user);
    await fillStep2(user);
    await next(user);
    await next(user);
    await next(user);
    await screen.findByTestId('order-success');

    expect(gtag).not.toHaveBeenCalled();
  });
});
