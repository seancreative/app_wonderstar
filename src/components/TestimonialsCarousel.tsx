import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { aiGeniusTranslations } from '../translations/aiGenius';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';

const TestimonialsCarousel: React.FC = () => {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const testimonials = aiGeniusTranslations.testimonials.reviews;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [testimonials.length]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 py-16">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 mb-4">
            {t(aiGeniusTranslations.testimonials.title)}
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-purple-600 to-pink-600 mx-auto rounded-full"></div>
        </div>

        <div className="relative">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 border-3 border-purple-200 min-h-[300px] flex flex-col justify-center">
            <div className="flex justify-center mb-6">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-8 h-8 text-yellow-400 fill-yellow-400" />
              ))}
            </div>

            <div className="text-center space-y-6 animate-fadeIn">
              <p className="text-2xl md:text-3xl font-bold text-gray-800 leading-relaxed italic">
                "{t(testimonials[currentIndex].quote)}"
              </p>

              <div className="pt-4 border-t-2 border-purple-200">
                <p className="text-lg font-semibold text-purple-600">
                  — {t(testimonials[currentIndex].author)}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={goToPrevious}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-6 w-12 h-12 md:w-14 md:h-14 bg-white rounded-full shadow-xl border-2 border-purple-300 flex items-center justify-center text-purple-600 hover:bg-purple-600 hover:text-white transition-all hover:scale-110"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={goToNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-6 w-12 h-12 md:w-14 md:h-14 bg-white rounded-full shadow-xl border-2 border-purple-300 flex items-center justify-center text-purple-600 hover:bg-purple-600 hover:text-white transition-all hover:scale-110"
          >
            <ChevronRight className="w-6 h-6" />
          </button>


        </div>
      </div>
    </div>
  );
};

export default TestimonialsCarousel;
