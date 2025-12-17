import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { aiGeniusTranslations } from '../translations/aiGenius';
import { Wrench, Printer, Coffee, Box } from 'lucide-react';

const ParentBenefits: React.FC = () => {
  const { t } = useLanguage();

  const icons = [
    <Wrench className="w-6 h-6" />,
    <Printer className="w-6 h-6" />,
    <Coffee className="w-6 h-6" />,
    <Box className="w-6 h-6" />
  ];

  const iconBackgrounds = [
    'from-blue-500 to-cyan-500',
    'from-purple-500 to-pink-500',
    'from-green-500 to-emerald-500',
    'from-orange-500 to-red-500'
  ];

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 text-center mb-3">
          {t(aiGeniusTranslations.parentBenefits.title)}
        </h2>

        <p className="text-base text-gray-300 text-center mb-6">
          {t(aiGeniusTranslations.parentBenefits.subtitle)}
        </p>

        <div className="grid grid-cols-2 gap-3 mb-6 max-w-2xl mx-auto">
          {aiGeniusTranslations.parentBenefits.benefits.map((benefit, index) => (
            <div
              key={index}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 shadow-md hover:shadow-xl transition-shadow border-2 border-yellow-400/30"
            >
              <div className="flex flex-col items-center text-center gap-2">
                <div className={`flex-shrink-0 w-12 h-12 bg-gradient-to-br ${iconBackgrounds[index]} rounded-full flex items-center justify-center text-white`}>
                  {icons[index]}
                </div>
                <p className="text-sm font-bold text-gray-200 leading-snug">
                  {t(benefit.title)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-400/30 rounded-xl p-5 text-center shadow-lg backdrop-blur-md">
          <p className="text-base leading-relaxed text-yellow-200 font-semibold">
            {t(aiGeniusTranslations.parentBenefits.closing)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ParentBenefits;
