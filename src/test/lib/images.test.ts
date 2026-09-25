import { describe, expect, it, vi, afterEach } from 'vitest';
import { isPlaceholderSrc, safeImageSrc, PRODUCT_FALLBACK_IMAGE } from '../../lib/images';

describe('placeholder image guard (FLOW-01)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('detects seed placeholder hosts', () => {
    expect(isPlaceholderSrc('https://picsum.photos/600/800')).toBe(true);
    expect(isPlaceholderSrc('https://loremflickr.com/600/800')).toBe(true);
    expect(isPlaceholderSrc('https://placehold.co/600x800')).toBe(true);
    expect(isPlaceholderSrc('https://x.supabase.co/storage/v1/object/public/p/p.jpg')).toBe(false);
    expect(isPlaceholderSrc('')).toBe(false);
    expect(isPlaceholderSrc(null)).toBe(false);
  });

  it('keeps placeholder URLs in development so flows stay previewable', () => {
    expect(safeImageSrc('https://picsum.photos/600/800')).toBe('https://picsum.photos/600/800');
  });

  it('swaps placeholder URLs for the local fallback in production', () => {
    vi.stubEnv('PROD', true);
    expect(safeImageSrc('https://picsum.photos/600/800')).toBe(PRODUCT_FALLBACK_IMAGE);
    expect(safeImageSrc('https://cdn.example.com/real.jpg')).toBe(
      'https://cdn.example.com/real.jpg',
    );
  });

  it('falls back for missing images in any environment', () => {
    expect(safeImageSrc(undefined)).toBe(PRODUCT_FALLBACK_IMAGE);
    expect(safeImageSrc('')).toBe(PRODUCT_FALLBACK_IMAGE);
  });
});
