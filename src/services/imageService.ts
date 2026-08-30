import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Image storage structure:
 * /products/{slug}/{color}/{01-front,02-back,03-detail,04-on-model}.jpg
 *
 * Example: /products/nerve-core-tee/navy/01-front.jpg
 */

export type ImageSize = 'thumbnail' | 'card' | 'full';
export type ImageType = '01-front' | '02-back' | '03-detail' | '04-on-model';

const STORAGE_BUCKET = 'product-images';
const PLACEHOLDER_BASE = 'https://picsum.photos/seed';

interface ImageOptions {
  size?: ImageSize;
  quality?: number;
}

// Responsive image size mappings
const SIZE_MAP: Record<ImageSize, { width: number; height: number }> = {
  thumbnail: { width: 150, height: 188 },
  card: { width: 450, height: 563 },
  full: { width: 900, height: 1125 },
};

/**
 * Get the URL for a product image from Supabase Storage or fallback to placeholder
 */
export function getProductImageUrl(
  slug: string,
  color: string,
  imageType: ImageType = '01-front',
  options: ImageOptions = {},
): string {
  const { size = 'card', quality = 80 } = options;

  // If Supabase is not configured, return placeholder
  if (!isSupabaseConfigured) {
    const { width, height } = SIZE_MAP[size];
    return `${PLACEHOLDER_BASE}/${slug}-${color}-${imageType}/${width}/${height}`;
  }

  // Build Supabase Storage path
  const path = `products/${slug}/${color}/${imageType}.jpg`;

  // Get public URL with transformation
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path, {
    transform: {
      width: SIZE_MAP[size].width,
      height: SIZE_MAP[size].height,
      quality,
    },
  });

  return data.publicUrl;
}

/**
 * Get multiple images for a product (gallery view)
 */
export function getProductGallery(slug: string, color: string, size: ImageSize = 'full'): string[] {
  const imageTypes: ImageType[] = ['01-front', '02-back', '03-detail', '04-on-model'];
  return imageTypes.map(type => getProductImageUrl(slug, color, type, { size }));
}

/**
 * Generate srcSet for responsive images
 */
export function getImageSrcSet(
  slug: string,
  color: string,
  imageType: ImageType = '01-front',
): string {
  const sizes: ImageSize[] = ['thumbnail', 'card', 'full'];
  return sizes
    .map(size => {
      const url = getProductImageUrl(slug, color, imageType, { size });
      const width = SIZE_MAP[size].width;
      return `${url} ${width}w`;
    })
    .join(', ');
}

/**
 * Upload a product image (admin functionality)
 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const SAFE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_COLOR_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const ALLOWED_IMAGE_TYPES_SET: ReadonlySet<ImageType> = new Set<ImageType>([
  '01-front',
  '02-back',
  '03-detail',
  '04-on-model',
]);

export async function uploadProductImage(
  file: File,
  slug: string,
  color: string,
  imageType: ImageType,
): Promise<{ success: boolean; error?: string; url?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase not configured' };
  }

  // ---- Validation: size/type/path traversal ----
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return {
      success: false,
      error: `Invalid file type ${file.type}. Allowed: JPG, PNG, WEBP, AVIF`,
    };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      success: false,
      error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB`,
    };
  }
  if (
    !SAFE_SLUG_RE.test(slug) ||
    !SAFE_COLOR_RE.test(color) ||
    !ALLOWED_IMAGE_TYPES_SET.has(imageType)
  ) {
    return { success: false, error: 'Invalid slug, color, or imageType' };
  }
  // Prevent path traversal via slug/color
  if (slug.includes('..') || color.includes('..') || slug.includes('/') || color.includes('/')) {
    return { success: false, error: 'Invalid path' };
  }

  try {
    const path = `products/${slug}/${color}/${imageType}.jpg`;

    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
      cacheControl: '31536000', // 1 year
      upsert: true, // Overwrite if exists
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const url = getProductImageUrl(slug, color, imageType);
    return { success: true, url };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Delete a product image (admin functionality)
 */
export async function deleteProductImage(
  slug: string,
  color: string,
  imageType: ImageType,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase not configured' };
  }
  if (
    !SAFE_SLUG_RE.test(slug) ||
    !SAFE_COLOR_RE.test(color) ||
    !ALLOWED_IMAGE_TYPES_SET.has(imageType)
  ) {
    return { success: false, error: 'Invalid slug, color, or imageType' };
  }

  try {
    const path = `products/${slug}/${color}/${imageType}.jpg`;

    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}

/**
 * Generate alt text for accessibility
 */
export function getImageAltText(productName: string, color: string, imageType: ImageType): string {
  const typeLabel = {
    '01-front': 'front view',
    '02-back': 'back view',
    '03-detail': 'detail shot',
    '04-on-model': 'on model',
  }[imageType];

  return `${productName} in ${color} - ${typeLabel}`;
}
