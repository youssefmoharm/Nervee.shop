import type { Product, CartLine } from '../types';

export interface RecommendationOptions {
  limit?: number;
  excludeProductIds?: string[];
  category?: string;
}

/**
 * Score a product for recommendations based on:
 * - Category match (40%)
 * - Price proximity (30%)
 * - Trending/Best seller status (30%)
 */
function scoreProduct(
  product: Product,
  referenceProduct: Product,
  categoryWeights: Record<string, number>,
  cartItems: CartLine[],
): number {
  // Don't recommend products already in cart
  const inCart = cartItems.some(item => item.productId === product.id);
  if (inCart) return -1;

  // Category match: +0.4 if same category or if category has been viewed before
  let categoryScore = 0;
  if (product.category === referenceProduct.category) {
    categoryScore = 0.4;
  } else if (categoryWeights[product.category]) {
    categoryScore = Math.min(0.4, 0.2 + categoryWeights[product.category] * 0.05);
  }

  // Price proximity: +0.3 if within 20% of reference price
  let priceScore = 0;
  const priceDiff = Math.abs(product.price - referenceProduct.price);
  const priceRange = referenceProduct.price * 0.2;
  if (priceDiff <= priceRange) {
    priceScore = 0.3 * (1 - priceDiff / priceRange / 2);
  }

  // Best seller status: +0.3 if best seller
  const trendingScore = product.isBestSeller ? 0.3 : 0.1;

  return categoryScore + priceScore + trendingScore;
}

export const recommendationService = {
  /**
   * Get recommendations based on browsing history and cart state
   */
  getRecommendations(
    product: Product,
    allProducts: Product[],
    options: RecommendationOptions & {
      viewedProductIds?: string[];
      categoryWeights: Record<string, number>;
      cartItems: CartLine[];
    },
  ): Product[] {
    const { limit = 6, excludeProductIds = [], categoryWeights, cartItems } = options;

    const scored = allProducts
      .filter(p => {
        // Don't recommend the product itself
        if (p.id === product.id) return false;
        // Don't recommend excluded products
        if (excludeProductIds.includes(p.id)) return false;
        // Must have in-stock items
        if (!p.sizes.some(s => s.inStock)) return false;
        return true;
      })
      .map(p => ({
        product: p,
        score: scoreProduct(p, product, categoryWeights, cartItems),
      }))
      .filter(s => s.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.product);

    return scored;
  },

  /**
   * Get homepage recommendations based on browsing history
   */
  getHomepageRecommendations(
    allProducts: Product[],
    options: {
      viewedProductIds: string[];
      categoryWeights: Record<string, number>;
      cartItems: CartLine[];
      limit?: number;
    },
  ): Product[] {
    const { viewedProductIds, categoryWeights, cartItems, limit = 6 } = options;

    // Get top viewed categories
    const topCategories = Object.entries(categoryWeights)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([cat]) => cat);

    // If no browsing history, recommend best sellers
    if (topCategories.length === 0) {
      return allProducts
        .filter(p => p.isBestSeller && p.sizes.some(s => s.inStock))
        .slice(0, limit);
    }

    // Score products based on matching top categories
    const scored = allProducts
      .filter(p => {
        // Don't recommend recently viewed
        if (viewedProductIds.includes(p.id)) return false;
        // Don't recommend products in cart
        if (cartItems.some(item => item.productId === p.id)) return false;
        // Must be in stock
        if (!p.sizes.some(s => s.inStock)) return false;
        return true;
      })
      .map(p => {
        const categoryMatch = topCategories.includes(p.category) ? 0.6 : 0;
        const bestSellerBonus = p.isBestSeller ? 0.3 : 0;
        return {
          product: p,
          score: categoryMatch + bestSellerBonus + Math.random() * 0.1,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.product);

    return scored;
  },

  /**
   * Get cart recommendations - products that complement cart items
   */
  getCartRecommendations(
    allProducts: Product[],
    cartItems: CartLine[],
    options: {
      limit?: number;
    },
  ): Product[] {
    const { limit = 4 } = options;

    // Find categories of products in cart
    const cartCategories = cartItems
      .map(item => allProducts.find(p => p.id === item.productId)?.category)
      .filter(Boolean) as string[];

    // Get products from same categories with good complementary price
    const avgCartPrice = cartItems.reduce((sum, item) => sum + item.price, 0) / cartItems.length;

    const scored = allProducts
      .filter(p => {
        // Don't recommend products already in cart
        if (cartItems.some(item => item.productId === p.id)) return false;
        // Must be in stock
        if (!p.sizes.some(s => s.inStock)) return false;
        return true;
      })
      .map(p => {
        // Bonus if in same category as cart items
        const categoryBonus = cartCategories.includes(p.category) ? 0.4 : 0;
        // Bonus if price is within 30% of average
        const priceDiff = Math.abs(p.price - avgCartPrice);
        const priceRange = avgCartPrice * 0.3;
        const priceBonus = priceDiff <= priceRange ? 0.3 : 0.1;
        // Bonus for best sellers
        const bestSellerBonus = p.isBestSeller ? 0.2 : 0;

        return {
          product: p,
          score: categoryBonus + priceBonus + bestSellerBonus,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.product);

    return scored;
  },
};
