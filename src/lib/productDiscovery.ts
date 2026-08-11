import type { Product } from '../types'

export function normalizeSearchQuery(query: string) {
  return query.trim().toLowerCase()
}

export function getSearchSuggestions(products: Product[], query: string, limit = 5) {
  const normalized = normalizeSearchQuery(query)
  if (!normalized) return []

  const suggestions = new Set<string>()

  products.forEach((product) => {
    const haystack = [product.name, product.category, product.description, product.material]
      .join(' ')
      .toLowerCase()

    if (haystack.includes(normalized)) {
      if (product.name.toLowerCase().includes(normalized)) suggestions.add(product.name)
      if (product.category.toLowerCase().includes(normalized)) suggestions.add(product.category)
    }
  })

  return Array.from(suggestions).slice(0, limit)
}

export function filterProducts(
  products: Product[],
  query: string,
  category?: string | null,
  colors: string[] = [],
  sizes: string[] = [],
  priceMax?: number
) {
  const normalized = normalizeSearchQuery(query)

  let visible = [...products]

  if (normalized) {
    visible = visible.filter((product) => {
      const haystack = [product.name, product.category, product.description, product.material]
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalized)
    })
  }

  if (category) {
    visible = visible.filter((product) => product.category === category)
  }

  if (colors.length) {
    visible = visible.filter((product) => product.colors.some((color) => colors.includes(color.name)))
  }

  if (sizes.length) {
    visible = visible.filter((product) =>
      product.sizes.some((size) => sizes.includes(size.size) && size.inStock)
    )
  }

  if (priceMax != null) {
    visible = visible.filter((product) => product.price <= priceMax)
  }

  return visible
}
