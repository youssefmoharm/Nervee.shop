import { useEffect } from 'react';
import { updateMetaTags } from '../lib/seo';

interface UseSEOOptions {
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  type?: 'website' | 'product' | 'article';
  twitterCard?: 'summary' | 'summary_large_image';
  twitterTitle?: string;
  twitterDescription?: string;
  keywords?: string;
  robots?: string;
  price?: number;
  currency?: string;
  brand?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
}

/**
 * Hook to update SEO metadata dynamically.
 * Scroll-to-top is handled by ScrollToTop on pathname change — not here.
 */
export function useSEO(options: UseSEOOptions) {
  // Serialize so the effect only re-runs when SEO values actually change,
  // not on every parent re-render (inline object literals are new each time).
  const key = JSON.stringify(options);

  useEffect(() => {
    const baseUrl = 'https://www.nerveey.shop';
    const opts: UseSEOOptions = JSON.parse(key);
    const ogType = opts.ogType || opts.type || 'website';

    updateMetaTags({
      title: opts.title,
      description: opts.description,
      canonical: opts.canonical || `${baseUrl}${window.location.pathname}`,
      ogTitle: opts.ogTitle,
      ogDescription: opts.ogDescription,
      ogImage: opts.ogImage,
      ogType: ogType as 'website' | 'product' | 'article',
      twitterCard: opts.twitterCard,
      twitterTitle: opts.twitterTitle,
      twitterDescription: opts.twitterDescription,
      keywords: opts.keywords,
      robots: opts.robots,
    });
  }, [key]);
}
