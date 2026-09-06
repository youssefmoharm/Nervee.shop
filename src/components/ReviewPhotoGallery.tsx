import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface ReviewPhotoGalleryProps {
  photos: string[];
}

export default function ReviewPhotoGallery({ photos }: ReviewPhotoGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);

  if (photos.length === 0) return null;

  const currentPhoto = photos[currentPhotoIdx];

  const handleNext = () => {
    setCurrentPhotoIdx(prev => (prev + 1) % photos.length);
  };

  const handlePrev = () => {
    setCurrentPhotoIdx(prev => (prev - 1 + photos.length) % photos.length);
  };

  return (
    <>
      {/* Thumbnail grid - Desktop */}
      <div className="hidden md:flex flex-wrap gap-2 mt-2">
        {photos.map((photo, i) => (
          <button
            key={i}
            onClick={() => {
              setCurrentPhotoIdx(i);
              setLightboxOpen(true);
            }}
            className="relative w-12 h-12 rounded-lg overflow-hidden border border-navy/10 hover:border-navy transition-colors"
          >
            <img src={photo} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {/* Mobile - Single thumbnail with view link */}
      <div className="md:hidden mt-2">
        <button
          onClick={() => setLightboxOpen(true)}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          View {photos.length} photo{photos.length !== 1 ? 's' : ''}
        </button>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl max-h-[90vh]">
            {/* Main image */}
            <img src={currentPhoto} alt="" className="w-full h-full object-contain rounded-lg" />

            {/* Close button */}
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/75 rounded-full text-white transition-colors"
              aria-label="Close lightbox"
            >
              <X size={24} />
            </button>

            {/* Previous button */}
            {photos.length > 1 && (
              <button
                onClick={handlePrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/75 rounded-full text-white transition-colors"
                aria-label="Previous photo"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            {/* Next button */}
            {photos.length > 1 && (
              <button
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/75 rounded-full text-white transition-colors"
                aria-label="Next photo"
              >
                <ChevronRight size={24} />
              </button>
            )}

            {/* Photo counter */}
            {photos.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                {currentPhotoIdx + 1} / {photos.length}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
