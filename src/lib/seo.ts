/**
 * SEO & Meta Tags Management
 *
 * Dynamic meta tags for better search rankings and social sharing
 */

import { useEffect } from 'react';

export interface SEOProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product' | 'article';
  price?: number;
  currency?: string;
  availability?: 'InStock' | 'OutOfStock';
  brand?: string;
}

// Set meta tag helper
function setMeta(name: string, content: string) {
  if (typeof window === 'undefined') return;

  let tag =
    document.querySelector(`meta[property="${name}"]`) ||
    document.querySelector(`meta[name="${name}"]`);

  if (!tag) {
    tag = document.createElement('meta');
    const attrName = name.startsWith('og:') || name.startsWith('twitter:') ? 'property' : 'name';
    tag.setAttribute(attrName, name);
    document.head.appendChild(tag);
  }

  tag.setAttribute('content', content);
}

// React hook for SEO
export function useSEO(props: SEOProps) {
  useEffect(() => {
    const currentUrl = props.url || window.location.href;

    // Canonical URL (strips query params by default)
    setCanonicalUrl(props.url || window.location.href.split('?')[0]);

    // Basic meta tags
    document.title = props.title;
    setMeta('description', props.description);

    // Open Graph (Facebook, LinkedIn)
    setMeta('og:title', props.title);
    setMeta('og:description', props.description);
    setMeta('og:type', props.type || 'website');
    setMeta('og:url', currentUrl);
    setMeta('og:site_name', 'NERVE - Cool but Chic');

    if (props.image) {
      setMeta('og:image', props.image);
      setMeta('og:image:width', '1200');
      setMeta('og:image:height', '630');
    }

    // Twitter Cards
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', props.title);
    setMeta('twitter:description', props.description);
    setMeta('twitter:site', '@nerve_store'); // Replace with actual Twitter handle

    if (props.image) {
      setMeta('twitter:image', props.image);
    }

    // Product-specific meta tags
    if (props.type === 'product') {
      if (props.price) {
        setMeta('product:price:amount', props.price.toString());
        setMeta('product:price:currency', props.currency || 'EGP');
      }

      if (props.availability) {
        setMeta('product:availability', props.availability);
      }

      if (props.brand) {
        setMeta('product:brand', props.brand);
      }
    }

    // Cleanup function
    return () => {
      // Don't remove basic tags as they'll be replaced by next page
    };
  }, [props]);
}

// Insert structured data into page
export function insertStructuredData(schema: object, id?: string) {
  if (typeof window === 'undefined') return;

  const scriptId = id || 'structured-data';

  // Remove existing script if it exists
  const existingScript = document.getElementById(scriptId);
  if (existingScript) {
    existingScript.remove();
  }

  // Create new script
  const script = document.createElement('script');
  script.id = scriptId;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

// React hook for structured data
export function useStructuredData(schema: object, id?: string) {
  useEffect(() => {
    insertStructuredData(schema, id);

    return () => {
      if (id) {
        const script = document.getElementById(id);
        if (script) script.remove();
      }
    };
  }, [schema, id]);
}

// Get optimized meta description
export function getMetaDescription(text: string, maxLength: number = 160): string {
  if (text.length <= maxLength) return text;

  // Find the last complete sentence within the limit
  const truncated = text.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastPeriod > maxLength * 0.7) {
    return truncated.substring(0, lastPeriod + 1);
  } else if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...';
  } else {
    return truncated + '...';
  }
}

// Generate canonical URL
export function setCanonicalUrl(url?: string) {
  if (typeof window === 'undefined') return;

  const canonicalUrl = url || window.location.href.split('?')[0]; // Remove query params

  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;

  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }

  link.href = canonicalUrl;
}

// Default SEO values
export const DEFAULT_SEO = {
  title: 'NERVE - Cool but Chic | Egyptian Streetwear',
  description:
    "Discover NERVE's collection of modern streetwear. From premium tees to sustainable denim, find your style in our carefully curated Egyptian concept store.",
  image: 'https://nerve-store.com/nervee-logo-favicon.png',
  url: 'https://nerve-store.com',
  type: 'website' as const,
};

// SEO helpers for common pages
export const seoHelpers = {
  // Home page
  home: (): SEOProps => ({
    ...DEFAULT_SEO,
    title: 'NERVE - Cool but Chic | Modern Egyptian Streetwear',
    description:
      'Shop the latest in Egyptian streetwear at NERVE. Premium tees, hoodies, and sustainable denim. Free delivery across Egypt.',
  }),

  // Shop page
  shop: (): SEOProps => ({
    ...DEFAULT_SEO,
    title: 'Shop All Products | NERVE Streetwear',
    description:
      'Browse our complete collection of streetwear. Tees, hoodies, denim and more. Free shipping on orders over EGP 500.',
  }),

  // Product page
  product: (product: {
    name: string;
    description: string;
    price: number;
    images: string[];
    category?: string;
  }): SEOProps => ({
    title: `${product.name} | NERVE`,
    description: getMetaDescription(product.description),
    image: product.images[0],
    type: 'product',
    price: product.price,
    currency: 'EGP',
    brand: 'NERVE',
  }),

  // Category page
  category: (categoryName: string, description?: string): SEOProps => ({
    ...DEFAULT_SEO,
    title: `${categoryName} | NERVE Streetwear`,
    description:
      description ||
      `Shop ${categoryName.toLowerCase()} from NERVE. Modern Egyptian streetwear with free delivery across Egypt.`,
  }),
};
