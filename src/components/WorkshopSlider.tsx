import React, { useState, useEffect } from 'react';
import { Sparkles, ChevronRight, ChevronLeft, Clock, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { EduWorkshop } from '../types/database';
import WorkshopDetailModal from './WorkshopDetailModal';

const WorkshopSlider: React.FC = () => {
  const [workshops, setWorkshops] = useState<EduWorkshop[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [selectedWorkshop, setSelectedWorkshop] = useState<EduWorkshop | null>(null);

  useEffect(() => {
    loadWorkshops();
  }, []);

  useEffect(() => {
    if (workshops.length > 0) {
      const timer = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % workshops.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [workshops.length]);

  const loadWorkshops = async () => {
    try {
      const { data, error } = await supabase
        .from('edu_workshops')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .limit(5);

      if (error) throw error;
      setWorkshops(data || []);
    } catch (error) {
      console.error('Error loading workshops:', error);
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

    if (distance > 0 && currentIndex < workshops.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (distance < 0 && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : workshops.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < workshops.length - 1 ? prev + 1 : 0));
  };

  if (workshops.length === 0) {
    return null;
  }

  const currentWorkshop = workshops[currentIndex];
  const mainImage = currentWorkshop.workshop_images && currentWorkshop.workshop_images.length > 0
    ? currentWorkshop.workshop_images[0]
    : currentWorkshop.image_url;

  return (
    <>
      <div className="relative animate-slide-up">
        <div
          className="relative cursor-pointer"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => setSelectedWorkshop(currentWorkshop)}
        >
          <div className="glass rounded-2xl overflow-hidden hover:scale-[1.02] transition-transform shadow-lg border-3 border-yellow-300">
            {mainImage ? (
              <div className="w-full aspect-square bg-gradient-to-br from-blue-100 to-purple-100 relative overflow-hidden">
                <img
                  src={mainImage}
                  alt={currentWorkshop.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 right-2 flex gap-1 flex-wrap">
                  <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-[10px] font-bold rounded-full shadow-lg">
                    {currentWorkshop.event_type}
                  </span>
                  <span className="px-2 py-0.5 bg-gradient-to-r from-green-500 to-green-600 text-white text-[10px] font-bold rounded-full shadow-lg">
                    {currentWorkshop.availability}
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-full aspect-square bg-gradient-to-br from-yellow-200 via-orange-200 to-pink-200 flex items-center justify-center">
                <Sparkles className="w-12 h-12 text-yellow-500" />
              </div>
            )}

            <div className="p-3 space-y-2 bg-gradient-to-br from-white via-yellow-50 to-orange-50">
              <h3 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 leading-tight line-clamp-2">
                {currentWorkshop.title}
              </h3>

              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 rounded-lg">
                  <Clock className="w-3 h-3 text-blue-600" />
                  <span className="font-bold text-blue-900">{currentWorkshop.estimated_time}m</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-lg">
                  <Users className="w-3 h-3 text-green-600" />
                  <span className="font-bold text-green-900 text-[10px]">{currentWorkshop.age_group}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-orange-200">
                <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-blue-600">
                  RM{currentWorkshop.event_price.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {workshops.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrev();
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all z-10"
              >
                <ChevronLeft className="w-5 h-5 text-gray-700" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all z-10"
              >
                <ChevronRight className="w-5 h-5 text-gray-700" />
              </button>
            </>
          )}
        </div>


      </div>

      {selectedWorkshop && (
        <WorkshopDetailModal
          workshop={selectedWorkshop}
          onClose={() => setSelectedWorkshop(null)}
        />
      )}
    </>
  );
};

export default WorkshopSlider;
