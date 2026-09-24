import { useEffect } from 'react';
import { addStructuredData } from '../lib/seo';

/**
 * Hook to add JSON-LD structured data to page
 * Usage: useStructuredData({ '@type': 'Product', name: 'My Product' })
 *        useStructuredData(data, 'product-structured-data')
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useStructuredData(data: Record<string, any>): void {
  // Serialize so the effect only re-runs when values change — inline object
  // literals are new every render and would thrash the DOM script tag.
  const key = JSON.stringify(data);

  useEffect(() => {
    if (!key || key === '{}') return;
    const parsed = JSON.parse(key) as Record<string, any>;
    return addStructuredData(parsed);
  }, [key]);
}
