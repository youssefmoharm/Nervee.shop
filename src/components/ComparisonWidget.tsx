import { BarChart3 } from 'lucide-react';
import { useComparison } from '../hooks/useComparison';
import ComparisonModal from './ComparisonModal';
import { useState } from 'react';

/**
 * Compare FAB — positioning is owned by FloatingDock (parent).
 * Do not add fixed/absolute positioning here.
 */
export default function ComparisonWidget() {
  const { items, remove, clear } = useComparison();
  const [modalOpen, setModalOpen] = useState(false);

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="relative w-14 h-14 rounded-full bg-navy text-white shadow-lg flex items-center justify-center hover:bg-navy-2 transition-all duration-200 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
        aria-label={`Compare ${items.length} products`}
      >
        <BarChart3 size={20} aria-hidden="true" />
        <span className="absolute -top-1 -end-1 bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center tabular-nums">
          {items.length}
        </span>
      </button>

      {modalOpen && (
        <ComparisonModal
          products={items}
          onClose={() => setModalOpen(false)}
          onRemove={remove}
          onClear={clear}
        />
      )}
    </>
  );
}
