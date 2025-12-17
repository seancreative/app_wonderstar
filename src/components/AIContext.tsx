import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { aiGeniusTranslations } from '../translations/aiGenius';
import { MapPin, Calendar } from 'lucide-react';

const AIContext: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 text-center mb-4">
          {t(aiGeniusTranslations.aiContext.headline)}
        </h2>

        <p className="text-base text-gray-300 leading-relaxed mb-6 text-center max-w-3xl mx-auto">
         
        </p>

        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-l-4 border-yellow-400 p-4 mb-6 rounded backdrop-blur-sm">
          <p className="text-lg font-semibold text-yellow-200 italic">
            "{t(aiGeniusTranslations.aiContext.parentQuestion)}"
          </p>
        </div>

        <p className="text-base text-gray-300 leading-relaxed mb-6">
          {t(aiGeniusTranslations.aiContext.solution)}
        </p>

        <div className="bg-gradient-to-br from-yellow-600/20 via-orange-600/20 to-red-600/20 border border-yellow-400/30 rounded-xl p-6 backdrop-blur-md">
          <p className="text-lg font-semibold mb-3 text-center text-yellow-300">
            {t(aiGeniusTranslations.aiContext.announcement)}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/20">
              <MapPin className="w-5 h-5 text-blue-300" />
              <span className="font-bold text-white">
                {t(aiGeniusTranslations.aiContext.locations).split('—')[0]}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/20">
              <Calendar className="w-5 h-5 text-green-300" />
              <span className="font-bold text-white">
                {t(aiGeniusTranslations.aiContext.locations).split('—')[1]}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIContext;
