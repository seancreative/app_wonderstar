import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Clock, Users, Calendar, Sparkles, ShoppingCart, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { EduWorkshop } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import { useShop } from '../contexts/ShopContext';

interface WorkshopDetailModalProps {
  workshop: EduWorkshop;
  onClose: () => void;
}

const WorkshopDetailModal: React.FC<WorkshopDetailModalProps> = ({ workshop, onClose }) => {
  const navigate = useNavigate();
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const { user } = useAuth();
  const { selectedOutlet } = useShop();

  const images = workshop.workshop_images && workshop.workshop_images.length > 0
    ? workshop.workshop_images
    : workshop.image_url
    ? [workshop.image_url]
    : [];

  const hasMultipleImages = images.length > 1;

  const handleReserve = () => {
    if (!user) {
      alert('Please login to book workshops');
      navigate('/welcome');
      return;
    }

    if (!workshop.linked_product_id) {
      alert('This workshop is not yet available for booking. Please check back later.');
      return;
    }

    if (!selectedOutlet) {
      navigate(`/shop?returnTo=/edu&productId=${workshop.linked_product_id}`);
    } else {
      navigate(`/shop/${selectedOutlet.slug}/product/${workshop.linked_product_id}?from=workshop`);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;

    if (Math.abs(distance) < minSwipeDistance) {
      setTouchStart(0);
      setTouchEnd(0);
      return;
    }

    if (distance > 0 && currentImageIndex < images.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
    } else if (distance < 0 && currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1);
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  const goToPrevImage = () => {
    setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const goToNextImage = () => {
    setCurrentImageIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md max-h-[95vh] bg-gradient-to-br from-yellow-50 via-white to-blue-50 rounded-t-2xl overflow-hidden shadow-2xl animate-slide-up border-t-4 border-yellow-300">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-1.5 bg-white/90 hover:bg-white rounded-full transition-colors shadow-lg"
        >
          <X className="w-5 h-5 text-gray-700" />
        </button>

        <div className="overflow-y-auto max-h-[95vh] scrollbar-hide">
          {images.length > 0 ? (
            <div
              className="relative w-full aspect-square bg-gradient-to-br from-blue-200 to-purple-200 overflow-hidden"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div
                className="flex transition-transform duration-300 ease-out h-full"
                style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
              >
                {images.map((image, index) => (
                  <div key={index} className="w-full h-full flex-shrink-0">
                    <img
                      src={image}
                      alt={`${workshop.title} - Image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>

              {hasMultipleImages && (
                <>
                  <button
                    onClick={goToPrevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/80 hover:bg-white rounded-full shadow-lg transition-all"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </button>
                  <button
                    onClick={goToNextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/80 hover:bg-white rounded-full shadow-lg transition-all"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </button>

                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${
                          index === currentImageIndex
                            ? 'bg-white w-4'
                            : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="w-full aspect-square bg-gradient-to-br from-yellow-200 via-orange-200 to-pink-200 flex items-center justify-center">
              <BookOpen className="w-20 h-20 text-yellow-600 opacity-50" />
            </div>
          )}

          <div className="p-4 pb-28 space-y-4 bg-white">
            <div className="relative">
              <div className="absolute -top-8 left-0 right-0 flex justify-center gap-1.5">
                <span className="px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-[10px] font-bold rounded-full shadow-lg">
                  {workshop.event_type}
                </span>
                <span className="px-3 py-1 bg-gradient-to-r from-green-500 to-green-600 text-white text-[10px] font-bold rounded-full shadow-lg">
                  {workshop.availability}
                </span>
              </div>

              <div className="mt-2">
                <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-2 leading-tight">
                  {workshop.title}
                </h3>
                {workshop.overview && (
                  <p className="text-gray-700 text-sm leading-relaxed border-l-4 border-yellow-400 pl-3 bg-yellow-50 py-2 rounded-r-lg">
                    {workshop.overview}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-2.5 rounded-xl border-2 border-blue-200 text-center">
                <Clock className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                <p className="text-[9px] text-blue-700 font-semibold mb-0.5">Duration</p>
                <p className="font-bold text-blue-900 text-xs">{workshop.estimated_time}m</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-2.5 rounded-xl border-2 border-green-200 text-center">
                <Users className="w-4 h-4 text-green-600 mx-auto mb-1" />
                <p className="text-[9px] text-green-700 font-semibold mb-0.5">Age</p>
                <p className="font-bold text-green-900 text-[10px] leading-tight">{workshop.age_group}</p>
              </div>
              {workshop.schedule_info && (
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-2.5 rounded-xl border-2 border-purple-200 text-center">
                  <Calendar className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                  <p className="text-[9px] text-purple-700 font-semibold mb-0.5">Schedule</p>
                  <p className="font-bold text-purple-900 text-[9px] leading-tight">{workshop.schedule_info}</p>
                </div>
              )}
            </div>

            {workshop.learning_points && workshop.learning_points.length > 0 && (
              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 p-3 rounded-xl border-2 border-orange-300">
                <h4 className="text-sm font-black text-orange-700 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  What You'll Learn
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {workshop.learning_points.map((point, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 bg-white p-2 rounded-lg shadow-sm border-l-4 border-orange-400"
                    >
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-yellow-500 flex items-center justify-center flex-shrink-0 font-bold text-white text-[10px]">
                        {index + 1}
                      </div>
                      <p className="text-gray-700 font-medium leading-snug flex-1 text-xs">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {workshop.description && (
              <div className="bg-blue-50 p-3 rounded-xl border-2 border-blue-200">
                <h4 className="text-sm font-black text-blue-700 mb-2 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  Workshop Details
                </h4>
                <div className={`text-gray-700 leading-relaxed text-xs ${!showFullDescription ? 'line-clamp-3' : ''}`}>
                  {workshop.description}
                </div>
                {workshop.description.length > 150 && (
                  <button
                    onClick={() => setShowFullDescription(!showFullDescription)}
                    className="mt-2 text-blue-600 font-bold text-xs hover:underline"
                  >
                    {showFullDescription ? '▲ Show Less' : '▼ Read More'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 p-4 bg-gradient-to-r from-yellow-100 via-orange-100 to-pink-100 border-t-4 border-yellow-400 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] text-gray-600 font-semibold">Workshop Fee</p>
            {workshop.has_special_price && workshop.special_price ? (
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-400 line-through">
                  RM{workshop.event_price.toFixed(2)}
                </p>
                <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-blue-600">
                  RM{workshop.special_price.toFixed(2)}
                </p>
              </div>
            ) : (
              <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-blue-600">
                RM{workshop.event_price.toFixed(2)}
              </p>
            )}
          </div>
          <button
            onClick={handleReserve}
            className="flex items-center gap-1.5 px-6 py-3 rounded-xl font-black text-sm transition-all shadow-lg bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white hover:scale-105 active:scale-95 border-2 border-white"
          >
            <ShoppingCart className="w-4 h-4" />
            Book Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkshopDetailModal;
