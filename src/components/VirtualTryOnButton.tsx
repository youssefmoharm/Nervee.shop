import { Sparkles } from 'lucide-react';
import type { Product } from '../types';
import { resolveProductTryOnConfig } from '../lib/tryOnConfig';

interface VirtualTryOnButtonProps {
  product: Product;
  onClick: () => void;
  /** Visual variant to fit the product page layout. */
  variant?: 'outline' | 'ghost';
}

/**
 * Try-On entry point. Renders nothing unless the product has a resolvable
 * AR config — products without a lens simply never show a broken button.
 */
export default function VirtualTryOnButton({
  product,
  onClick,
  variant = 'outline',
}: VirtualTryOnButtonProps) {
  const config = resolveProductTryOnConfig(product);
  if (!config) return null;

  const base =
    'mt-3 w-full nv-eyebrow py-4 transition-colors flex items-center justify-center gap-2';
  const styles =
    variant === 'outline'
      ? 'border border-yellow-500 text-yellow-600 hover:bg-yellow-50'
      : 'text-navy hover:bg-mist';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${styles}`}
      aria-label={`Try on ${product.name} in AR`}
    >
      <Sparkles size={15} />
      {config.label ? <span className="sr-only">{config.label}</span> : null}
      Try in AR
    </button>
  );
}
