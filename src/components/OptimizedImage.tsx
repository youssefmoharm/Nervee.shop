/**
 * Optimized Image Component for NERVE
 *
 * Features:
 * - Automatic WebP/AVIF format conversion with JPEG fallback
 * - Lazy loading for performance
 * - Blur placeholders for better UX
 * - Responsive srcset generation
 * - Aspect ratio preservation
 * - Accessibility improvements
 */

import { useState, useEffect, HTMLAttributes } from 'react';

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
  const [formats, setFormats] = useState<string[]>([]);

  // Detect supported image formats
  useEffect(() => {
    const testFormats = async () => {
      const supportsWebp = await testWebp();
      const supportsAvif = await testAvif();

      const supportedFormats = [];
      if (supportsAvif) supportedFormats.push('avif');
      if (supportsWebp) supportedFormats.push('webp');
      supportedFormats.push('jpg', 'png'); // Fallbacks

      setFormats(supportedFormats);
    };

    testFormats();
  }, []);

  // Test WebP support
  const testWebp = async (): Promise<boolean> => {
    try {
      const webpData =
        'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOhlAAA=';
      const blob = await fetch(webpData).then(r => r.blob());
      return blob.size === 69;
    } catch {
      return false;
    }
  };

  // Test AVIF support
  const testAvif = async (): Promise<boolean> => {
    try {
      const avifData =
        'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAAD3BpdG0AAAAAAAEAAAAeaWxvYwAAAABkAAABAAEAAAABAAABGgAABdQAAAHUbWV0YQAAAAAAAAAwaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAAD3BpdG0AAAAAAAEAAAAeaWxvYwAAAABkAAABAAEAAAABAAABGgAABdQAAAHU';
      const blob = await fetch(avifData).then(r => r.blob());
      return blob.size > 0;
    } catch {
      return false;
    }
  };

  // Generate srcset for responsive images
  const generateSrcSet = (baseUrl: string): string => {
    const sizes = [320, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];

    return sizes
      .map(size => {
        // Generate URL with width parameter (assuming a resize endpoint)
        // Modify this based on your actual image CDN configuration
        return `${baseUrl}?w=${size} ${size}w`;
      })
      .join(', ');
  };

  // Generate final image URLs based on format support
  const getImageUrls = (originalSrc: string) => {
    const base = originalSrc.replace(/\.(jpg|jpeg|png|gif)$/i, '');

    return formats.map(format => {
      // Try to match existing format or add new one
      let url = originalSrc;
      if (originalSrc.match(/\.(jpg|jpeg|png)$/i)) {
        url = `${base}.${format}`;
      }
      return { format, url };
    });
  };

  // Handle image load success
  const handleLoad = () => {
    setIsLoaded(true);
  };

  // Handle image load error
  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  // Determine loading attribute
  const determineLoading = (): 'eager' | 'lazy' => {
    if (loading) return loading;
    if (priority) return 'eager';
    return lazy ? 'lazy' : 'eager';
  };

  // Construct image URLs for src and srcSet
  const imageUrls = getImageUrls(src);
  const srcset = imageUrls.length > 0 ? generateSrcSet(src) : undefined;

  // Use first supported format as src
  const primaryFormat = formats.find(f => ['avif', 'webp'].includes(f)) || 'jpg';
  const primarySrc = imageUrls.find(i => i.url.endsWith(primaryFormat))?.url || src;

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
        src={primarySrc}
        srcSet={srcset}
        alt={alt}
        width={width}
        height={height}
        loading={determineLoading()}
        onLoad={handleLoad}
        onError={handleError}
        className={`
          w-full h-full object-contain transition-opacity duration-300
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
