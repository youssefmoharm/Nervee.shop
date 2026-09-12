import { useState, useEffect } from 'react';
import type { ImageType, ImageSize } from '../services/imageService';
import {
  getProductImageUrl,
  getImagePictureSources,
  getImageAltText,
} from '../services/imageService';

interface OptimizedImageProps {
  slug: string;
  color: string;
  imageType?: ImageType;
  size?: ImageSize;
  productName?: string;
  onLoad?: () => void;
  onError?: () => void;
  className?: string;
  testId?: string;
}

/**
 * OptimizedImage Component
 *
 * Production-ready image rendering with:
 * - WebP/AVIF format negotiation
 * - Responsive sizes via srcSet
 * - Native lazy loading
 * - Error handling with fallback
 * - Accessibility (proper alt text)
 * - Performance (format detection, quality optimization)
 *
 * Usage:
 * <OptimizedImage
 *   slug="nerve-core-tee"
 *   color="navy"
 *   imageType="01-front"
 *   size="card"
 *   productName="NERVE Core Tee"
 *   className="w-full h-full object-cover"
 * />
 */
export default function OptimizedImage({
  slug,
  color,
  imageType = '01-front',
  size = 'card',
  productName = 'Product',
  onLoad,
  onError,
  className = '',
  testId,
}: OptimizedImageProps) {
  const [error, setError] = useState(false);
  const [supportsPicture, setSupportsPicture] = useState(true);

  // Check if browser supports <picture> element
  useEffect(() => {
    setSupportsPicture('picture' in document || true); // All modern browsers support it
  }, []);

  const altText = getImageAltText(productName, color, imageType);
  const pictureSource = getImagePictureSources(slug, color, imageType);
  const fallbackUrl = getProductImageUrl(slug, color, imageType, { size, format: 'jpeg' });

  const generatePlaceholder = () => {
    // Generate a beautiful placeholder using product name
    const text = encodeURIComponent(productName.split(' ').slice(0, 2).join(' '));
    return `https://placehold.co/600x750/F5F5F5/061735?text=${text}`;
  };

  const handleLoad = () => {
    onLoad?.();
  };

  const handleError = () => {
    // If image fails to load, sequence a fallback placeholder to prevent broken UI
    setError(true);
    onError?.();
    console.warn(`Image failed to load: ${slug}/${color}/${imageType}`);
  };

  // Fallback for older browsers or error case
  if (!supportsPicture || error) {
    return (
      <img
        src={error ? generatePlaceholder() : fallbackUrl}
        alt={altText}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={error ? undefined : handleError}
        className={className}
        data-testid={testId}
      />
    );
  }

  // Modern picture element with format negotiation
  return (
    <picture>
      {pictureSource.map((source, idx) => (
        <source
          key={`${source.type}-${idx}`}
          srcSet={source.srcSet}
          type={source.type}
          sizes="(max-width: 640px) 300px, (max-width: 1024px) 600px, 900px"
        />
      ))}
      <img
        src={fallbackUrl}
        alt={altText}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={className}
        data-testid={testId}
      />
    </picture>
  );
}
