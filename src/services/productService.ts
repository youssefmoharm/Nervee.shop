import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logError } from '../lib/sentry';
import { containsArabic } from '../lib/format';
import { safeImageSrc } from '../lib/images';
import { ProductRow, ColorRow, AvailabilityRow, CollectionRow } from './types';
import {
  products as mockProducts,
  collections as mockCollections,
  getProductBySlug as getMockProductBySlug,
  getNewDrop as getMockNewDrop,
  getBestSellers as getMockBestSellers,
  getProductsByCollection as getMockProductsByCollection,
  getRelated as getMockRelated,
  getCollection as getMockCollection,
} from '../data/products';
import type {
  Product,
  ProductColor,
  ProductVariantAvailability,
  Size,
  SortOption,
  Category,
  Badge,
  Collection,
} from '../types';

export interface ShopFilters {
  category?: Category | 'New Arrivals' | null;
  collectionId?: string | null;
  colors?: string[];
  sizes?: string[];
  priceMin?: number;
  priceMax?: number;
  sort?: SortOption;
}

interface ProductColorRow extends ColorRow {
  // Extends ColorRow which has all fields
}

const SIZE_ORDER: Size[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

/**
 * Mock/demo catalog is for local dev only. In production builds we never
 * return mock products (prevents fake inventory from ever reaching buyers) —
 * we surface an empty catalog + logged error instead.
 */
function allowMock(): boolean {
  if (import.meta.env.PROD) {
    logError('productService: mock catalog blocked in production (Supabase unavailable or empty)');
    return false;
  }
  return true;
}

function sortSizes(sizes: ProductVariantAvailability[]): ProductVariantAvailability[] {
  return [...sizes].sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size));
}

/**
 * Transform Supabase row to Product type (without sizes — filled by attachAvailability)
 */
function transformProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    // Category is a DB enum; trust Supabase data over the static union
    category: row.category as Category,
    collectionId: row.collection_id || '',
    price: row.price,
    compareAtPrice: row.compare_at_price || undefined,
    currency: (row.currency || 'EGP') as 'EGP',
    colors: row.product_colors || [],
    sizes: [],
    // Badge type is constrained; trust data
    badge: (row.badge as Badge | null) ?? null,
    description: row.description,
    material: row.material || '',
    care: row.care || [],
    gallery:
      (row.gallery as string[] | undefined)?.map(safeImageSrc) ||
      (row.product_colors as ProductColorRow[] | undefined)?.map(c => safeImageSrc(c.image)) ||
      [],
    isBestSeller: row.is_best_seller || false,
    createdAt: row.created_at,
    fitNotes: row.fit_notes || undefined,
    lowStockThreshold:
      typeof (row as { low_stock_threshold?: number | null }).low_stock_threshold === 'number'
        ? ((row as { low_stock_threshold?: number | null }).low_stock_threshold as number)
        : undefined,
  };
}

/**
 * Transform color row to ProductColor type
 */
function transformColor(row: ColorRow): ProductColor {
  return {
    name: row.name,
    hex: row.hex,
    image: safeImageSrc(row.image),
    hoverImage: row.hover_image ? safeImageSrc(row.hover_image) : undefined,
  };
}

function transformAvailability(row: AvailabilityRow): ProductVariantAvailability {
  return {
    size: row.size as Size,
    inStock: !!row.in_stock,
  };
}

/**
 * Attach sizes to products from the product_availability view and low-stock
 * flags from the product_stock_status view (security definer — anon-safe).
 * On failure, products keep empty sizes (render as unavailable) rather than
 * embedding product_inventory directly.
 */
async function attachAvailability(products: Product[]): Promise<Product[]> {
  if (products.length === 0) return products;

  try {
    const ids = products.map(p => p.id);
    const [{ data: avail, error }, { data: stockRows, error: stockError }] = await Promise.all([
      supabase
        .from('product_availability')
        .select('product_id, size, in_stock')
        .in('product_id', ids),
      supabase
        .from('product_stock_status')
        .select('product_id, low_stock_threshold, is_low_stock')
        .in('product_id', ids),
    ]);

    if (error || !avail) {
      if (error) logError('product_availability query failed:', error);
      return products;
    }

    const byProduct = new Map<string, ProductVariantAvailability[]>();
    (avail as AvailabilityRow[]).forEach(row => {
      const list = byProduct.get(row.product_id) ?? [];
      list.push(transformAvailability(row));
      byProduct.set(row.product_id, list);
    });

    const stockByProduct = new Map<string, { lowStockThreshold?: number; isLowStock?: boolean }>();
    if (!stockError && stockRows) {
      (
        stockRows as Array<{
          product_id: string;
          low_stock_threshold: number | null;
          is_low_stock: boolean | null;
        }>
      ).forEach(row => {
        stockByProduct.set(row.product_id, {
          lowStockThreshold:
            typeof row.low_stock_threshold === 'number' ? row.low_stock_threshold : undefined,
          isLowStock: row.is_low_stock === true,
        });
      });
    }

    return products.map(p => {
      const stockInfo = stockByProduct.get(p.id);
      return {
        ...p,
        sizes: sortSizes(byProduct.get(p.id) ?? []),
        lowStockThreshold: stockInfo?.lowStockThreshold ?? p.lowStockThreshold,
        isLowStock: stockInfo?.isLowStock ?? p.isLowStock,
      };
    });
  } catch (error) {
    logError('attachAvailability failed:', error);
    return products;
  }
}

/**
 * Transform collection row to Collection type
 */
function transformCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    image: safeImageSrc(row.image),
  };
}

const PRODUCT_SELECT = `
  *,
  product_colors (name, hex, image, hover_image, sort_order)
`;

function mapProductRows(data: ProductRow[] | null): Product[] {
  return (data || []).map(row => {
    const product = transformProduct(row);
    product.colors = (row.product_colors || [])
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(transformColor);
    return product;
  });
}

export const productService = {
  /**
   * List products with optional filters
   */
  async list(filters: ShopFilters = {}): Promise<Product[]> {
    // Fallback to mock data if Supabase not configured (dev only)
    if (!isSupabaseConfigured) {
      if (!allowMock()) return [];
      if (import.meta.env.DEV) {
        console.warn('Supabase not configured, using mock data');
      }
      let result = [...mockProducts];

      if (filters.category && filters.category !== 'New Arrivals') {
        result = result.filter(p => p.category === filters.category);
      }
      if (filters.category === 'New Arrivals') {
        result = getMockNewDrop();
      }
      if (filters.collectionId) {
        result = result.filter(p => p.collectionId === filters.collectionId);
      }
      if (filters.colors?.length) {
        result = result.filter(p => p.colors.some(c => filters.colors!.includes(c.name)));
      }
      if (filters.sizes?.length) {
        result = result.filter(p =>
          p.sizes.some(s => filters.sizes!.includes(s.size) && s.inStock),
        );
      }
      if (filters.priceMin != null) {
        result = result.filter(p => p.price >= filters.priceMin!);
      }
      if (filters.priceMax != null) {
        result = result.filter(p => p.price <= filters.priceMax!);
      }

      switch (filters.sort) {
        case 'newest':
          result.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
          break;
        case 'price-asc':
          result.sort((a, b) => a.price - b.price);
          break;
        case 'price-desc':
          result.sort((a, b) => b.price - a.price);
          break;
        case 'best-selling':
          result.sort((a, b) => Number(b.isBestSeller) - Number(a.isBestSeller));
          break;
        default:
          break;
      }

      return result;
    }

    try {
      let query = supabase.from('products').select(PRODUCT_SELECT).eq('is_active', true);

      // Apply filters
      if (filters.category && filters.category !== 'New Arrivals') {
        query = query.eq('category', filters.category);
      }

      if (filters.collectionId) {
        query = query.eq('collection_id', filters.collectionId);
      }

      if (filters.priceMin != null) {
        query = query.gte('price', filters.priceMin);
      }

      if (filters.priceMax != null) {
        query = query.lte('price', filters.priceMax);
      }

      // Apply sorting
      switch (filters.sort) {
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'price-asc':
          query = query.order('price', { ascending: true });
          break;
        case 'price-desc':
          query = query.order('price', { ascending: false });
          break;
        case 'best-selling':
          query = query.order('is_best_seller', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;

      let products = await attachAvailability(mapProductRows(data));

      // Client-side color filter (can't do in SQL easily)
      if (filters.colors?.length) {
        products = products.filter(p => p.colors.some(c => filters.colors!.includes(c.name)));
      }

      // Client-side size filter
      if (filters.sizes?.length) {
        products = products.filter(p =>
          p.sizes.some(s => filters.sizes!.includes(s.size) && s.inStock),
        );
      }

      // Handle "New Arrivals" category
      if (filters.category === 'New Arrivals') {
        return products.slice(0, 8);
      }

      return products;
    } catch (error) {
      logError('Error fetching products:', error);
      return [];
    }
  },

  /**
   * Get a single product by slug
   */
  async getBySlug(slug: string): Promise<Product | undefined> {
    if (!isSupabaseConfigured) {
      return allowMock() ? getMockProductBySlug(slug) : undefined;
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      if (!data) return undefined;

      const [product] = await attachAvailability(mapProductRows([data]));
      return product;
    } catch (error) {
      logError('Error fetching product:', error);
      return undefined;
    }
  },

  /**
   * Get newest products (New Drop)
   */
  async getNewDrop(): Promise<Product[]> {
    if (!isSupabaseConfigured) {
      if (!allowMock()) return [];
      if (import.meta.env.DEV) {
        console.info('[productService] Supabase not configured, using mock data for new drop');
      }
      return getMockNewDrop();
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;

      if (!data || data.length === 0) {
        if (import.meta.env.DEV) {
          console.warn(
            '[productService] getNewDrop: Supabase returned 0 active products, using mock data',
          );
        }
        return allowMock() ? getMockNewDrop() : [];
      }

      const results = await attachAvailability(mapProductRows(data));
      const valid = results.filter(p => p.colors && p.colors.length > 0);
      return valid.length > 0 ? valid : allowMock() ? getMockNewDrop() : [];
    } catch (error) {
      logError('Error fetching new drop:', error);
      return allowMock() ? getMockNewDrop() : [];
    }
  },

  /**
   * Get best-selling products
   */
  async getBestSellers(): Promise<Product[]> {
    if (!isSupabaseConfigured) {
      return allowMock() ? getMockBestSellers() : [];
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('is_best_seller', true)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const results = await attachAvailability(mapProductRows(data));
      return results.length > 0 ? results : allowMock() ? getMockBestSellers() : [];
    } catch (error) {
      logError('Error fetching best sellers:', error);
      return allowMock() ? getMockBestSellers() : [];
    }
  },

  /**
   * Get related products (same category, different product)
   */
  async getRelated(product: Product): Promise<Product[]> {
    if (!isSupabaseConfigured) {
      return allowMock() ? getMockRelated(product) : [];
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('category', product.category)
        .eq('is_active', true)
        .neq('id', product.id)
        .limit(4);

      if (error) throw error;

      return await attachAvailability(mapProductRows(data));
    } catch (error) {
      logError('Error fetching related products:', error);
      return [];
    }
  },

  /**
   * Get all collections
   */
  async getCollections(): Promise<Collection[]> {
    if (!isSupabaseConfigured) {
      return allowMock() ? mockCollections : [];
    }

    try {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const results = (data || []).map(transformCollection);
      return results.length > 0 ? results : allowMock() ? mockCollections : [];
    } catch (error) {
      logError('Error fetching collections:', error);
      return allowMock() ? mockCollections : [];
    }
  },

  /**
   * Get a single collection by ID
   */
  async getCollection(id: string): Promise<Collection | undefined> {
    if (!isSupabaseConfigured) {
      return allowMock() ? getMockCollection(id) : undefined;
    }

    try {
      const { data, error } = await supabase.from('collections').select('*').eq('id', id).single();

      if (error) throw error;
      if (!data) return undefined;

      return transformCollection(data);
    } catch (error) {
      logError('Error fetching collection:', error);
      return undefined;
    }
  },

  /**
   * Get products in a collection
   */
  async getProductsByCollection(id: string): Promise<Product[]> {
    if (!isSupabaseConfigured) {
      return allowMock() ? getMockProductsByCollection(id) : [];
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('collection_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return await attachAvailability(mapProductRows(data));
    } catch (error) {
      logError('Error fetching collection products:', error);
      return [];
    }
  },

  /**
   * Search products by text query
   */
  async search(query: string): Promise<Product[]> {
    const q = query.trim();
    if (!q) return [];

    if (!isSupabaseConfigured) {
      if (!allowMock()) return [];
      const lowerQ = q.toLowerCase();
      return mockProducts.filter(
        p =>
          p.name.toLowerCase().includes(lowerQ) ||
          p.category.toLowerCase().includes(lowerQ) ||
          p.description.toLowerCase().includes(lowerQ),
      );
    }

    try {
      // English queries use the english websearch config; Arabic (or mixed)
      // queries use the multilingual 'simple' config (index from migration 033).
      const isArabic = containsArabic(q);
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('is_active', true)
        .textSearch('name', q, {
          type: isArabic ? 'plain' : 'websearch',
          config: isArabic ? 'simple' : 'english',
        });

      if (error) throw error;

      return await attachAvailability(mapProductRows(data));
    } catch (error) {
      logError('Error searching products:', error);
      return [];
    }
  },
};
