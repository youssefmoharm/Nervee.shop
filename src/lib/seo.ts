/**
 * SEO utilities for managing meta tags and structured data
 */

interface MetaTags {
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  robots?: string;
  keywords?: string;
}

/**
 * Update document head meta tags
 */
export function updateMetaTags(tags: MetaTags) {
  const {
    title,
    description,
    canonical,
    ogTitle,
    ogDescription,
    ogImage,
    ogType = 'website',
    twitterCard = 'summary_large_image',
    twitterTitle,
    twitterDescription,
    robots,
    keywords,
  } = tags;

  // Update title
  if (title) {
    document.title = title;
    updateMetaTag('og:title', ogTitle || title);
    updateMetaTag('twitter:title', twitterTitle || title);
  }

  // Update description
  if (description) {
    updateMetaTag('description', description);
    updateMetaTag('og:description', ogDescription || description);
    updateMetaTag('twitter:description', twitterDescription || description);
  }

  // Update canonical
  if (canonical) {
    updateCanonical(canonical);
  }

  // Update OG tags
  if (ogImage) {
    updateMetaTag('og:image', ogImage);
    updateMetaTag('twitter:image', ogImage);
  }
  updateMetaTag('og:type', ogType);
  updateMetaTag('twitter:card', twitterCard);

  // Update robots
  if (robots) {
    updateMetaTag('robots', robots);
  }

  // Update keywords
  if (keywords) {
    updateMetaTag('keywords', keywords);
  }
}

/**
 * Update a single meta tag
 */
function updateMetaTag(name: string, content: string) {
  let element = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    const isProperty = name.startsWith('og:') || name.startsWith('twitter:');
    if (isProperty) {
      element.setAttribute('property', name);
    } else {
      element.setAttribute('name', name);
    }
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

/**
 * Update or create canonical link
 */
function updateCanonical(url: string) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

/**
 * Add JSON-LD structured data
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addStructuredData(data: Record<string, any>) {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    ...data,
  });
  document.head.appendChild(script);
  return () => script.remove();
}

/**
 * Generate Product schema
 */
export function getProductSchema(product: {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  rating?: number;
  reviewCount?: number;
  inStock?: boolean;
  url?: string;
}) {
  const baseUrl = 'https://www.nerveey.shop';
  return {
    '@type': 'Product',
    '@id': `${baseUrl}/products/${product.id}`,
    name: product.name,
    description: product.description,
    image: product.image || `${baseUrl}/nervee-logo-favicon.png`,
    url: product.url || `${baseUrl}/product/${product.id}`,
    offers: {
      '@type': 'Offer',
      price: product.price.toString(),
      priceCurrency: 'EGP',
      availability: product.inStock ? 'InStock' : 'OutOfStock',
      url: product.url || `${baseUrl}/product/${product.id}`,
    },
    ...(product.rating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.rating.toString(),
        reviewCount: product.reviewCount || 0,
      },
    }),
  };
}

/**
 * Generate Organization schema
 */
export function getOrganizationSchema() {
  return {
    '@type': 'Organization',
    name: 'NERVE',
    url: 'https://www.nerveey.shop',
    logo: 'https://www.nerveey.shop/nervee-logo-favicon.png',
    sameAs: ['https://www.instagram.com/nervee.shop', 'https://www.facebook.com/nervee.shop'],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      email: 'hello@nerveey.shop',
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'EG',
      addressLocality: 'Cairo',
    },
  };
}

/**
 * Generate BreadcrumbList schema
 */
export function getBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: (index + 1).toString(),
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Generate CollectionPage schema
 */
export function getCollectionSchema(collection: {
  name: string;
  description?: string;
  image?: string;
  url: string;
  productCount?: number;
}) {
  return {
    '@type': 'CollectionPage',
    name: collection.name,
    description: collection.description,
    image: collection.image,
    url: collection.url,
    ...(collection.productCount && {
      numberOfItems: collection.productCount,
    }),
  };
}

/**
 * Generate FAQPage schema
 */
export function getFAQSchema(
  faqs: Array<{
    question: string;
    answer: string;
  }>,
) {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

// Re-export hooks from their files for convenience
export { useSEO } from '../hooks/useSEO';
export { useStructuredData } from '../hooks/useStructuredData';
