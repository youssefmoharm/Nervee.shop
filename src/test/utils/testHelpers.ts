import { vi } from 'vitest'
import type { CartLine, Product, Order, User } from '../../types'

// Mock functions for common test scenarios
export const mockSupabaseResponse = <T>(data: T[] | T | null, error?: string) => {
  return {
    data,
    error: error ? { message: error } : null,
    count: Array.isArray(data) ? data.length : data ? 1 : 0
  }
}

export const mockAuthUser = (overrides: Partial<User> = {}): User => ({
  id: 'test-user-id',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'customer',
  createdAt: new Date().toISOString(),
  ...overrides
})

export const mockProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'test-product-1',
  slug: 'test-product',
  name: 'Test Product',
  category: 'T-Shirts',
  collectionId: 'collection-1',
  price: 299.99,
  currency: 'EGP',
  colors: [
    { name: 'Black', hex: '#000000', image: '/black.jpg' },
    { name: 'White', hex: '#FFFFFF', image: '/white.jpg' }
  ],
  sizes: [
    { size: 'M', inStock: true },
    { size: 'L', inStock: true }
  ],
  badge: 'NEW',
  description: 'Test product description',
  material: '100% Cotton',
  care: ['Machine wash cold', 'Tumble dry low'],
  gallery: ['/product1.jpg', '/product2.jpg'],
  isBestSeller: false,
  createdAt: new Date().toISOString(),
  ...overrides
})

export const mockCartLine = (overrides: Partial<CartLine> = {}): CartLine => ({
  productId: 'test-product-1',
  name: 'Test Product',
  slug: 'test-product',
  image: '/test-product.jpg',
  price: 299.99,
  color: 'Black',
  size: 'M',
  quantity: 1,
  ...overrides
})

export const mockOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'test-order-1',
  customerId: 'test-user-id',
  status: 'pending',
  items: [mockCartLine()],
  subtotal: 299.99,
  shippingFee: 50,
  discount: 0,
  total: 349.99,
  paymentMethod: 'cod',
  paymentStatus: 'pending',
  shippingAddress: {
    street: '123 Test Street',
    city: 'Cairo',
    governorate: 'cairo',
    phone: '01234567890'
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
})

// Test utilities for calculations
export const calculateSubtotal = (items: CartLine[]): number => {
  return items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
}

export const calculateShipping = (governorate: string, subtotal: number): number => {
  const freeShippingThreshold = 1000
  if (subtotal >= freeShippingThreshold) return 0
  
  const shippingRates: Record<string, number> = {
    cairo: 50,
    giza: 50,
    alexandria: 75,
    default: 100
  }
  
  return shippingRates[governorate] || shippingRates.default
}

export const calculateDiscount = (
  subtotal: number, 
  discountType: 'percentage' | 'fixed', 
  discountValue: number,
  minimumAmount: number = 0
): number => {
  if (subtotal < minimumAmount) return 0
  
  if (discountType === 'percentage') {
    return Math.min(subtotal * (discountValue / 100), subtotal)
  } else {
    return Math.min(discountValue, subtotal)
  }
}

export const calculateTotal = (subtotal: number, shipping: number, discount: number): number => {
  return Math.max(0, subtotal + shipping - discount)
}

// Mock API responses
export const mockApiSuccess = <T>(data: T) => {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data)
  })
}

export const mockApiError = (status: number, message: string) => {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: message })
  })
}

// Test data generators
export const generateTestProducts = (count: number): Product[] => {
  return Array.from({ length: count }, (_, i) => mockProduct({
    id: `test-product-${i + 1}`,
    name: `Test Product ${i + 1}`,
    price: 199.99 + (i * 50),
    category: ['T-Shirts', 'Hoodies', 'Pants'][i % 3] as any
  }))
}

export const generateTestOrders = (count: number): Order[] => {
  return Array.from({ length: count }, (_, i) => mockOrder({
    id: `test-order-${i + 1}`,
    status: ['pending', 'processing', 'shipped', 'delivered'][i % 4] as any,
    total: 299.99 + (i * 100)
  }))
}

// Validation helpers
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^(\+20)?01[0-9]{9}$/
  return phoneRegex.test(phone.replace(/\s/g, ''))
}

export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Mock timers and delays
export const mockDelay = (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const advanceTime = (ms: number) => {
  vi.advanceTimersByTime(ms)
}

// Test cleanup helpers
export const cleanupTestData = () => {
  localStorage.clear()
  sessionStorage.clear()
}

// Performance testing helpers
export const measurePerformance = async <T>(
  fn: () => Promise<T> | T, 
  description: string
): Promise<{ result: T; duration: number }> => {
  const start = performance.now()
  const result = await fn()
  const end = performance.now()
  const duration = end - start
  
  console.log(`${description}: ${duration.toFixed(2)}ms`)
  
  return { result, duration }
}

// Mock localStorage and sessionStorage
export const mockStorage = () => {
  const storage: Record<string, string> = {}
  
  return {
    getItem: (key: string) => storage[key] || null,
    setItem: (key: string, value: string) => { storage[key] = value },
    removeItem: (key: string) => { delete storage[key] },
    clear: () => { Object.keys(storage).forEach(key => delete storage[key]) },
    length: Object.keys(storage).length,
    key: (index: number) => Object.keys(storage)[index] || null
  }
}

// Database test helpers
export const mockDatabaseSuccess = <T>(data: T) => {
  return {
    data,
    error: null,
    status: 200,
    statusText: 'OK'
  }
}

export const mockDatabaseError = (message: string) => {
  return {
    data: null,
    error: { message, details: '', hint: '', code: '' },
    status: 400,
    statusText: 'Bad Request'
  }
}

// Test assertion helpers
export const expectToBePrice = (value: string | number, expectedPrice: number) => {
  const numericValue = typeof value === 'string' 
    ? parseFloat(value.replace(/[^\d.]/g, ''))
    : value
  expect(numericValue).toBeCloseTo(expectedPrice, 2)
}

export const expectToBeValidDate = (dateString: string) => {
  const date = new Date(dateString)
  expect(date).toBeInstanceOf(Date)
  expect(date.getTime()).not.toBeNaN()
}

export const expectToBeValidUUID = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  expect(uuid).toMatch(uuidRegex)
}

// Mock React hooks for testing
export const mockUseAuth = (user: User | null = null, loading: boolean = false) => {
  return vi.mocked({
    user,
    loading,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn()
  })
}

export const mockUseCart = (lines: CartLine[] = [], count: number = 0, subtotal: number = 0) => {
  return vi.mocked({
    lines,
    count,
    subtotal,
    isOpen: false,
    openCart: vi.fn(),
    closeCart: vi.fn(),
    addLine: vi.fn(),
    removeLine: vi.fn(),
    updateQuantity: vi.fn(),
    clear: vi.fn(),
    lastAdded: null
  })
}