/**
 * Analytics & Performance Tracking
 *
 * Supports multiple providers:
 * - Google Analytics 4 (free)
 * - Meta Pixel (Facebook Ads)
 * - Custom events
 * - Performance monitoring
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
  }
}

// Types
export interface AnalyticsEvent {
  name: string;
  parameters?: Record<string, any>;
}

export interface EcommerceEvent {
  event_name:
    | 'view_item'
    | 'add_to_cart'
    | 'remove_from_cart'
    | 'view_cart'
    | 'begin_checkout'
    | 'purchase';
  product_id?: string;
  product_name?: string;
  category?: string;
  price?: number;
  quantity?: number;
  currency?: string;
  value?: number;
  transaction_id?: string;
}

// Initialize Google Analytics 4
export function initGoogleAnalytics() {
  const gaId = import.meta.env.VITE_GA_ID;

  if (!gaId) {
    console.warn('Google Analytics ID not configured. Add VITE_GA_ID to environment.');
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
    console.warn('Meta Pixel ID not configured. Add VITE_META_PIXEL_ID to environment.');
    return;
  }

  // Validate pixel ID format to prevent injection
  if (!/^\d+$/.test(pixelId)) {
    console.error('Invalid Meta Pixel ID format');
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

// Track page view
export function trackPageView(pageName: string, path?: string) {
  const actualPath = path || window.location.pathname;

  // Google Analytics
  if (window.gtag) {
    window.gtag('event', 'page_view', {
      page_title: pageName,
      page_path: actualPath,
    });
  }

  // Meta Pixel
  if (window.fbq) {
    window.fbq('track', 'PageView');
  }

  // Performance tracking
  trackPerformanceMetrics();
}

// Track custom events
export function trackEvent(eventName: string, parameters: Record<string, any> = {}) {
  // Google Analytics
  if (window.gtag) {
    window.gtag('event', eventName, parameters);
  }

  // Console log in development
  if (import.meta.env.DEV) {
    console.log('📊 Analytics Event:', eventName, parameters);
  }
}

// E-commerce specific tracking
export function trackEcommerce(event: EcommerceEvent) {
  const { event_name, ...parameters } = event;

  // Google Analytics Enhanced Ecommerce
  if (window.gtag) {
    window.gtag('event', event_name, {
      currency: 'EGP',
      ...parameters,
    });
  }

  // Meta Pixel
  if (window.fbq && event_name === 'purchase') {
    window.fbq('track', 'Purchase', {
      value: parameters.value,
      currency: 'EGP',
    });
  }

  // Console in development
  if (import.meta.env.DEV) {
    console.log('🛒 E-commerce Event:', event_name, parameters);
  }
}

// Search tracking
export function trackSearch(searchTerm: string, resultCount?: number) {
  trackEvent('search', {
    search_term: searchTerm,
    search_results: resultCount,
  });
}

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
      console.warn('LCP observer failed:', e);
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
      console.warn('FID observer failed:', e);
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
      console.warn('CLS observer failed:', e);
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

// Initialize all analytics
export function initAnalytics() {
  // Initialize providers
  initGoogleAnalytics();
  initMetaPixel();

  // Start monitoring
  trackWebVitals();
  trackUserEngagement();

  // Track initial page view
  trackPageView(document.title);
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

// Convenience functions for common e-commerce events
export const ecommerce = {
  viewProduct: (productId: string, productName: string, category: string, price: number) => {
    trackEcommerce({
      event_name: 'view_item',
      product_id: productId,
      product_name: productName,
      category,
      price,
      currency: 'EGP',
    });
  },

  addToCart: (productId: string, productName: string, price: number, quantity: number = 1) => {
    trackEcommerce({
      event_name: 'add_to_cart',
      product_id: productId,
      product_name: productName,
      price,
      quantity,
      value: price * quantity,
      currency: 'EGP',
    });
  },

  removeFromCart: (productId: string, productName: string, price: number, quantity: number = 1) => {
    trackEcommerce({
      event_name: 'remove_from_cart',
      product_id: productId,
      product_name: productName,
      price,
      quantity,
      value: price * quantity,
      currency: 'EGP',
    });
  },

  viewCart: (value: number) => {
    trackEcommerce({
      event_name: 'view_cart',
      value,
      currency: 'EGP',
    });
  },

  beginCheckout: (value: number) => {
    trackEcommerce({
      event_name: 'begin_checkout',
      value,
      currency: 'EGP',
    });
  },

  purchase: (transactionId: string, value: number) => {
    trackEcommerce({
      event_name: 'purchase',
      transaction_id: transactionId,
      value,
      currency: 'EGP',
    });
  },
};
