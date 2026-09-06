import { BarChart3 } from 'lucide-react';
import { useComparison } from '../hooks/useComparison';
import ComparisonModal from './ComparisonModal';
import { useState } from 'react';

export default function ComparisonWidget() {
  const { items, remove, clear } = useComparison();
  const [modalOpen, setModalOpen] = useState(false);

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      {/* Floating widget */}
      <button
        onClick={() => setModalOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-navy text-white shadow-lg flex items-center justify-center gap-2 hover:bg-navy-2 transition-all duration-200 hover:scale-110 animate-bounce"
        aria-label={`Compare ${items.length} products`}
      >
        <BarChart3 size={20} />
        <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
          {items.length}
        </span>
      </button>

      {/* Modal */}
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
