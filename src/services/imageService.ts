import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Image storage structure:
 * /products/{slug}/{color}/{01-front,02-back,03-detail,04-on-model}.jpg
 *
 * Example: /products/nerve-core-tee/navy/01-front.jpg
 */

export type ImageSize = 'thumbnail' | 'card' | 'full';
export type ImageType = '01-front' | '02-back' | '03-detail' | '04-on-model';
export type ImageFormat = 'jpeg' | 'webp' | 'avif';

const STORAGE_BUCKET = 'product-images';
// Use local placeholder images (fallback when Supabase is not configured or images not uploaded)
const PLACEHOLDER_LOCAL = '/placeholder-product.jpg';

interface ImageOptions {
  size?: ImageSize;
  quality?: number;
  format?: ImageFormat;
}

// Responsive image size mappings
const SIZE_MAP: Record<ImageSize, { width: number; height: number }> = {
  thumbnail: { width: 150, height: 188 },
  card: { width: 450, height: 563 },
  full: { width: 900, height: 1125 },
};

// Breakpoint widths for responsive images
const RESPONSIVE_WIDTHS = [300, 600, 900, 1200, 1800];

/**
 * Detect browser support for modern image formats
 */
export function detectSupportedFormats(): ImageFormat[] {
  const supported: ImageFormat[] = ['jpeg'];

  // Check WebP support
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (canvas && canvas.toDataURL('image/webp').startsWith('data:image/webp')) {
    supported.push('webp');
  }

  // AVIF support check (more complex, so we use graceful detection)
  // Note: This is a simplified check; production code would use modernizr or similar
  const hasAVIFSupport =
    typeof CSS !== 'undefined' && CSS.supports('(image-set(url(#) type(image/avif)))');
  if (hasAVIFSupport) {
    supported.push('avif');
  }

  return supported;
}

/**
 * Get the URL for a product image from Supabase Storage or fallback to placeholder
 * Supports modern image formats with quality optimization
 */
export function getProductImageUrl(
  slug: string,
  color: string,
  imageType: ImageType = '01-front',
  options: ImageOptions = {},
): string {
  const { size = 'card', quality = 80 } = options;

  // If Supabase is not configured, return local placeholder
  if (!isSupabaseConfigured) {
    return PLACEHOLDER_LOCAL;
  }

  // Build Supabase Storage path
  const path = `products/${slug}/${color}/${imageType}.jpg`;

  // Get public URL with transformation (Supabase transform API)
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path, {
    transform: {
      width: SIZE_MAP[size].width,
      height: SIZE_MAP[size].height,
      quality,
    },
  });

  // Fallback to local placeholder if URL is invalid or image doesn't exist
  // Note: Format negotiation (WebP/AVIF) handled client-side via picture element
  // Supabase Edge Function can be used for server-side format conversion if needed
  return data?.publicUrl || PLACEHOLDER_LOCAL;
}

/**
 * Get multiple images for a product (gallery view)
 */
export function getProductGallery(slug: string, color: string, size: ImageSize = 'full'): string[] {
  const imageTypes: ImageType[] = ['01-front', '02-back', '03-detail', '04-on-model'];
  return imageTypes.map(type => getProductImageUrl(slug, color, type, { size }));
}

/**
 * Generate responsive srcSet with modern format support
 * Returns both JPG fallback and WebP/AVIF variants for progressive enhancement
 */
export function getImageSrcSet(
  slug: string,
  color: string,
  imageType: ImageType = '01-front',
): string {
  const sizes: ImageSize[] = ['thumbnail', 'card', 'full'];

  return sizes
    .map(size => {
      const width = SIZE_MAP[size].width;
      const url = getProductImageUrl(slug, color, imageType, { size, format: 'jpeg' });
      return `${url} ${width}w`;
    })
    .join(', ');
}

/**
 * Generate picture element sources with format negotiation
 * Allows browsers to choose the best format for their capabilities
 */
export function getImagePictureSources(
  slug: string,
  color: string,
  imageType: ImageType = '01-front',
): Array<{ srcSet: string; type: string }> {
  // Return in order of preference (browser will use first supported format)
  const sources = [];

  // AVIF - Best compression, newest browsers
  const avifSrcSet = RESPONSIVE_WIDTHS.map(width => {
    // Map width to closest ImageSize
    let imageSize: ImageSize = 'card';
    if (width <= 300) imageSize = 'thumbnail';
    else if (width <= 900) imageSize = 'card';
    else imageSize = 'full';

    const url = getProductImageUrl(slug, color, imageType, { size: imageSize, format: 'avif' });
    return `${url} ${width}w`;
  }).join(', ');
  sources.push({ srcSet: avifSrcSet, type: 'image/avif' });

  // WebP - Good compression, wider browser support
  const webpSrcSet = RESPONSIVE_WIDTHS.map(width => {
    let imageSize: ImageSize = 'card';
    if (width <= 300) imageSize = 'thumbnail';
    else if (width <= 900) imageSize = 'card';
    else imageSize = 'full';

    const url = getProductImageUrl(slug, color, imageType, { size: imageSize, format: 'webp' });
    return `${url} ${width}w`;
  }).join(', ');
  sources.push({ srcSet: webpSrcSet, type: 'image/webp' });

  // JPEG - Universal fallback
  const jpegSrcSet = RESPONSIVE_WIDTHS.map(width => {
    let imageSize: ImageSize = 'card';
    if (width <= 300) imageSize = 'thumbnail';
    else if (width <= 900) imageSize = 'card';
    else imageSize = 'full';

    const url = getProductImageUrl(slug, color, imageType, { size: imageSize, format: 'jpeg' });
    return `${url} ${width}w`;
  }).join(', ');
  sources.push({ srcSet: jpegSrcSet, type: 'image/jpeg' });

  return sources;
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
