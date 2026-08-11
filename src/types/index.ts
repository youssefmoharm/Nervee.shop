export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'

export type Badge = 'NEW' | 'BEST SELLER' | 'LIMITED' | 'SALE' | 'RESTOCKED' | null

export interface ProductColor {
  name: string
  hex: string
  image: string
  hoverImage?: string
}

export interface ProductVariantAvailability {
  size: Size
  inStock: boolean
}

export interface Product {
  id: string
  slug: string
  name: string
  category: Category
  collectionId: string
  price: number
  compareAtPrice?: number
  currency: 'EGP'
  colors: ProductColor[]
  sizes: ProductVariantAvailability[]
  badge: Badge
  description: string
  material: string
  care: string[]
  gallery: string[]
  isBestSeller: boolean
  createdAt: string
  fitNotes?: string
}

export type Category =
  | 'T-Shirts'
  | 'Hoodies'
  | 'Pants'
  | 'Denim'
  | 'Tops'
  | 'Jackets'
  | 'Caps'
  | 'Accessories'

export interface Collection {
  id: string
  name: string
  tagline: string
  description: string
  image: string
}

export interface CartLine {
  productId: string
  name: string
  slug: string
  image: string
  price: number
  color: string
  size: Size
  quantity: number
}

export interface WishlistItem {
  productId: string
  name: string
  slug: string
  image: string
  price: number
}

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  createdAt: string
}

export interface Order {
  id: string
  customerId: string
  status: string
  items: CartLine[]
  subtotal: number
  shippingFee: number
  discount: number
  total: number
  paymentMethod: string
  paymentStatus: string
  shippingAddress: {
    street: string
    city: string
    governorate: string
    phone: string
  }
  createdAt: string
  updatedAt: string
}

export type SortOption =
  | 'featured'
  | 'newest'
  | 'price-asc'
  | 'price-desc'
  | 'best-selling'

export interface GuestOrder {
  id: string
  email: string
  orderNumber: string
  verificationToken: string
  createdAt: string
}

export interface ProductReview {
  id: string
  productId: string
  customerId: string
  rating: number
  title: string
  comment?: string
  verified: boolean
  createdAt: string
  customerName?: string
}

export interface ProductReviewStats {
  productId: string
  reviewCount: number
  averageRating: number
}

export interface Customer {
  id: string
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  createdAt: string
}

export interface Cart {
  id: string
  customerId: string
  createdAt: string
  updatedAt: string
}

export interface CartItem {
  id: string
  cartId: string
  productId: string
  color: string
  size: Size
  quantity: number
  createdAt: string
}

export interface AdminUser {
  userId: string
  role: 'admin' | 'super_admin'
  createdAt: string
}
