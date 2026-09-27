/**
 * Analytics contract tests.
 *
 * Three invariants the funnel depends on:
 *  1. Nothing personally identifiable can leave the browser, even by accident.
 *  2. Repeated firings of the same logical event collapse into one hit.
 *  3. A transaction is reported exactly once, ever — including across a
 *     page refresh of the order confirmation screen.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CURRENCY,
  ecommerce,
  hasFiredPurchase,
  initAnalytics,
  resetAnalyticsState,
  sanitizeParameters,
  trackContact,
  trackCoupon,
  trackEvent,
  trackEventOnce,
  trackEcommerce,
  trackFilter,
  trackLogin,
  trackPageView,
  trackSearch,
  trackSignUp,
  trackVariantSelection,
} from '../../lib/analytics';

const gtag = vi.fn();

type GtagCall = unknown[];

function events(name: string): Record<string, unknown>[] {
  return gtag.mock.calls
    .filter((c: GtagCall) => c[0] === 'event' && c[1] === name)
    .map((c: GtagCall) => c[2] as Record<string, unknown>);
}

function allEventNames(): string[] {
  return gtag.mock.calls
    .filter((c: GtagCall) => c[0] === 'event')
    .map((c: GtagCall) => c[1] as string);
}

const items = [
  {
    item_id: 'p-1',
    item_name: 'Oversized Tee',
    item_category: 'T-Shirts',
    item_variant: 'Navy / M',
    price: 650,
    quantity: 2,
  },
];

beforeEach(() => {
  gtag.mockClear();
  localStorage.clear();
  resetAnalyticsState();
  window.gtag = gtag as unknown as Window['gtag'];
});

afterEach(() => {
  delete window.gtag;
  delete window.dataLayer;
  document.querySelectorAll('script[data-gtm-container]').forEach(script => script.remove());
  localStorage.clear();
  resetAnalyticsState();
});

describe('Google Tag Manager initialization', () => {
  it('loads the configured container once and seeds the shared data layer', () => {
    initAnalytics();
    initAnalytics();

    const scripts = document.querySelectorAll('script[data-gtm-container="GTM-PL8STX4"]');
    expect(scripts).toHaveLength(1);
    expect((scripts[0] as HTMLScriptElement).src).toBe(
      'https://www.googletagmanager.com/gtm.js?id=GTM-PL8STX4',
    );
    expect(window.dataLayer?.[0]).toMatchObject({ event: 'gtm.js' });
  });
});

describe('sanitizeParameters — PII never leaves the browser', () => {
  it('drops identity, contact, payment and free-text keys', () => {
    const clean = sanitizeParameters({
      email: 'mariam@example.com',
      password: 'hunter2',
      phone: '01012345678',
      first_name: 'Mariam',
      last_name: 'Hassan',
      full_name: 'Mariam Hassan',
      address: '15 Road 9, Maadi',
      street: 'Road 9',
      city: 'Cairo',
      governorate: 'Cairo',
      user_id: 'supabase-uid',
      card_number: '4111111111111111',
      cvv: '123',
      message: 'please deliver after 6pm',
      subject: 'Order status',
      notes: 'leave at door',
      api_key: 'sk-live-abc',
      session_id: 'sess-1',
    });

    expect(clean).toEqual({});
  });

  it('keeps legitimate ecommerce and page keys intact', () => {
    const clean = sanitizeParameters({
      item_name: 'Oversized Tee',
      item_category: 'T-Shirts',
      page_location: 'https://nerve.shop/shop?q=linen',
      page_path: '/shop',
      search_term: 'linen',
      search_results: 12,
      currency: 'EGP',
      value: 650,
      transaction_id: 'NERVE-1001',
      coupon: 'SAVE10',
      shipping_tier: 'standard',
      payment_type: 'cod',
      method: 'password',
      filter_type: 'colors',
      inquiry_type: 'order',
    });

    expect(clean).toEqual({
      item_name: 'Oversized Tee',
      item_category: 'T-Shirts',
      page_location: 'https://nerve.shop/shop?q=linen',
      page_path: '/shop',
      search_term: 'linen',
      search_results: 12,
      currency: 'EGP',
      value: 650,
      transaction_id: 'NERVE-1001',
      coupon: 'SAVE10',
      shipping_tier: 'standard',
      payment_type: 'cod',
      method: 'password',
      filter_type: 'colors',
      inquiry_type: 'order',
    });
  });

  it('scrubs a sensitive key even when a caller passes it to trackEvent', () => {
    trackEvent('sign_up', { email: 'mariam@example.com', method: 'password' });
    expect(events('sign_up')).toEqual([{ method: 'password' }]);
  });

  it('never lets an auth event carry an identity', () => {
    trackSignUp();
    trackLogin();
    expect(events('sign_up')).toEqual([{ method: 'password' }]);
    expect(events('login')).toEqual([{ method: 'password' }]);
  });

  it('sends only a coarse category from the contact form', () => {
    trackContact('order');
    expect(events('contact')).toEqual([{ contact_method: 'form', inquiry_type: 'order' }]);
  });
});

describe('de-duplication', () => {
  it('collapses identical repeats inside the TTL window', () => {
    trackEventOnce('filter_used', { filter_type: 'colors' }, { key: 'colors', ttlMs: 5000 });
    trackEventOnce('filter_used', { filter_type: 'colors' }, { key: 'colors', ttlMs: 5000 });
    expect(events('filter_used')).toHaveLength(1);
  });

  it('reports the same search term once but different terms separately', () => {
    trackSearch('linen', 5);
    trackSearch('linen', 7);
    trackSearch('denim', 3);

    const hits = events('search');
    expect(hits).toHaveLength(2);
    expect(hits[0]).toEqual({ search_term: 'linen', search_results: 5 });
    expect(hits[1]).toEqual({ search_term: 'denim', search_results: 3 });
  });

  it('ignores an empty search term', () => {
    trackSearch('   ');
    expect(events('search')).toHaveLength(0);
  });

  it('emits one filter_used per changed facet', () => {
    trackFilter('colors', 'Black', 12);
    trackFilter('colors', 'Black', 12);
    trackFilter('sizes', 'M', 12);

    const hits = events('filter_used');
    expect(hits).toHaveLength(2);
    expect(hits[0]).toEqual({ filter_type: 'colors', filter_value: 'Black', result_count: 12 });
    expect(hits[1]).toEqual({ filter_type: 'sizes', filter_value: 'M', result_count: 12 });
  });

  it('reports a variant selection only once per choice', () => {
    const params = {
      product_id: 'p-1',
      product_name: 'Oversized Tee',
      category: 'T-Shirts',
      variant_type: 'size' as const,
      variant_value: 'L',
      price: 650,
    };
    trackVariantSelection(params);
    trackVariantSelection(params);

    expect(events('select_variant')).toHaveLength(1);
    expect(events('select_variant')[0]).toMatchObject({
      item_id: 'p-1',
      variant_type: 'size',
      variant_value: 'L',
    });
  });

  it('reports a product view once even if the effect double-fires', () => {
    ecommerce.viewProduct('p-9', 'Oversized Tee', 'T-Shirts', 650);
    ecommerce.viewProduct('p-9', 'Oversized Tee', 'T-Shirts', 650);
    expect(events('view_item')).toHaveLength(1);

    ecommerce.viewProduct('p-10', 'Linen Shirt', 'Shirts', 900);
    expect(events('view_item')).toHaveLength(2);
  });

  it('distinguishes an applied coupon from a rejected one', () => {
    trackCoupon('apply', 'SAVE10', { status: 'invalid' });
    trackCoupon('apply', 'SAVE10', { status: 'invalid' });
    trackCoupon('apply', 'SAVE10', { status: 'applied', discount_amount: 200 });

    expect(events('apply_coupon')).toHaveLength(2);
    expect(events('apply_coupon')[1]).toEqual({
      coupon: 'SAVE10',
      status: 'applied',
      discount_amount: 200,
      currency: 'EGP',
    });
  });
});

describe('page_view', () => {
  it('sends one hit per path, not one per render', () => {
    window.history.pushState({}, '', '/shop');
    trackPageView('Shop', '/shop');
    trackPageView('Shop', '/shop');

    expect(events('page_view')).toHaveLength(1);
    expect(events('page_view')[0]).toMatchObject({ page_path: '/shop' });

    trackPageView('Cart', '/cart');
    expect(events('page_view')).toHaveLength(2);
  });

  it('does not burn the dedupe key before consent', () => {
    delete window.gtag;
    window.history.pushState({}, '', '/checkout');
    trackPageView('Checkout', '/checkout');

    window.gtag = gtag as unknown as Window['gtag'];
    trackPageView('Checkout', '/checkout');

    expect(events('page_view')).toHaveLength(1);
  });
});

describe('purchase idempotency', () => {
  it('reports a transaction once, ever', () => {
    ecommerce.purchase('NERVE-1001', 1300, items);

    expect(events('purchase')).toHaveLength(1);
    expect(hasFiredPurchase('NERVE-1001')).toBe(true);

    // Refreshing the confirmation screen re-runs the same code path.
    ecommerce.purchase('NERVE-1001', 1300, items);
    expect(events('purchase')).toHaveLength(1);
  });

  it('keeps the guard after an in-memory reset (page reload)', () => {
    ecommerce.purchase('NERVE-1002', 1300, items);
    expect(events('purchase')).toHaveLength(1);

    resetAnalyticsState();
    window.gtag = gtag as unknown as Window['gtag'];
    ecommerce.purchase('NERVE-1002', 1300, items);

    expect(events('purchase')).toHaveLength(1);
    expect(hasFiredPurchase('NERVE-1002')).toBe(true);
  });

  it('still reports a different transaction', () => {
    ecommerce.purchase('NERVE-1003', 500, items);
    ecommerce.purchase('NERVE-1004', 700, items);
    expect(events('purchase')).toHaveLength(2);
  });
});

describe('ecommerce payload shape', () => {
  it('sends GA4-standard begin_checkout parameters', () => {
    ecommerce.beginCheckout(1300, items, 'SAVE10');

    expect(events('begin_checkout')[0]).toEqual({
      currency: DEFAULT_CURRENCY,
      value: 1300,
      coupon: 'SAVE10',
      items,
    });
  });

  it('sends shipping tier and payment type on add_payment_info', () => {
    ecommerce.addPaymentInfo(1300, items, 'express', 'cod', 'SAVE10');

    expect(events('add_payment_info')[0]).toEqual({
      currency: DEFAULT_CURRENCY,
      value: 1300,
      shipping_tier: 'express',
      payment_type: 'cod',
      coupon: 'SAVE10',
      items,
    });
  });

  it('computes value from items when the caller does not pass one', () => {
    trackEcommerce({ event_name: 'view_cart', items });

    expect(events('view_cart')[0]).toEqual({
      currency: DEFAULT_CURRENCY,
      value: 1300,
      items,
    });
  });

  it('carries category and variant on add_to_cart', () => {
    ecommerce.addToCart('p-1', 'Oversized Tee', 650, 2, 'Navy / M', 'T-Shirts');

    expect(events('add_to_cart')[0]).toEqual({
      currency: DEFAULT_CURRENCY,
      value: 1300,
      items: [items[0]],
    });
  });

  it('sends nothing when no provider is listening', () => {
    delete window.gtag;
    ecommerce.addToCart('p-1', 'Oversized Tee', 650, 1);
    expect(gtag).not.toHaveBeenCalled();
  });
});

describe('list of every event the funnel can emit', () => {
  it('covers the required funnel events', () => {
    window.history.pushState({}, '', '/');
    trackPageView('Home', '/');
    trackSearch('linen', 4);
    trackFilter('category', 'T-Shirts', 4);
    trackVariantSelection({
      product_id: 'p-1',
      product_name: 'Oversized Tee',
      variant_type: 'color',
      variant_value: 'Navy',
      price: 650,
    });
    ecommerce.viewProduct('p-1', 'Oversized Tee', 'T-Shirts', 650, 'T-Shirts');
    ecommerce.addToCart('p-1', 'Oversized Tee', 650, 1, 'Navy / M', 'T-Shirts');
    ecommerce.viewCart(650, items);
    ecommerce.removeFromCart('p-1', 'Oversized Tee', 650, 1, 'Navy / M', 'T-Shirts');
    ecommerce.beginCheckout(650, items);
    ecommerce.addShippingInfo(650, items);
    ecommerce.addPaymentInfo(650, items, 'standard', 'cod');
    ecommerce.purchase('NERVE-2000', 750, items);
    trackCoupon('apply', 'SAVE10', { status: 'applied' });
    trackCoupon('remove', 'SAVE10', { status: 'applied' });
    trackSignUp();
    trackLogin();
    trackContact('order');

    const required = [
      'page_view',
      'search',
      'filter_used',
      'select_variant',
      'view_item',
      'add_to_cart',
      'view_cart',
      'remove_from_cart',
      'begin_checkout',
      'add_shipping_info',
      'add_payment_info',
      'purchase',
      'apply_coupon',
      'remove_coupon',
      'sign_up',
      'login',
      'contact',
    ];

    const emitted = new Set(allEventNames());
    for (const name of required) {
      expect(emitted, `missing funnel event: ${name}`).toContain(name);
    }
  });
});
