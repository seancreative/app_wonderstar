import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { aiGeniusTranslations } from '../translations/aiGenius';
import { Star, MapPin } from 'lucide-react';

const SarawakTestimonials: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-10 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 text-center mb-8">
          {t(aiGeniusTranslations.testimonials.title)}
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {aiGeniusTranslations.testimonials.reviews.map((review, index) => (
            <div
              key={index}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow border border-yellow-400/30"
            >
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>

              <p className="text-sm text-gray-300 leading-snug mb-3 italic">
                "{review.quote}"
              </p>

              <div className="pt-2 border-t border-gray-700">
                <p className="text-sm font-bold text-yellow-300">
                  {review.author}
                </p>
                {review.location && (
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                    <MapPin className="w-3 h-3" />
                    <span>{review.location}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SarawakTestimonials;
