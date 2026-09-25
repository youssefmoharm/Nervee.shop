import Fuse from 'fuse.js';
import type { Product, SortOption } from '../types';

const SIZE_ORDER: string[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

/** Tight threshold for actual result sets. */
const RESULT_THRESHOLD = 0.3;
/** Slightly looser threshold used only for "did you mean" recovery on empty results. */
const SUGGEST_THRESHOLD = 0.4;

export interface CatalogFilters {
  query?: string;
  category?: string | null;
  colors?: string[];
  sizes?: string[];
  priceMin?: number;
  priceMax?: number;
  /** Keep only products with at least one in-stock size. Products without
   *  availability data are kept (unknown ≠ sold out). */
  inStockOnly?: boolean;
}

export interface SearchOutcome {
  products: Product[];
  /** True when nothing matched exactly and these are fuzzy (typo-tolerant) matches. */
  fuzzy: boolean;
}

export interface FilterOptions {
  colors: string[];
  sizes: string[];
  categories: string[];
  priceMin: number;
  priceMax: number;
}

export function normalizeSearchQuery(query: string) {
  return query.trim().toLowerCase();
}

function haystack(product: Product): string {
  return [
    product.name,
    product.category,
    product.colors.map(color => color.name).join(' '),
    product.description,
    product.material,
  ]
    .join(' ')
    .toLowerCase();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

/**
 * Fuse indexes are rebuilt whenever the catalog array identity changes, so
 * cache them per catalog and threshold. The fuzzy path only runs when an
 * exact search finds nothing, which keeps keystroke cost near zero.
 */
const fuseCache = new WeakMap<Product[], Map<number, Fuse<Product>>>();

function getFuse(products: Product[], threshold: number): Fuse<Product> {
  let byThreshold = fuseCache.get(products);
  if (!byThreshold) {
    byThreshold = new Map();
    fuseCache.set(products, byThreshold);
  }
  const cached = byThreshold.get(threshold);
  if (cached) return cached;

  const fuse = new Fuse(products, {
    keys: [
      { name: 'name', weight: 0.5 },
      { name: 'category', weight: 0.3 },
      { name: 'colors.name', weight: 0.1 },
      { name: 'description', weight: 0.05 },
      { name: 'material', weight: 0.05 },
    ],
    threshold,
    ignoreLocation: true,
    minMatchCharLength: 2,
    includeScore: true,
  });
  byThreshold.set(threshold, fuse);
  return fuse;
}

/**
 * Exact substring search first — fast, predictable and typo-free — then a
 * fuzzy fallback so "hoddie" still finds the hoodie without exact queries
 * (e.g. "cap") picking up noise from loose matches.
 */
export function searchCatalog(products: Product[], query: string): SearchOutcome {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return { products, fuzzy: false };

  const exact = products.filter(product => haystack(product).includes(normalized));
  if (exact.length > 0) return { products: exact, fuzzy: false };
  if (normalized.length < 2) return { products: [], fuzzy: false };

  const fuzzy = getFuse(products, RESULT_THRESHOLD)
    .search(normalized)
    .map(result => result.item);
  return { products: fuzzy, fuzzy: fuzzy.length > 0 };
}

export function filterProducts(products: Product[], filters: CatalogFilters): SearchOutcome {
  const {
    query = '',
    category = null,
    colors = [],
    sizes = [],
    priceMin,
    priceMax,
    inStockOnly = false,
  } = filters;

  const { products: matched, fuzzy } = searchCatalog(products, query);
  let visible = matched;

  if (category) {
    visible = visible.filter(product => product.category === category);
  }

  if (colors.length) {
    visible = visible.filter(product => product.colors.some(color => colors.includes(color.name)));
  }

  if (sizes.length) {
    visible = visible.filter(product =>
      product.sizes.some(size => sizes.includes(size.size) && size.inStock),
    );
  }

  if (priceMin != null) {
    visible = visible.filter(product => product.price >= priceMin);
  }

  if (priceMax != null) {
    visible = visible.filter(product => product.price <= priceMax);
  }

  if (inStockOnly) {
    visible = visible.filter(
      product => product.sizes.length === 0 || product.sizes.some(size => size.inStock),
    );
  }

  return { products: visible, fuzzy };
}

/** Product-name suggestions first, then category suggestions; falls back to
 *  close (possibly misspelled) product names when nothing matches exactly. */
export function getSearchSuggestions(products: Product[], query: string, limit = 5): string[] {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];

  const names: string[] = [];
  const categories: string[] = [];
  const seen = new Set<string>();

  products.forEach(product => {
    if (product.name.toLowerCase().includes(normalized)) {
      if (!seen.has(product.name)) {
        seen.add(product.name);
        names.push(product.name);
      }
    } else if (product.category.toLowerCase().includes(normalized)) {
      if (!seen.has(product.category)) {
        seen.add(product.category);
        categories.push(product.category);
      }
    }
  });

  const exact = [...names, ...categories];
  if (exact.length > 0) return exact.slice(0, limit);

  return uniqueStrings(
    getFuse(products, RESULT_THRESHOLD)
      .search(normalized)
      .map(result => result.item.name),
  ).slice(0, limit);
}

/** Close-name recovery for empty result sets: runs on a looser threshold so a
 *  genuinely misspelled query can still surface a correction. */
export function getDidYouMean(products: Product[], query: string, limit = 3): string[] {
  const normalized = normalizeSearchQuery(query);
  if (normalized.length < 2) return [];

  return uniqueStrings(
    getFuse(products, SUGGEST_THRESHOLD)
      .search(normalized)
      .map(result => result.item.name),
  ).slice(0, limit);
}

export function sortProducts(products: Product[], sort: SortOption): Product[] {
  const newestFirst = (a: Product, b: Product) => +new Date(b.createdAt) - +new Date(a.createdAt);
  const result = [...products];

  switch (sort) {
    case 'price-asc':
      result.sort((a, b) => a.price - b.price || newestFirst(a, b));
      break;
    case 'price-desc':
      result.sort((a, b) => b.price - a.price || newestFirst(a, b));
      break;
    case 'best-selling':
      result.sort((a, b) => Number(b.isBestSeller) - Number(a.isBestSeller) || newestFirst(a, b));
      break;
    case 'newest':
    default:
      result.sort(newestFirst);
      break;
  }

  return result;
}

/** Facet values that actually exist in the loaded catalog — never offer a
 *  color/size/category/price bound the data cannot satisfy. */
export function getFilterOptions(products: Product[]): FilterOptions {
  const colors: string[] = [];
  const sizes: string[] = [];
  const categories: string[] = [];
  const seenColors = new Set<string>();
  const seenSizes = new Set<string>();
  const seenCategories = new Set<string>();
  let priceMin = Number.POSITIVE_INFINITY;
  let priceMax = Number.NEGATIVE_INFINITY;

  products.forEach(product => {
    product.colors.forEach(color => {
      if (!seenColors.has(color.name)) {
        seenColors.add(color.name);
        colors.push(color.name);
      }
    });
    product.sizes.forEach(size => {
      if (!seenSizes.has(size.size)) {
        seenSizes.add(size.size);
        sizes.push(size.size);
      }
    });
    if (!seenCategories.has(product.category)) {
      seenCategories.add(product.category);
      categories.push(product.category);
    }
    if (product.price < priceMin) priceMin = product.price;
    if (product.price > priceMax) priceMax = product.price;
  });

  return {
    colors,
    sizes: [...sizes].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b)),
    categories,
    priceMin: Number.isFinite(priceMin) ? priceMin : 0,
    priceMax: Number.isFinite(priceMax) ? priceMax : 0,
  };
}

/** Data-backed "hot" terms for empty search surfaces: best sellers first,
 *  then the categories with the most products. */
export function getTrendingTerms(products: Product[], limit = 5): string[] {
  if (products.length === 0) return [];

  const counts = new Map<string, number>();
  products.forEach(product => {
    counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
  });
  const categoriesByCount = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category);

  const bestSellers = products.filter(product => product.isBestSeller).map(product => product.name);

  return uniqueStrings([...bestSellers, ...categoriesByCount]).slice(0, limit);
}
