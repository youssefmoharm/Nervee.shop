import { Link } from 'react-router-dom';
import { useComparison } from '../hooks/useComparison';
import ComparisonModal from '../components/ComparisonModal';
import { ChevronRight } from 'lucide-react';

export default function Comparison() {
  const { items, remove, clear } = useComparison();

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-8">
          <Link to="/" className="text-navy/60 hover:text-navy transition-colors">
            Home
          </Link>
          <ChevronRight size={16} className="text-navy/40" />
          <span className="text-navy font-semibold">Product Comparison</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-navy mb-2">Product Comparison</h1>
          <p className="text-navy/70">
            Compare up to 3 products side-by-side to make the best choice
          </p>
        </div>

        {items.length === 0 ? (
          <div className="bg-mist rounded-lg p-12 text-center">
            <h2 className="text-xl font-semibold text-navy mb-2">No Products to Compare</h2>
            <p className="text-navy/70 mb-6">
              Start by adding products to your comparison from the shop
            </p>
            <Link
              to="/shop"
              className="inline-block bg-navy text-white px-6 py-3 rounded font-semibold hover:bg-navy-2 transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <>
            <ComparisonModal
              products={items}
              onClose={() => {}}
              onRemove={remove}
              onClear={clear}
            />
          </>
        )}
      </div>
    </div>
  );
}
