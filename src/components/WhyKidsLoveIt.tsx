import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { aiGeniusTranslations } from '../translations/aiGenius';
import { Sparkles, Zap, Users, Shield } from 'lucide-react';

const WhyKidsLoveIt: React.FC = () => {
  const { t } = useLanguage();

  const icons = [
    <Sparkles className="w-10 h-10" />,
    <Zap className="w-10 h-10" />,
    <Users className="w-10 h-10" />,
    <Shield className="w-10 h-10" />
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 mb-4">
          {t(aiGeniusTranslations.whyKidsLoveIt.title)}
        </h2>
        <div className="w-24 h-1 bg-gradient-to-r from-purple-600 to-pink-600 mx-auto rounded-full"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {aiGeniusTranslations.whyKidsLoveIt.benefits.map((benefit, index) => (
          <div
            key={index}
            className="group relative bg-gradient-to-br from-purple-50 via-white to-pink-50 rounded-3xl p-8 border-3 border-purple-200 hover:border-purple-400 hover:shadow-2xl transition-all duration-300 hover:scale-105"
          >
            <div className="absolute top-4 right-4 text-purple-200 group-hover:text-purple-400 transition-colors">
              {icons[index]}
            </div>

            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-black text-xl shadow-lg">
                {index + 1}
              </div>

              <p className="text-xl font-bold text-gray-800 leading-snug pr-12">
                {t(benefit)}
              </p>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-b-3xl"></div>
          </div>
        ))}
      </div>

      <div className="mt-16 relative">
        <div className="aspect-video bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100 rounded-3xl border-4 border-purple-300 shadow-2xl overflow-hidden flex items-center justify-center">
          <div className="text-center space-y-4">
            <Sparkles className="w-16 h-16 text-purple-400 mx-auto animate-pulse" />
            <p className="text-2xl font-bold text-purple-600">Hero Image / Artwork Placeholder</p>
            <p className="text-gray-500">To be replaced with actual workshop photos</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhyKidsLoveIt;
