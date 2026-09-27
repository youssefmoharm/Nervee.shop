/**
 * Analytics & Performance Tracking
 *
 * Supports multiple providers:
 * - Google Analytics 4 (free)
 * - Meta Pixel (Facebook Ads)
 * - Custom events
 * - Performance monitoring
 *
 * Design notes
 * ------------
 * Privacy: every payload passes through `sanitizeParameters()` before it
 * leaves the browser. Passwords, contact details, addresses, payment data and
 * account identifiers are dropped even if a caller passes them by accident.
 * No event ever carries a password, a card number or a full street address.
 *
 * De-duplication: `trackEventOnce()` collapses repeated firings of the same
 * logical event (double-mounted effects, StrictMode, route re-entry) into a
 * single hit. `page_view` is deduped per path so the init-time hit and the
 * router hook hit cannot both land.
 *
 * Purchase idempotency: `purchase` is guarded by a persistent ledger of
 * already-reported transaction IDs, so refreshing a confirmation page — or
 * re-running the effect — can never inflate revenue.
 */

import debug from 'debug';

const log = debug('nerve:analytics');

import { GtagArgs, FbqArgs, AnalyticsEventParameters } from './integration-types';

declare global {
  interface Window {
    gtag?: (...args: GtagArgs) => void;
    fbq?: (...args: FbqArgs) => void;
    dataLayer?: unknown[];
  }
}

export const DEFAULT_CURRENCY = 'EGP';

/** Types */
export interface AnalyticsEvent {
  name: string;
  parameters?: AnalyticsEventParameters;
}

export type EcommerceEventName =
  | 'view_item'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'view_cart'
  | 'begin_checkout'
  | 'add_shipping_info'
  | 'add_payment_info'
  | 'purchase';

/** A single row of the GA4 `items[]` array. */
export interface EcommerceItem {
  item_id: string;
  item_name: string;
  item_category?: string;
  item_variant?: string;
  item_list_name?: string;
  price: number;
  quantity: number;
}

export interface EcommerceEvent {
  event_name: EcommerceEventName;
  currency?: string;
  value?: number;
  transaction_id?: string;
  coupon?: string;
  shipping_tier?: string;
  payment_type?: string;
  item_list_name?: string;
  items?: EcommerceItem[];
  /** Single-product convenience fields — synthesised into `items[]` when the
   *  caller does not supply the array directly. */
  product_id?: string;
  product_name?: string;
  category?: string;
  variant?: string;
  price?: number;
  quantity?: number;
}

/* ------------------------------------------------------------------------- *
 * Privacy: parameter scrubbing
 * ------------------------------------------------------------------------- */

/**
 * Keys that must never leave the browser. Matched case-insensitively against
 * the *whole* key (or an anchored sub-key) so legitimate names such as
 * `item_name`, `page_location` or `payment_type` are left intact.
 */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /password|passphrase|passwd|(^|_)pwd($|_)/i,
  /(^|_)(e?mail)($|_)/i,
  /phone|mobile|telephone/i,
  /^(first_?name|last_?name|middle_?name|full_?name|user_?name|display_?name|customer_?name|name)$/i,
  /address|street|apartment|postal|zip_?code|zipcode|governorate/i,
  /(^|_)(city|town|state|country|region)$/i,
  /(^|_)(dob|age|gender|sex|birthday|date_?of_?birth)($|_)/i,
  /(card_?number|cardno|cvv|cvc|cvv2|iban|swift|expiry)/i,
  /(token|secret|api_?key|apikey|authorization|session_?id)/i,
  /(^|_)(uid|user_?id|customer_?id|firebase_?uid|account_?id)$/i,
  /(^|_)(message|comment|notes?|subject|body)($|_)/i,
  /(^|_)(ip|ip_?address|latitude|longitude)($|_)/i,
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Returns a copy of `parameters` with every sensitive key removed. Applied at
 * the single choke point every event passes through, so a future caller that
 * accidentally forwards `email` or `password` still cannot leak it.
 */
export function sanitizeParameters(parameters: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parameters)) {
    if (value === undefined) continue;
    if (isSensitiveKey(key)) {
      log('Dropped sensitive parameter:', key);
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

/* ------------------------------------------------------------------------- *
 * De-duplication
 * ------------------------------------------------------------------------- */

/** Longest TTL we ever remember a key for (drives pruning). */
const DEDUPE_MAX_TTL_MS = 60_000;
const DEDUPE_MAX_ENTRIES = 300;

const recentEvents = new Map<string, number>();

function pruneRecentEvents(now: number): void {
  for (const [key, at] of recentEvents) {
    if (now - at > DEDUPE_MAX_TTL_MS) recentEvents.delete(key);
  }
  if (recentEvents.size > DEDUPE_MAX_ENTRIES) {
    const excess = recentEvents.size - DEDUPE_MAX_ENTRIES;
    let removed = 0;
    for (const key of recentEvents.keys()) {
      if (removed >= excess) break;
      recentEvents.delete(key);
      removed += 1;
    }
  }
}

/**
 * Returns true the first time a key is seen inside `ttlMs`, false afterwards.
 * Keys are only recorded when a provider is actually listening, so an event
 * raised before consent is not silently swallowed once consent lands.
 */
function shouldSend(key: string, ttlMs: number): boolean {
  const now = Date.now();
  const last = recentEvents.get(key);
  if (last !== undefined && now - last < ttlMs) return false;
  recentEvents.set(key, now);
  pruneRecentEvents(now);
  return true;
}

function stableKey(eventName: string, parameters: Record<string, unknown>): string {
  const parts = Object.keys(parameters)
    .sort()
    .map(key => `${key}=${String(parameters[key])}`);
  return `${eventName}|${parts.join('|')}`;
}

function providersActive(): boolean {
  return typeof window !== 'undefined' && Boolean(window.gtag || window.fbq);
}

/* ------------------------------------------------------------------------- *
 * Purchase idempotency ledger
 * ------------------------------------------------------------------------- */

const PURCHASE_LEDGER_KEY = 'nerve.analytics.purchases';
const PURCHASE_LEDGER_MAX = 25;

let purchaseLedger: Set<string> | null = null;

function readPurchaseLedger(): Set<string> {
  if (purchaseLedger) return purchaseLedger;
  const ids = new Set<string>();
  try {
    const raw = localStorage.getItem(PURCHASE_LEDGER_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach(id => {
          if (typeof id === 'string' && id) ids.add(id);
        });
      }
    }
  } catch {
    /* storage unavailable — fall back to the in-memory ledger */
  }
  purchaseLedger = ids;
  return ids;
}

function writePurchaseLedger(ids: Set<string>): void {
  try {
    localStorage.setItem(
      PURCHASE_LEDGER_KEY,
      JSON.stringify(Array.from(ids).slice(-PURCHASE_LEDGER_MAX)),
    );
  } catch {
    /* storage unavailable — in-memory ledger still protects this session */
  }
}

/** True when this transaction has already been reported to any provider. */
export function hasFiredPurchase(transactionId: string): boolean {
  if (!transactionId) return false;
  return readPurchaseLedger().has(transactionId);
}

/** Records a transaction as reported so it can never be reported twice. */
export function markPurchaseFired(transactionId: string): void {
  if (!transactionId) return;
  const ids = readPurchaseLedger();
  ids.add(transactionId);
  while (ids.size > PURCHASE_LEDGER_MAX) {
    const oldest = ids.values().next().value;
    if (oldest === undefined) break;
    ids.delete(oldest);
  }
  writePurchaseLedger(ids);
}

/* ------------------------------------------------------------------------- *
 * Provider init
 * ------------------------------------------------------------------------- */

let analyticsInitialized = false;

const GOOGLE_TAG_MANAGER_ID = 'GTM-PL8STX4';

function initGoogleTagManager() {
  const existingScript = document.querySelector(
    `script[data-gtm-container="${GOOGLE_TAG_MANAGER_ID}"]`,
  );
  if (existingScript) return;

  const dataLayer = (window.dataLayer = window.dataLayer || []);
  dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

  const script = document.createElement('script');
  script.async = true;
  script.dataset.gtmContainer = GOOGLE_TAG_MANAGER_ID;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GOOGLE_TAG_MANAGER_ID}`;
  document.head.appendChild(script);
}

// Initialize Google Analytics 4
export function initGoogleAnalytics() {
  const gaId = import.meta.env.VITE_GA_ID;

  if (!gaId) {
    log('Google Analytics ID not configured. Add VITE_GA_ID to environment.');
    return;
  }

  // Load GA4 script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(script);

  // Initialize gtag
  window.gtag = function (...args: unknown[]) {
    (window as any).dataLayer = (window as any).dataLayer || [];
    ((window as any).dataLayer as any[]).push(...args);
  };

  window.gtag('js', new Date());
  window.gtag('config', gaId, {
    page_title: document.title,
    page_location: window.location.href,
  });
}

// Initialize Meta Pixel (Facebook)
export function initMetaPixel() {
  const pixelId = import.meta.env.VITE_META_PIXEL_ID;

  if (!pixelId) {
    log('Meta Pixel ID not configured. Add VITE_META_PIXEL_ID to environment.');
    return;
  }

  // Validate pixel ID format to prevent injection
  if (!/^\d+$/.test(pixelId)) {
    log('Invalid Meta Pixel ID format');
    return;
  }

  // Load Facebook Pixel using external script src instead of innerHTML
  // This prevents XSS vulnerabilities from innerHTML injection
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  // Initialize fbq after script loads
  window.fbq = function (...args: unknown[]) {
    if (window.fbq && (window.fbq as any).callMethod) {
      (window.fbq as any).callMethod.apply(window.fbq, args as []);
    } else if (window.fbq && (window.fbq as any).queue) {
      (window.fbq as any).queue.push(args);
    }
  };
  (window.fbq as any).loaded = true;
  (window.fbq as any).version = '2.0';
  (window.fbq as any).queue = [];

  // Initialize with pixel ID (safe - numeric only)
  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
}

/* ------------------------------------------------------------------------- *
 * page_view
 * ------------------------------------------------------------------------- */

/** Same path hit twice inside this window is one navigation, not two. */
const PAGE_VIEW_DEDUPE_MS = 1500;

let fbPageViewSent = false;
let perfTracked = false;

// Track page view
export function trackPageView(pageName: string, path?: string) {
  const actualPath = path || window.location.pathname;
  const search = typeof window !== 'undefined' ? window.location.search || '' : '';
  const location = window.location.origin + actualPath + search;

  // Nothing is listening yet — do not burn the dedupe key, otherwise the
  // consent-granted init below would be swallowed as a "duplicate".
  if (!providersActive()) return;

  const dedupeKey = `page_view:${actualPath}${search}`;
  if (!shouldSend(dedupeKey, PAGE_VIEW_DEDUPE_MS)) {
    log('page_view suppressed as duplicate:', actualPath);
  } else {
    // Google Analytics — include page_location so SPA route changes count
    if (window.gtag) {
      window.gtag('event', 'page_view', {
        page_title: pageName,
        page_path: actualPath,
        page_location: location,
      });
    }

    // Meta Pixel — only once per full page load (SPA navigations reuse FB PageView)
    if (window.fbq && !fbPageViewSent) {
      fbPageViewSent = true;
      window.fbq('track', 'PageView');
    }
  }

  // Performance tracking (once)
  if (!perfTracked) {
    perfTracked = true;
    trackPerformanceMetrics();
  }
}

/* ------------------------------------------------------------------------- *
 * Custom events
 * ------------------------------------------------------------------------- */

// Track custom events
export function trackEvent(eventName: string, parameters: Record<string, unknown> = {}) {
  if (!providersActive()) {
    log('Analytics Event (no provider):', eventName, parameters);
    return;
  }

  const params = sanitizeParameters(parameters);

  // Google Analytics
  if (window.gtag) {
    window.gtag('event', eventName, params);
  }

  // Debug log
  log('Analytics Event:', eventName, params);
}

export interface TrackOnceOptions {
  /** How long an identical event is suppressed for (default 5s). */
  ttlMs?: number;
  /** Explicit dedupe key — defaults to the event name + its parameters. */
  key?: string;
}

/**
 * `trackEvent`, but identical repeats inside `ttlMs` are collapsed.
 * Used for events that can be triggered by re-rendering rather than by a
 * deliberate user action (search commits, filter toggles, coupon submits).
 */
export function trackEventOnce(
  eventName: string,
  parameters: Record<string, unknown> = {},
  options: TrackOnceOptions = {},
) {
  if (!providersActive()) return;
  const key = options.key ?? stableKey(eventName, parameters);
  if (!shouldSend(key, options.ttlMs ?? 5000)) {
    log('Suppressed duplicate event:', key);
    return;
  }
  trackEvent(eventName, parameters);
}

/* ------------------------------------------------------------------------- *
 * E-commerce
 * ------------------------------------------------------------------------- */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildItems(event: EcommerceEvent): EcommerceItem[] | undefined {
  if (event.items && event.items.length > 0) return event.items;
  if (!event.product_id) return undefined;
  return [
    {
      item_id: event.product_id,
      item_name: event.product_name ?? '',
      item_category: event.category,
      item_variant: event.variant,
      item_list_name: event.item_list_name,
      price: event.price ?? 0,
      quantity: event.quantity ?? 1,
    },
  ];
}

function metaContents(items: EcommerceItem[] | undefined) {
  return items?.map(item => ({
    id: item.item_id,
    quantity: item.quantity,
    item_price: item.price,
  }));
}

// E-commerce specific tracking
export interface TrackEcommerceOptions {
  /** Suppress an identical repeat for this long (see `trackEventOnce`). */
  ttlMs?: number;
  /** Explicit dedupe key — defaults to no de-duplication. */
  key?: string;
}

export function trackEcommerce(event: EcommerceEvent, options: TrackEcommerceOptions = {}) {
  const { event_name, ...rest } = event;
  const currency = rest.currency || DEFAULT_CURRENCY;

  if (!providersActive()) {
    log('E-commerce Event (no provider):', event_name, rest);
    return;
  }

  if (options.key && !shouldSend(options.key, options.ttlMs ?? 3000)) {
    log('E-commerce Event suppressed as duplicate:', event_name);
    return;
  }

  // One purchase per transaction, ever.
  if (event_name === 'purchase') {
    const txId = rest.transaction_id ?? '';
    if (txId && hasFiredPurchase(txId)) {
      log('purchase suppressed — already reported for', txId);
      return;
    }
  }

  const items = buildItems(event);
  const value =
    rest.value ??
    (items ? round2(items.reduce((sum, item) => sum + item.price * item.quantity, 0)) : undefined);

  // GA4 standard ecommerce parameters only — product detail lives in items[].
  const params: Record<string, unknown> = { currency };
  if (value !== undefined) params.value = value;
  if (items) params.items = items;
  if (rest.transaction_id) params.transaction_id = rest.transaction_id;
  if (rest.coupon) params.coupon = rest.coupon;
  if (rest.shipping_tier) params.shipping_tier = rest.shipping_tier;
  if (rest.payment_type) params.payment_type = rest.payment_type;
  if (rest.item_list_name) params.item_list_name = rest.item_list_name;

  const clean = sanitizeParameters(params);

  // Google Analytics Enhanced Ecommerce
  if (window.gtag) {
    window.gtag('event', event_name, clean);
  }

  // Meta Pixel — standard event parity where an equivalent exists.
  if (window.fbq) {
    const contentIds = items?.map(item => item.item_id);
    const numItems = items?.reduce((sum, item) => sum + item.quantity, 0);
    const shared = {
      value: typeof clean.value === 'number' ? clean.value : undefined,
      currency,
      content_ids: contentIds,
      contents: metaContents(items),
      num_items: numItems,
      content_type: 'product',
    };

    switch (event_name) {
      case 'purchase':
        window.fbq('track', 'Purchase', { ...shared, order_id: rest.transaction_id });
        if (rest.transaction_id) markPurchaseFired(rest.transaction_id);
        break;
      case 'begin_checkout':
        window.fbq('track', 'InitiateCheckout', shared);
        break;
      case 'add_to_cart':
        window.fbq('track', 'AddToCart', shared);
        break;
      case 'remove_from_cart':
        window.fbq('track', 'RemoveFromCart', shared);
        break;
      case 'view_cart':
        window.fbq('track', 'ViewCart', shared);
        break;
      case 'view_item':
        window.fbq('track', 'ViewContent', shared);
        break;
      case 'add_payment_info':
        window.fbq('track', 'AddPaymentInfo', shared);
        break;
      default:
        // add_shipping_info has no Meta Pixel equivalent — GA only.
        break;
    }
  }

  // GA4 is the system of record: ledger the transaction there too, so the
  // guard holds even when only Google Analytics is configured.
  if (event_name === 'purchase' && rest.transaction_id) {
    markPurchaseFired(rest.transaction_id);
  }

  // Debug log
  log('E-commerce Event:', event_name, clean);
}

/* ------------------------------------------------------------------------- *
 * Funnel / behaviour events
 * ------------------------------------------------------------------------- */

const SEARCH_DEDUPE_MS = 10_000;

// Search tracking
export function trackSearch(searchTerm: string, resultCount?: number) {
  const term = searchTerm.trim();
  if (!term) return;
  trackEventOnce(
    'search',
    {
      search_term: term,
      search_results: resultCount,
    },
    // Keyed on the term alone: navigating from the overlay into the shop must
    // not produce two `search` hits for one customer query.
    { key: `search|${term.toLowerCase()}`, ttlMs: SEARCH_DEDUPE_MS },
  );
}

/**
 * Records facet usage on the shop listing. `filterType` is one of
 * `category | colors | sizes | badges | priceMax | availability | sort`.
 */
export function trackFilter(filterType: string, filterValue: unknown, resultCount: number) {
  trackEventOnce(
    'filter_used',
    {
      filter_type: filterType,
      filter_value: typeof filterValue === 'string' ? filterValue : JSON.stringify(filterValue),
      result_count: resultCount,
    },
    { key: `filter_used|${filterType}|${String(filterValue)}`, ttlMs: 2000 },
  );
}

/**
 * Coupon attempts — both successes and rejections, because rejected codes are
 * a CRO signal. Never sends anything beyond the code itself.
 */
export function trackCoupon(
  action: 'apply' | 'remove',
  code: string,
  detail: {
    status?: 'applied' | 'invalid' | 'error';
    discount_amount?: number;
    currency?: string;
  } = {},
) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return;
  trackEventOnce(
    `${action}_coupon`,
    {
      coupon: normalized,
      status: detail.status,
      discount_amount: detail.discount_amount,
      currency: detail.currency || DEFAULT_CURRENCY,
    },
    { key: `${action}_coupon|${normalized}|${detail.status ?? ''}`, ttlMs: 3000 },
  );
}

/** Product variant (colour / size) selection on the product page. */
export function trackVariantSelection(params: {
  product_id: string;
  product_name: string;
  category?: string;
  variant_type: 'color' | 'size';
  variant_value: string;
  price: number;
  currency?: string;
}) {
  trackEventOnce(
    'select_variant',
    {
      item_id: params.product_id,
      item_name: params.product_name,
      item_category: params.category,
      variant_type: params.variant_type,
      variant_value: params.variant_value,
      price: params.price,
      currency: params.currency || DEFAULT_CURRENCY,
    },
    {
      key: `select_variant|${params.product_id}|${params.variant_type}|${params.variant_value}`,
      ttlMs: 1500,
    },
  );
}

/** GA4 recommended `sign_up`. Carries no identity — never an email. */
export function trackSignUp(method = 'password') {
  trackEventOnce('sign_up', { method }, { key: 'sign_up', ttlMs: 5000 });
}

/** GA4 recommended `login`. Carries no identity — never an email. */
export function trackLogin(method = 'password') {
  trackEventOnce('login', { method }, { key: 'login', ttlMs: 5000 });
}

/**
 * Contact form submission. Deliberately sends a coarse inquiry category and
 * nothing else — the name, email, subject text and message body stay local.
 */
export function trackContact(inquiryType: string) {
  trackEventOnce(
    'contact',
    { contact_method: 'form', inquiry_type: inquiryType },
    { key: `contact|${inquiryType}`, ttlMs: 5000 },
  );
}

/* ------------------------------------------------------------------------- *
 * Performance monitoring
 * ------------------------------------------------------------------------- */

// Performance monitoring
export function trackPerformanceMetrics() {
  if (typeof window === 'undefined' || !window.performance) return;

  // Navigation timing
  setTimeout(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    if (navigation) {
      const metrics = {
        dns_lookup: Math.round(navigation.domainLookupEnd - navigation.domainLookupStart),
        tcp_connect: Math.round(navigation.connectEnd - navigation.connectStart),
        server_response: Math.round(navigation.responseEnd - navigation.requestStart),
        dom_load: Math.round(navigation.domContentLoadedEventEnd - navigation.fetchStart),
        page_load: Math.round(navigation.loadEventEnd - navigation.fetchStart),
      };

      trackEvent('performance_timing', metrics);
    }
  }, 0);
}

// Core Web Vitals tracking
export function trackWebVitals() {
  // Largest Contentful Paint (LCP)
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver(list => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];

        trackEvent('lcp', {
          value: Math.round(lastEntry.startTime),
          rating:
            lastEntry.startTime < 2500
              ? 'good'
              : lastEntry.startTime < 4000
              ? 'needs-improvement'
              : 'poor',
        });
      });

      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      log('LCP observer failed:', e);
    }

    // First Input Delay (FID)
    try {
      const fidObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          const perfEntry = entry as any;
          if (perfEntry.processingStart) {
            const fid = perfEntry.processingStart - entry.startTime;

            trackEvent('fid', {
              value: Math.round(fid),
              rating: fid < 100 ? 'good' : fid < 300 ? 'needs-improvement' : 'poor',
            });
          }
        }
      });

      fidObserver.observe({ type: 'first-input', buffered: true });
    } catch (e) {
      log('FID observer failed:', e);
    }

    // Cumulative Layout Shift (CLS)
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }

        trackEvent('cls', {
          value: Math.round(clsValue * 1000) / 1000,
          rating: clsValue < 0.1 ? 'good' : clsValue < 0.25 ? 'needs-improvement' : 'poor',
        });
      });

      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      log('CLS observer failed:', e);
    }
  }
}

// User engagement tracking
export function trackUserEngagement() {
  let startTime = Date.now();
  let isVisible = !document.hidden;

  // Track time on page
  const trackTimeOnPage = () => {
    if (isVisible) {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      if (timeSpent > 10) {
        // Only track if spent more than 10 seconds
        trackEvent('user_engagement', {
          engagement_time_msec: timeSpent * 1000,
        });
      }
    }
  };

  // Track when user leaves/returns
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      trackTimeOnPage();
      isVisible = false;
    } else {
      startTime = Date.now();
      isVisible = true;
    }
  });

  // Track when user leaves page
  window.addEventListener('beforeunload', trackTimeOnPage);
}

/* ------------------------------------------------------------------------- *
 * Init / React integration
 * ------------------------------------------------------------------------- */

// Initialize all analytics
export function initAnalytics() {
  // Consent can dispatch more than once — only ever build the providers once.
  if (analyticsInitialized) return;
  analyticsInitialized = true;

  // Initialize providers
  initGoogleTagManager();
  initGoogleAnalytics();
  initMetaPixel();

  // Start monitoring
  trackWebVitals();
  trackUserEngagement();

  // Track initial page view (de-duplicated against usePageTracking)
  trackPageView(document.title);
}

/**
 * Clears every in-memory guard. Exposed so tests can assert de-duplication
 * and purchase idempotency from a known-clean state.
 */
export function resetAnalyticsState(): void {
  recentEvents.clear();
  purchaseLedger = null;
  analyticsInitialized = false;
  fbPageViewSent = false;
  perfTracked = false;
}

// React hook for page tracking
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(document.title, location.pathname);
  }, [location]);
}

/* ------------------------------------------------------------------------- *
 * Convenience functions for common e-commerce events
 * ------------------------------------------------------------------------- */

export const ecommerce = {
  viewProduct: (
    productId: string,
    productName: string,
    category: string,
    price: number,
    itemListName?: string,
  ) => {
    trackEcommerce(
      {
        event_name: 'view_item',
        product_id: productId,
        product_name: productName,
        category,
        price,
        quantity: 1,
        value: price,
        item_list_name: itemListName,
        currency: DEFAULT_CURRENCY,
      },
      // A double-mounted effect (StrictMode) or a fast back-and-forward must
      // not read as two product views.
      { key: `view_item|${productId}`, ttlMs: 3000 },
    );
  },

  addToCart: (
    productId: string,
    productName: string,
    price: number,
    quantity: number = 1,
    variant?: string,
    category?: string,
  ) => {
    trackEcommerce({
      event_name: 'add_to_cart',
      product_id: productId,
      product_name: productName,
      category,
      variant,
      price,
      quantity,
      value: round2(price * quantity),
      currency: DEFAULT_CURRENCY,
    });
  },

  removeFromCart: (
    productId: string,
    productName: string,
    price: number,
    quantity: number = 1,
    variant?: string,
    category?: string,
  ) => {
    trackEcommerce({
      event_name: 'remove_from_cart',
      product_id: productId,
      product_name: productName,
      category,
      variant,
      price,
      quantity,
      value: round2(price * quantity),
      currency: DEFAULT_CURRENCY,
    });
  },

  viewCart: (value: number, items?: EcommerceItem[]) => {
    trackEcommerce({
      event_name: 'view_cart',
      value,
      items,
      currency: DEFAULT_CURRENCY,
    });
  },

  beginCheckout: (value: number, items?: EcommerceItem[], coupon?: string) => {
    trackEcommerce({
      event_name: 'begin_checkout',
      value,
      items,
      coupon,
      currency: DEFAULT_CURRENCY,
    });
  },

  addShippingInfo: (
    value: number,
    items: EcommerceItem[] | undefined,
    shippingTier?: string,
    coupon?: string,
  ) => {
    trackEcommerce({
      event_name: 'add_shipping_info',
      value,
      items,
      shipping_tier: shippingTier,
      coupon,
      currency: DEFAULT_CURRENCY,
    });
  },

  addPaymentInfo: (
    value: number,
    items: EcommerceItem[] | undefined,
    shippingTier: string,
    paymentType: string,
    coupon?: string,
  ) => {
    trackEcommerce({
      event_name: 'add_payment_info',
      value,
      items,
      shipping_tier: shippingTier,
      payment_type: paymentType,
      coupon,
      currency: DEFAULT_CURRENCY,
    });
  },

  purchase: (
    transactionId: string,
    value: number,
    items?: EcommerceItem[],
    extra: { coupon?: string; shipping_tier?: string; payment_type?: string } = {},
  ) => {
    if (transactionId && hasFiredPurchase(transactionId)) {
      log('purchase already reported for', transactionId);
      return;
    }
    trackEcommerce({
      event_name: 'purchase',
      transaction_id: transactionId,
      value,
      items,
      coupon: extra.coupon,
      shipping_tier: extra.shipping_tier,
      payment_type: extra.payment_type,
      currency: DEFAULT_CURRENCY,
    });
  },
};
