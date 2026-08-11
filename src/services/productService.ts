import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  products as mockProducts,
  collections as mockCollections,
  getProductBySlug as getMockProductBySlug,
  getNewDrop as getMockNewDrop,
  getBestSellers as getMockBestSellers,
  getProductsByCollection as getMockProductsByCollection,
  getRelated as getMockRelated,
  getCollection as getMockCollection,
} from '../data/products'
import type { Product, ProductColor, ProductVariantAvailability, SortOption, Category, Collection } from '../types'

export interface ShopFilters {
  category?: Category | 'New Arrivals' | null
  collectionId?: string | null
  colors?: string[]
  sizes?: string[]
  priceMin?: number
  priceMax?: number
  sort?: SortOption
}

/**
 * Transform Supabase row to Product type
 */
function transformProduct(row: any): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    collectionId: row.collection_id,
    price: row.price,
    compareAtPrice: row.compare_at_price,
    currency: row.currency || 'EGP',
    colors: row.product_colors || [],
    sizes: row.product_inventory || [],
    badge: row.badge,
    description: row.description,
    material: row.material,
    care: row.care || [],
    gallery: [], // Will be populated from colors
    isBestSeller: row.is_best_seller || false,
    createdAt: row.created_at,
    fitNotes: row.fit_notes,
  }
}

/**
 * Transform color row to ProductColor type
 */
function transformColor(row: any): ProductColor {
  return {
    name: row.name,
    hex: row.hex,
    image: row.image,
    hoverImage: row.hover_image,
  }
}

/**
 * Transform inventory row to ProductVariantAvailability type
 */
function transformInventory(row: any): ProductVariantAvailability {
  return {
    size: row.size,
    inStock: row.in_stock && row.stock_quantity > 0,
  }
}

/**
 * Transform collection row to Collection type
 */
function transformCollection(row: any): Collection {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    image: row.image,
  }
}

export const productService = {
  /**
   * List products with optional filters
   */
  async list(filters: ShopFilters = {}): Promise<Product[]> {
    // Fallback to mock data if Supabase not configured
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured, using mock data')
      let result = [...mockProducts]

      if (filters.category && filters.category !== 'New Arrivals') {
        result = result.filter((p) => p.category === filters.category)
      }
      if (filters.category === 'New Arrivals') {
        result = getMockNewDrop()
      }
      if (filters.collectionId) {
        result = result.filter((p) => p.collectionId === filters.collectionId)
      }
      if (filters.colors?.length) {
        result = result.filter((p) => p.colors.some((c) => filters.colors!.includes(c.name)))
      }
      if (filters.sizes?.length) {
        result = result.filter((p) =>
          p.sizes.some((s) => filters.sizes!.includes(s.size) && s.inStock)
        )
      }
      if (filters.priceMin != null) {
        result = result.filter((p) => p.price >= filters.priceMin!)
      }
      if (filters.priceMax != null) {
        result = result.filter((p) => p.price <= filters.priceMax!)
      }

      switch (filters.sort) {
        case 'newest':
          result.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
          break
        case 'price-asc':
          result.sort((a, b) => a.price - b.price)
          break
        case 'price-desc':
          result.sort((a, b) => b.price - a.price)
          break
        case 'best-selling':
          result.sort((a, b) => Number(b.isBestSeller) - Number(a.isBestSeller))
          break
        default:
          break
      }

      return result
    }

    try {
      let query = supabase
        .from('products')
        .select(`
          *,
          product_colors (name, hex, image, hover_image, sort_order),
          product_inventory (size, in_stock, stock_quantity)
        `)
        .eq('is_active', true)

      // Apply filters
      if (filters.category && filters.category !== 'New Arrivals') {
        query = query.eq('category', filters.category)
      }

      if (filters.collectionId) {
        query = query.eq('collection_id', filters.collectionId)
      }

      if (filters.priceMin != null) {
        query = query.gte('price', filters.priceMin)
      }

      if (filters.priceMax != null) {
        query = query.lte('price', filters.priceMax)
      }

      // Apply sorting
      switch (filters.sort) {
        case 'newest':
          query = query.order('created_at', { ascending: false })
          break
        case 'price-asc':
          query = query.order('price', { ascending: true })
          break
        case 'price-desc':
          query = query.order('price', { ascending: false })
          break
        case 'best-selling':
          query = query.order('is_best_seller', { ascending: false })
          break
        default:
          query = query.order('created_at', { ascending: false })
      }

      const { data, error } = await query

      if (error) throw error

      let products = (data || []).map((row: any) => {
        const product = transformProduct(row)
        product.colors = (row.product_colors || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map(transformColor)
        product.sizes = (row.product_inventory || []).map(transformInventory)
        return product
      })

      // Client-side color filter (can't do in SQL easily)
      if (filters.colors?.length) {
        products = products.filter((p) =>
          p.colors.some((c) => filters.colors!.includes(c.name))
        )
      }

      // Client-side size filter
      if (filters.sizes?.length) {
        products = products.filter((p) =>
          p.sizes.some((s) => filters.sizes!.includes(s.size) && s.inStock)
        )
      }

      // Handle "New Arrivals" category
      if (filters.category === 'New Arrivals') {
        return products.slice(0, 8)
      }

      return products
    } catch (error) {
      console.error('Error fetching products:', error)
      return []
    }
  },

  /**
   * Get a single product by slug
   */
  async getBySlug(slug: string): Promise<Product | undefined> {
    if (!isSupabaseConfigured) {
      return getMockProductBySlug(slug)
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_colors (name, hex, image, hover_image, sort_order),
          product_inventory (size, in_stock, stock_quantity)
        `)
        .eq('slug', slug)
        .eq('is_active', true)
        .single()

      if (error) throw error
      if (!data) return undefined

      const product = transformProduct(data)
      product.colors = (data.product_colors || [])
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map(transformColor)
      product.sizes = (data.product_inventory || []).map(transformInventory)

      return product
    } catch (error) {
      console.error('Error fetching product:', error)
      return undefined
    }
  },

  /**
   * Get newest products (New Drop)
   */
  async getNewDrop(): Promise<Product[]> {
    if (!isSupabaseConfigured) {
      return getMockNewDrop()
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_colors (name, hex, image, hover_image, sort_order),
          product_inventory (size, in_stock, stock_quantity)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(8)

      if (error) throw error

      return (data || []).map((row: any) => {
        const product = transformProduct(row)
        product.colors = (row.product_colors || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map(transformColor)
        product.sizes = (row.product_inventory || []).map(transformInventory)
        return product
      })
    } catch (error) {
      console.error('Error fetching new drop:', error)
      return []
    }
  },

  /**
   * Get best-selling products
   */
  async getBestSellers(): Promise<Product[]> {
    if (!isSupabaseConfigured) {
      return getMockBestSellers()
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_colors (name, hex, image, hover_image, sort_order),
          product_inventory (size, in_stock, stock_quantity)
        `)
        .eq('is_best_seller', true)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data || []).map((row: any) => {
        const product = transformProduct(row)
        product.colors = (row.product_colors || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map(transformColor)
        product.sizes = (row.product_inventory || []).map(transformInventory)
        return product
      })
    } catch (error) {
      console.error('Error fetching best sellers:', error)
      return []
    }
  },

  /**
   * Get related products (same category, different product)
   */
  async getRelated(product: Product): Promise<Product[]> {
    if (!isSupabaseConfigured) {
      return getMockRelated(product)
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_colors (name, hex, image, hover_image, sort_order),
          product_inventory (size, in_stock, stock_quantity)
        `)
        .eq('category', product.category)
        .eq('is_active', true)
        .neq('id', product.id)
        .limit(4)

      if (error) throw error

      return (data || []).map((row: any) => {
        const relatedProduct = transformProduct(row)
        relatedProduct.colors = (row.product_colors || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map(transformColor)
        relatedProduct.sizes = (row.product_inventory || []).map(transformInventory)
        return relatedProduct
      })
    } catch (error) {
      console.error('Error fetching related products:', error)
      return []
    }
  },

  /**
   * Get all collections
   */
  async getCollections(): Promise<Collection[]> {
    if (!isSupabaseConfigured) {
      return mockCollections
    }

    try {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error

      return (data || []).map(transformCollection)
    } catch (error) {
      console.error('Error fetching collections:', error)
      return []
    }
  },

  /**
   * Get a single collection by ID
   */
  async getCollection(id: string): Promise<Collection | undefined> {
    if (!isSupabaseConfigured) {
      return getMockCollection(id)
    }

    try {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      if (!data) return undefined

      return transformCollection(data)
    } catch (error) {
      console.error('Error fetching collection:', error)
      return undefined
    }
  },

  /**
   * Get products in a collection
   */
  async getProductsByCollection(id: string): Promise<Product[]> {
    if (!isSupabaseConfigured) {
      return getMockProductsByCollection(id)
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_colors (name, hex, image, hover_image, sort_order),
          product_inventory (size, in_stock, stock_quantity)
        `)
        .eq('collection_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data || []).map((row: any) => {
        const product = transformProduct(row)
        product.colors = (row.product_colors || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map(transformColor)
        product.sizes = (row.product_inventory || []).map(transformInventory)
        return product
      })
    } catch (error) {
      console.error('Error fetching collection products:', error)
      return []
    }
  },

  /**
   * Search products by text query
   */
  async search(query: string): Promise<Product[]> {
    const q = query.trim()
    if (!q) return []

    if (!isSupabaseConfigured) {
      const lowerQ = q.toLowerCase()
      return mockProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(lowerQ) ||
          p.category.toLowerCase().includes(lowerQ) ||
          p.description.toLowerCase().includes(lowerQ)
      )
    }

    try {
      // Use Postgres full-text search
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_colors (name, hex, image, hover_image, sort_order),
          product_inventory (size, in_stock, stock_quantity)
        `)
        .eq('is_active', true)
        .textSearch('name', q, {
          type: 'websearch',
          config: 'english',
        })

      if (error) throw error

      return (data || []).map((row: any) => {
        const product = transformProduct(row)
        product.colors = (row.product_colors || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map(transformColor)
        product.sizes = (row.product_inventory || []).map(transformInventory)
        return product
      })
    } catch (error) {
      console.error('Error searching products:', error)
      return []
    }
  },
}
