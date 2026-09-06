import { useEffect } from 'react';
import { addStructuredData } from '../lib/seo';

/**
 * Hook to add JSON-LD structured data to page
 * Usage: useStructuredData({ '@type': 'Product', name: 'My Product' })
 *        useStructuredData(data, 'product-structured-data')
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useStructuredData(data: Record<string, any>): void {
  useEffect(() => {
    if (!data || Object.keys(data).length === 0) return;

    const cleanup = addStructuredData(data);

    return cleanup;
  }, [data]);
}
