/**
 * Optimized Image Component for NERVE
 *
 * Features:
 * - Lazy loading for performance
 * - Blur placeholders for better UX
 * - Aspect ratio preservation
 * - Accessibility improvements
 *
 * Note: srcset/format rewrites were removed on purpose — the catalog has no
 * resize endpoint or alternate AVIF/WebP files, so fabricated URLs 404'd.
 */

import { useState, HTMLAttributes } from 'react';
import { safeImageSrc } from '../lib/images';

interface OptimizedImageProps extends Omit<HTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  className?: string;
  blurPlaceholder?: boolean;
  lazy?: boolean;
  priority?: boolean;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  loading?: 'eager' | 'lazy';
}

export default function OptimizedImage({
  src = '',
  alt = '',
  width,
  height,
  aspectRatio,
  className = '',
  blurPlaceholder = true,
  lazy = true,
  priority = false,
  objectFit = 'cover',
  loading,
  style,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  const determineLoading = (): 'eager' | 'lazy' => {
    if (loading) return loading;
    if (priority) return 'eager';
    return lazy ? 'lazy' : 'eager';
  };

  return (
    <div
      className={`relative overflow-hidden ${aspectRatio ? aspectRatio : ''} ${className}`}
      style={{
        aspectRatio: aspectRatio ? undefined : `${width || 1} / ${height || 1}`,
        ...(style || {}),
      }}
    >
      {!isLoaded && blurPlaceholder && (
        <div
          className="absolute inset-0 bg-gray-200 animate-pulse"
          style={{
            backgroundColor: '#e5e5e5',
          }}
        />
      )}

      <img
        decoding="async"
        src={safeImageSrc(src)}
        alt={alt}
        width={width}
        height={height}
        loading={determineLoading()}
        onLoad={handleLoad}
        onError={handleError}
        className={`
          w-full h-full transition-opacity duration-300
          ${isLoaded ? 'opacity-100' : 'opacity-0'}
          ${hasError ? 'hidden' : 'block'}
        `}
        style={{
          objectFit,
        }}
      />

      {/* Error state placeholder */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400">
          <span className="text-sm">Image unavailable</span>
        </div>
      )}

      {/* Optional: Loading indicator */}
      {!isLoaded && !blurPlaceholder && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      )}
    </div>
  );
}

/**
 * Hook for lazy loading images with Intersection Observer
 */
export function useLazyImage() {
  const loadImages = (refs: React.RefObject<HTMLImageElement>[]) => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          if (img.dataset.src) {
            img.src = img.dataset.src;
          }
          observer.unobserve(img);
        }
      });
    });

    refs.forEach(ref => {
      if (ref.current) {
        observer.observe(ref.current);
      }
    });

    return () => observer.disconnect();
  };

  return { loadImages };
}

/**
 * Image gallery component for product pages
 */
interface ImageGalleryProps {
  images: { url: string; alt: string }[];
  thumbnailSize?: number;
}

export function ImageGallery({ images, thumbnailSize = 80 }: ImageGalleryProps) {
  const [currentImage, setCurrentImage] = useState(images[0]?.url || '');

  return (
    <div className="flex flex-col gap-4">
      <div className="aspect-square w-full rounded-lg overflow-hidden bg-gray-100">
        {images[0] && (
          <OptimizedImage
            src={images[0].url}
            alt={images[0].alt}
            className="w-full h-full object-cover"
            priority
          />
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {images.map((image, index) => (
          <button
            key={index}
            onClick={() => setCurrentImage(image.url)}
            className={`
              w-20 h-20 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all
              ${currentImage === image.url ? 'border-navy' : 'border-transparent'}
            `}
          >
            <OptimizedImage
              src={image.url}
              alt={image.alt}
              width={thumbnailSize}
              height={thumbnailSize}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
