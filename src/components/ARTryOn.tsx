import { useEffect } from 'react';
import { X } from 'lucide-react';
import FocusTrap from 'focus-trap-react';
import type { Product } from '../types';
import TryOnExperience from './TryOnExperience';

interface ARTryOnProps {
  isOpen: boolean;
  onClose: () => void;
  /** The product being tried on — determines which AR lens loads. */
  product: Product | null;
  /** Currently selected color name (kept in the AR header for context). */
  colorName?: string;
}

/**
 * Virtual Try-On modal — a thin, accessible shell around TryOnExperience.
 *
 * - Focus-trapped, Escape-to-close, body scroll locked while open
 * - Renders nothing when closed (no AR resources are created until opened)
 * - All AR/session logic lives in TryOnExperience + useCameraKitSession
 */
export default function ARTryOn({ isOpen, onClose, product, colorName }: ARTryOnProps) {
  // Lock body scroll + close on Escape while the modal is open.
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close Virtual Try-On"
        onClick={onClose}
        className="absolute inset-0 bg-navy/70 border-0 p-0 cursor-default"
      />

      <FocusTrap active={isOpen}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tryon-modal-title"
          className="relative bg-white w-full max-w-md max-h-[92vh] overflow-y-auto nv-scroll shadow-2xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-navy/10 flex items-center justify-between px-6 py-5">
            <h2 id="tryon-modal-title" className="nv-heading text-lg uppercase">
              Try On {product.name}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Virtual Try-On"
              className="p-1.5 hover:bg-mist transition-colors"
            >
              <X size={20} className="text-navy" />
            </button>
          </div>

          {/* Experience */}
          <div className="p-6">
            <TryOnExperience product={product} colorName={colorName} onClose={onClose} />
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
