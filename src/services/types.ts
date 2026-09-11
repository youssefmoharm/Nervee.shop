/**
 * Type definitions for Supabase row shapes
 * Used by service layer transforms to ensure type safety on database results
 */

/**
 * Raw product row from Supabase products table
 * Includes nested relations (product_colors, product_inventory, gallery)
 */
export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  compare_at_price?: number | null;
  category: string;
  badge?: string | null;
  currency?: string | null;
  collection_id?: string | null;
  material?: string | null;
  care?: string[] | null;
  gallery?: string[] | null;
  is_best_seller?: boolean | null;
  is_active: boolean;
  fit_notes?: string | null;
  created_at: string;
  updated_at: string;
  product_colors?: ColorRow[] | null;
  product_inventory?: InventoryRow[] | null;
}

/**
 * Raw product color variant from Supabase product_colors table
 */
export interface ColorRow {
  id: string;
  product_id: string;
  name: string;
  hex: string;
  image: string;
  hover_image?: string | null;
  created_at: string;
}

/**
 * Raw product inventory row from Supabase product_inventory table
 */
export interface InventoryRow {
  id: string;
  product_id: string;
  size: string;
  stock_quantity: number;
  in_stock: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Raw collection row from Supabase collections table
 */
export interface CollectionRow {
  id: string;
  name: string;
  tagline: string;
  description: string;
  image: string;
  created_at: string;
}

/**
 * Raw product review from Supabase product_reviews table
 */
export interface ReviewRow {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string;
  comment: string;
  photos?: string[] | null;
  helpful_count?: number | null;
  verified?: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Raw order row from Supabase orders table
 */
export interface OrderRow {
  id: string;
  order_number: string;
  customer_id?: string | null;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  city: string;
  governorate: string;
  postal_code: string;
  delivery_method: 'standard' | 'express';
  payment_provider: string;
  payment_status: 'pending' | 'paid' | 'failed';
  order_status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  subtotal: number;
  shipping: number;
  discount_amount: number;
  total: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  paid_at?: string | null;
}

/**
 * Raw cart item row from Supabase carts table
 */
export interface CartItemRow {
  id: string;
  user_id: string;
  product_id: string;
  color: string;
  size: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

/**
 * Raw wishlist item row from Supabase wishlists table
 */
export interface WishlistItemRow {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
}

/**
 * Raw customer row from Supabase customers table
 */
export interface CustomerRow {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
  preferences?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
