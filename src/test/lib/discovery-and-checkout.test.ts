import { describe, expect, it } from 'vitest'
import { getSearchSuggestions, filterProducts } from '../../lib/productDiscovery'
import { estimateShippingCost, getDeliveryEstimateLabel } from '../../lib/checkout'
import type { Product } from '../../types'

const sampleProducts: Product[] = [
  {
    id: '1',
    slug: 'oversized-tee',
    name: 'Oversized Tee',
    category: 'T-Shirts' as const,
    collectionId: 'c1',
    price: 650,
    currency: 'EGP' as const,
    colors: [{ name: 'Navy', hex: '#001f3f', image: '/a.jpg' }],
    sizes: [{ size: 'M' as const, inStock: true }],
    badge: null,
    description: 'Relaxed fit',
    material: 'Cotton',
    care: ['Machine wash'],
    gallery: ['/a.jpg'],
    isBestSeller: false,
    createdAt: '2024-01-01',
  },
  {
    id: '2',
    slug: 'slim-hoodie',
    name: 'Slim Hoodie',
    category: 'Hoodies' as const,
    collectionId: 'c2',
    price: 1200,
    currency: 'EGP' as const,
    colors: [{ name: 'Black', hex: '#000000', image: '/b.jpg' }],
    sizes: [{ size: 'L' as const, inStock: true }],
    badge: 'NEW',
    description: 'Layering staple',
    material: 'Cotton',
    care: ['Machine wash'],
    gallery: ['/b.jpg'],
    isBestSeller: true,
    createdAt: '2024-02-01',
  },
]

describe('product discovery helpers', () => {
  it('suggests matching product names for a partial query', () => {
    expect(getSearchSuggestions(sampleProducts, 'tee')).toEqual(['Oversized Tee'])
  })

  it('filters products by query and category', () => {
    const result = filterProducts(sampleProducts, 'hoodie', 'Hoodies')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Slim Hoodie')
  })
})

describe('checkout helpers', () => {
  it('estimates shipping cost for standard and express delivery', () => {
    expect(estimateShippingCost(1500, 'standard')).toBe(100)
    expect(estimateShippingCost(1500, 'express')).toBe(200)
    expect(estimateShippingCost(2500, 'standard')).toBe(0)
  })

  it('returns a friendly estimate label', () => {
    expect(getDeliveryEstimateLabel('standard', 1500)).toContain('2–5 business days')
    expect(getDeliveryEstimateLabel('express', 1500)).toContain('1–2 business days')
  })
})
