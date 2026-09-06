import { useQuickView } from '../context/QuickViewContext';

/**
 * Custom hook for managing product quick view state
 * Provides convenient access to quick view context
 */
export function useProductQuickView() {
  return useQuickView();
}
