import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { aiGeniusTranslations } from '../translations/aiGenius';
import { CheckCircle2 } from 'lucide-react';

const ImagineYourChild: React.FC = () => {
  const { t, language } = useLanguage();

  const iconColors = [
    'text-blue-400',
    'text-purple-400',
    'text-green-400',
    'text-orange-400'
  ];

  const borderColors = [
    'border-blue-400/30',
    'border-purple-400/30',
    'border-green-400/30',
    'border-orange-400/30'
  ];

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 text-center mb-8">
          {t(aiGeniusTranslations.imagineYourChild.title)}
        </h2>

        <div className="grid grid-cols-1 gap-3 mb-6 max-w-lg mx-auto">
          {aiGeniusTranslations.imagineYourChild.benefits.map((benefit, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 bg-gray-800/50 rounded-lg p-4 border ${borderColors[index]}`}
            >
              <CheckCircle2 className={`w-5 h-5 ${iconColors[index]} flex-shrink-0 mt-0.5`} />
              <p className="text-sm text-gray-300 leading-snug">
                {t(benefit)}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-400/30 rounded-xl p-6 text-center shadow-lg backdrop-blur-md">
          <p className="text-xl font-black text-yellow-300">
            {t(aiGeniusTranslations.imagineYourChild.closing)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ImagineYourChild;
