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
  type?: 'website' | 'product' | 'article'; // Alias for ogType
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
 * Hook to update SEO metadata dynamically
 * Usage: useSEO({ title: 'My Page', description: 'Page description' })
 */
export function useSEO(options: UseSEOOptions) {
  useEffect(() => {
    const baseUrl = 'https://www.nerveey.shop';

    // Handle 'type' as alias for 'ogType'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ogType = options.ogType || options.type || 'website';

    updateMetaTags({
      title: options.title,
      description: options.description,
      canonical: options.canonical || `${baseUrl}${window.location.pathname}`,
      ogTitle: options.ogTitle,
      ogDescription: options.ogDescription,
      ogImage: options.ogImage,
      ogType: ogType as any,
      twitterCard: options.twitterCard,
      twitterTitle: options.twitterTitle,
      twitterDescription: options.twitterDescription,
      keywords: options.keywords,
      robots: options.robots,
    });

    // Scroll to top when page changes (good for SEO + UX)
    window.scrollTo(0, 0);
  }, [options]);
}
