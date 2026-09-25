/**
 * Guards against seed/placeholder image hosts rendering in production.
 *
 * The catalog was seeded with picsum.photos stand-ins (supabase/seed.sql).
 * Until real photography is uploaded, production swaps those URLs for the
 * local branded fallback instead of showing random stock photos as products.
 * Development keeps the placeholders so flows stay previewable.
 */

const PLACEHOLDER_HOSTS = [
  'picsum.photos',
  'loremflickr.com',
  'placeholder.com',
  'placehold.co',
  'via.placeholder.com',
  'dummyimage.com',
];

export const PRODUCT_FALLBACK_IMAGE = '/placeholder-product.jpg';

export function isPlaceholderSrc(src?: string | null): boolean {
  if (!src) return false;
  const lower = src.toLowerCase();
  return PLACEHOLDER_HOSTS.some(host => lower.includes(host));
}

/** Returns a safe URL for rendering: placeholder hosts map to the local fallback in prod. */
export function safeImageSrc(src?: string | null): string {
  if (src && (!import.meta.env.PROD || !isPlaceholderSrc(src))) return src;
  return PRODUCT_FALLBACK_IMAGE;
}
