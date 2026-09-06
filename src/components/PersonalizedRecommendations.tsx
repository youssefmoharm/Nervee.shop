import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '../types';
import { productService } from '../services/productService';
import { recommendationService } from '../services/recommendationService';
import { useBrowsingHistory } from '../context/BrowsingHistoryContext';
import { useCart } from '../context/CartContext';
import ProductCard from './ProductCard';

interface PersonalizedRecommendationsProps {
  currentProduct?: Product;
  position?: 'below-description' | 'above-footer' | 'in-cart';
  title?: string;
  limit?: number;
}

export default function PersonalizedRecommendations({
  currentProduct,
  position = 'above-footer',
  title = 'Recommended For You',
  limit = 6,
}: PersonalizedRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const { categoryWeights, getViewedProducts } = useBrowsingHistory();
  const { lines: cartItems } = useCart();

  useEffect(() => {
    const loadRecommendations = async () => {
      try {
        const allProducts = await productService.list();

        let recommendations: Product[] = [];

        if (currentProduct) {
          // Product detail page recommendations
          recommendations = recommendationService.getRecommendations(currentProduct, allProducts, {
            limit,
            excludeProductIds: [currentProduct.id],
            viewedProductIds: getViewedProducts(),
            categoryWeights,
            cartItems,
          });
        } else if (position === 'in-cart') {
          // Cart page recommendations
          recommendations = recommendationService.getCartRecommendations(allProducts, cartItems, {
            limit,
          });
        } else {
          // Homepage recommendations
          recommendations = recommendationService.getHomepageRecommendations(allProducts, {
            viewedProductIds: getViewedProducts(),
            categoryWeights,
            cartItems,
            limit,
          });
        }

        setRecommendations(recommendations);
      } catch (error) {
        console.error('Failed to load recommendations:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRecommendations();
  }, [currentProduct, position, limit, categoryWeights, getViewedProducts, cartItems]);

  if (loading || recommendations.length === 0) {
    return null;
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const visibleCount = isMobile ? 2 : 4;
  const totalPages = Math.ceil(recommendations.length / visibleCount);

  const handlePrev = () => {
    setCarouselIdx(i => (i - 1 + totalPages) % totalPages);
  };

  const handleNext = () => {
    setCarouselIdx(i => (i + 1) % totalPages);
  };

  const visibleItems = recommendations.slice(
    carouselIdx * visibleCount,
    (carouselIdx + 1) * visibleCount,
  );

  const containerClass = {
    'below-description': 'mt-16 pt-12 border-t border-navy/10',
    'above-footer': 'mt-20 pt-12 border-t border-navy/10',
    'in-cart': 'mt-12 pt-8',
  }[position];

  return (
    <div className={containerClass}>
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="nv-heading text-2xl md:text-3xl">{title}</h2>
          {totalPages > 1 && (
            <div className="flex gap-2">
              <button
                onClick={handlePrev}
                className="p-2 hover:bg-mist rounded-full transition-colors"
                aria-label="Previous recommendations"
              >
                <ChevronLeft size={20} className="text-navy" />
              </button>
              <button
                onClick={handleNext}
                className="p-2 hover:bg-mist rounded-full transition-colors"
                aria-label="Next recommendations"
              >
                <ChevronRight size={20} className="text-navy" />
              </button>
            </div>
          )}
        </div>

        {/* Desktop Grid */}
        <div className="hidden md:grid grid-cols-4 gap-x-5 gap-y-10">
          {visibleItems.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* Mobile Carousel */}
        <div className="md:hidden">
          <div className="grid grid-cols-2 gap-x-3 gap-y-6">
            {visibleItems.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCarouselIdx(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === carouselIdx ? 'bg-navy' : 'bg-navy/20'
                  }`}
                  aria-label={`Go to page ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
