import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageSliderProps {
  images?: string[];
  fallbackEmoji?: string;
  altText?: string;
  isModal?: boolean;
  isCompact?: boolean;
}

const ImageSlider: React.FC<ImageSliderProps> = ({
  images = [],
  fallbackEmoji = '🎁',
  altText = 'Product',
  isModal = false,
  isCompact = false
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);

  const hasImages = images && images.length > 0;
  const totalImages = hasImages ? images.length : 1;

  const goToSlide = (index: number) => {
    if (index < 0) {
      setCurrentIndex(totalImages - 1);
    } else if (index >= totalImages) {
      setCurrentIndex(0);
    } else {
      setCurrentIndex(index);
    }
  };

  const goToPrevious = () => {
    goToSlide(currentIndex - 1);
  };

  const goToNext = () => {
    goToSlide(currentIndex + 1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 75) {
      goToNext();
    }

    if (touchStart - touchEnd < -75) {
      goToPrevious();
    }
  };

  useEffect(() => {
    setCurrentIndex(0);
  }, [images]);

  return (
    <div className="relative w-full">
      <div
        ref={sliderRef}
        className={`relative bg-gradient-to-br from-primary-100 to-primary-200 overflow-hidden ${isCompact
            ? 'h-32 rounded-xl'
            : isModal
              ? 'aspect-square rounded-none'
              : 'h-56 rounded-2xl'
          }`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {hasImages ? (
          <div className="relative h-full">
            <div
              className="flex h-full transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              {images.map((image, index) => (
                <div key={index} className="w-full h-full flex-shrink-0">
                  <img
                    src={image}
                    alt={`${altText} ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      if (target.nextSibling) {
                        (target.nextSibling as HTMLElement).style.display = 'flex';
                      }
                    }}
                  />
                  <div className="w-full h-full hidden items-center justify-center text-6xl">
                    {fallbackEmoji}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-6xl">{fallbackEmoji}</div>
          </div>
        )}

        {hasImages && totalImages > 1 && !isCompact && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>

            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5 text-gray-700" />
            </button>
          </>
        )}
      </div>


    </div>
  );
};

export default ImageSlider;
