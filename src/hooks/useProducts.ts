import { useQuery, useQueryClient } from '@tanstack/react-query'
import { productService } from '../services/productService'
import type { ShopFilters } from '../services/productService'

export function useProducts(filters: ShopFilters = {}) {
  return useQuery(['products', filters], () => productService.list(filters))
}

export function useProduct(slug: string | undefined) {
  return useQuery(['product', slug], () => (slug ? productService.getBySlug(slug) : undefined), {
    enabled: !!slug,
  })
}

export function usePrefetchProduct() {
  const qc = useQueryClient()
  return (slug: string) => qc.prefetchQuery(['product', slug], () => productService.getBySlug(slug))
}
