import { describe, expect, it } from 'vitest';
import {
  filterProducts,
  getDidYouMean,
  getFilterOptions,
  getSearchSuggestions,
  getTrendingTerms,
  searchCatalog,
  sortProducts,
} from '../../lib/productDiscovery';
import type { Product } from '../../types';

const tee: Product = {
  id: '1',
  slug: 'core-tee',
  name: 'CORE TEE',
  category: 'T-Shirts',
  collectionId: 'c1',
  price: 1000,
  currency: 'EGP',
  colors: [{ name: 'Navy', hex: '#001f3f', image: '/a.jpg' }],
  sizes: [
    { size: 'S', inStock: true },
    { size: 'M', inStock: false },
  ],
  badge: null,
  description: 'Heavyweight cotton',
  material: 'Cotton',
  care: ['Machine wash'],
  gallery: ['/a.jpg'],
  isBestSeller: false,
  createdAt: '2026-01-01',
};

const hoodie: Product = {
  id: '2',
  slug: 'zip-hoodie',
  name: 'ZIP HOODIE',
  category: 'Hoodies',
  collectionId: 'c2',
  price: 2500,
  currency: 'EGP',
  colors: [
    { name: 'Black', hex: '#000000', image: '/b.jpg' },
    { name: 'Navy', hex: '#001f3f', image: '/b2.jpg' },
  ],
  sizes: [{ size: 'L', inStock: true }],
  badge: 'NEW',
  description: 'Fleece lined',
  material: 'Cotton',
  care: ['Machine wash'],
  gallery: ['/b.jpg'],
  isBestSeller: true,
  createdAt: '2026-03-01',
};

const soldOutCap: Product = {
  id: '3',
  slug: 'sold-out-cap',
  name: 'SOLD OUT CAP',
  category: 'Caps',
  collectionId: 'c3',
  price: 500,
  currency: 'EGP',
  colors: [{ name: 'Navy', hex: '#001f3f', image: '/c.jpg' }],
  sizes: [{ size: 'M', inStock: false }],
  badge: null,
  description: 'Six panel',
  material: 'Cotton',
  care: ['Spot clean'],
  gallery: ['/c.jpg'],
  isBestSeller: false,
  createdAt: '2026-02-01',
};

// No availability rows at all (e.g. the availability view failed).
const unknownAvailability: Product = {
  ...tee,
  id: '4',
  slug: 'unknown-stock-tee',
  name: 'UNKNOWN STOCK TEE',
  sizes: [],
};

const catalog = [tee, hoodie, soldOutCap];

describe('searchCatalog', () => {
  it('matches exactly and does not flag fuzzy', () => {
    const { products, fuzzy } = searchCatalog(catalog, 'hoodie');
    expect(products.map(p => p.name)).toEqual(['ZIP HOODIE']);
    expect(fuzzy).toBe(false);
  });

  it('recovers typos through the fuzzy fallback', () => {
    const { products, fuzzy } = searchCatalog(catalog, 'hoddie');
    expect(products.map(p => p.name)).toContain('ZIP HOODIE');
    expect(fuzzy).toBe(true);
  });

  it('returns the whole catalog for an empty query', () => {
    const { products, fuzzy } = searchCatalog(catalog, '   ');
    expect(products).toHaveLength(3);
    expect(fuzzy).toBe(false);
  });

  it('finds products by color name', () => {
    const { products, fuzzy } = searchCatalog(catalog, 'navy');
    expect(products.map(p => p.name)).toEqual(['CORE TEE', 'ZIP HOODIE', 'SOLD OUT CAP']);
    expect(fuzzy).toBe(false);
  });

  it('stays empty for a query that matches nothing', () => {
    expect(searchCatalog(catalog, 'sneaker').products).toHaveLength(0);
  });
});

describe('filterProducts facets', () => {
  it('filters by category', () => {
    const { products } = filterProducts(catalog, { category: 'Hoodies' });
    expect(products.map(p => p.name)).toEqual(['ZIP HOODIE']);
  });

  it('filters by color', () => {
    const { products } = filterProducts(catalog, { colors: ['Black'] });
    expect(products.map(p => p.name)).toEqual(['ZIP HOODIE']);
  });

  it('only matches a size that is actually in stock', () => {
    const { products } = filterProducts(catalog, { sizes: ['M'] });
    // Tee has M but it is sold out; cap has M but it is sold out too.
    expect(products).toHaveLength(0);
  });

  it('filters by price ceiling', () => {
    const { products } = filterProducts(catalog, { priceMax: 1000 });
    expect(products.map(p => p.name).sort()).toEqual(['CORE TEE', 'SOLD OUT CAP']);
  });

  it('keeps only in-stock products when availability is requested', () => {
    const { products } = filterProducts([...catalog, unknownAvailability], {
      inStockOnly: true,
    });
    expect(products.map(p => p.name).sort()).toEqual([
      'CORE TEE',
      'UNKNOWN STOCK TEE',
      'ZIP HOODIE',
    ]);
  });

  it('keeps products with unknown availability instead of hiding them', () => {
    const { products } = filterProducts([unknownAvailability], { inStockOnly: true });
    expect(products).toHaveLength(1);
  });

  it('combines search with every facet', () => {
    const { products, fuzzy } = filterProducts([...catalog, unknownAvailability], {
      query: 'hoddie',
      category: 'Hoodies',
      colors: ['Navy'],
      sizes: ['L'],
      priceMax: 3000,
      inStockOnly: true,
    });
    expect(products.map(p => p.name)).toEqual(['ZIP HOODIE']);
    expect(fuzzy).toBe(true);
  });

  it('yields an empty set when a facet excludes the matches', () => {
    const { products } = filterProducts(catalog, { query: 'hoodie', category: 'Caps' });
    expect(products).toHaveLength(0);
  });
});

describe('search suggestions', () => {
  it('ranks product names ahead of category names', () => {
    // 'shirt' only matches a category name; 'cap' matches a product name first.
    expect(getSearchSuggestions(catalog, 'shirt')).toEqual(['T-Shirts']);
    expect(getSearchSuggestions(catalog, 'cap')).toEqual(['SOLD OUT CAP']);
  });

  it('falls back to close names when nothing matches exactly', () => {
    expect(getSearchSuggestions(catalog, 'hoddie')).toContain('ZIP HOODIE');
  });

  it('returns nothing for an empty query', () => {
    expect(getSearchSuggestions(catalog, '')).toEqual([]);
  });
});

describe('did-you-mean', () => {
  it('suggests close product names for a misspelling', () => {
    expect(getDidYouMean(catalog, 'hoddie')).toContain('ZIP HOODIE');
  });

  it('ignores queries too short to fuzzy match', () => {
    expect(getDidYouMean(catalog, 'c')).toEqual([]);
  });
});

describe('sortProducts', () => {
  it('sorts newest first', () => {
    expect(sortProducts(catalog, 'newest').map(p => p.name)).toEqual([
      'ZIP HOODIE',
      'SOLD OUT CAP',
      'CORE TEE',
    ]);
  });

  it('sorts by price ascending and descending', () => {
    expect(sortProducts(catalog, 'price-asc').map(p => p.price)).toEqual([500, 1000, 2500]);
    expect(sortProducts(catalog, 'price-desc').map(p => p.price)).toEqual([2500, 1000, 500]);
  });

  it('sorts best sellers first, then newest', () => {
    expect(sortProducts(catalog, 'best-selling').map(p => p.name)).toEqual([
      'ZIP HOODIE',
      'SOLD OUT CAP',
      'CORE TEE',
    ]);
  });

  it('does not mutate the input array', () => {
    const input = [tee, soldOutCap, hoodie];
    sortProducts(input, 'price-asc');
    expect(input.map(p => p.id)).toEqual(['1', '3', '2']);
  });
});

describe('getFilterOptions', () => {
  it('derives only values the catalog contains', () => {
    const options = getFilterOptions(catalog);
    expect(options.colors.sort()).toEqual(['Black', 'Navy']);
    expect(options.categories.sort()).toEqual(['Caps', 'Hoodies', 'T-Shirts']);
    expect(options.sizes).toEqual(['S', 'M', 'L']);
    expect(options.priceMin).toBe(500);
    expect(options.priceMax).toBe(2500);
  });

  it('returns zeroed bounds for an empty catalog', () => {
    expect(getFilterOptions([])).toEqual({
      colors: [],
      sizes: [],
      categories: [],
      priceMin: 0,
      priceMax: 0,
    });
  });
});

describe('getTrendingTerms', () => {
  it('prefers best sellers, then categories with the most products', () => {
    expect(getTrendingTerms([...catalog, { ...tee, id: '5' }])).toContain('ZIP HOODIE');
    expect(getTrendingTerms(catalog).every(term => typeof term === 'string')).toBe(true);
  });

  it('returns nothing for an empty catalog', () => {
    expect(getTrendingTerms([])).toEqual([]);
  });
});
