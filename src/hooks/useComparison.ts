import { useComparison as useComparisonContext } from '../context/ComparisonContext';

/**
 * Hook to access the comparison context.
 * Provides methods to add/remove products from comparison and query state.
 */
export function useComparison() {
  return useComparisonContext();
}
