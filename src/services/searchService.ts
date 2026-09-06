import Fuse from 'fuse.js';
import type { Product } from '../types';

export interface SearchResult {
  products: Product[];
  suggestions: string[];
  trendingSearches: string[];
}

const TRENDING_SEARCHES = [
  'hoodies',
  'summer collection',
  'denim',
  'sale',
  'new arrivals',
  'best sellers',
  'casual wear',
  'oversized fit',
];

export function searchProducts(query: string, products: Product[]): SearchResult {
  if (!query.trim()) {
    return {
      products: [],
      suggestions: [],
      trendingSearches: TRENDING_SEARCHES,
    };
  }

  // Setup Fuse.js for fuzzy matching
  const fuse = new Fuse(products, {
    keys: [
      { name: 'name', weight: 0.5 },
      { name: 'category', weight: 0.3 },
      { name: 'description', weight: 0.1 },
      { name: 'material', weight: 0.1 },
    ],
    threshold: 0.3, // 30% fuzzy tolerance
    minMatchCharLength: 2,
  });

  const results = fuse.search(query);
  const matchedProducts = results.map(r => r.item);

  // Generate suggestions from matched products
  const suggestions = Array.from(
    new Set(
      matchedProducts
        .slice(0, 5)
        .map(p => p.name)
        .concat([query]),
    ),
  );

  return {
    products: matchedProducts,
    suggestions,
    trendingSearches: TRENDING_SEARCHES,
  };
}

// Price range filtering
export function filterByPrice(products: Product[], maxPrice: number): Product[] {
  return products.filter(p => p.price <= maxPrice);
}

// Category filtering
export function filterByCategory(products: Product[], category: string): Product[] {
  return products.filter(p => p.category === category);
}
