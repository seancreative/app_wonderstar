import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { aiGeniusTranslations } from '../translations/aiGenius';
import { Brain, Palette, Sparkles, Presentation } from 'lucide-react';

const WorkshopCurriculum: React.FC = () => {
  const { t } = useLanguage();

  const icons = [
    <Brain className="w-7 h-7 text-blue-400" />,
    <Palette className="w-7 h-7 text-green-400" />,
    <Sparkles className="w-7 h-7 text-purple-400" />,
    <Presentation className="w-7 h-7 text-orange-400" />
  ];

  const iconBackgrounds = [
    'from-blue-500 to-cyan-500',
    'from-green-500 to-emerald-500',
    'from-purple-500 to-pink-500',
    'from-orange-500 to-red-500'
  ];

  const textColors = [
    'text-blue-300',
    'text-green-300',
    'text-purple-300',
    'text-orange-300'
  ];

  const borderColors = [
    'border-blue-400/30 hover:border-blue-400',
    'border-green-400/30 hover:border-green-400',
    'border-purple-400/30 hover:border-purple-400',
    'border-orange-400/30 hover:border-orange-400'
  ];

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 text-center mb-8">
          {t(aiGeniusTranslations.curriculum.title)}
        </h2>

        <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto">
          {aiGeniusTranslations.curriculum.steps.map((step, index) => (
            <div
              key={index}
              className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 border-2 ${borderColors[index]} transition-colors shadow-sm hover:shadow-md`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`flex-shrink-0 w-10 h-10 bg-gradient-to-br ${iconBackgrounds[index]} rounded-full flex items-center justify-center text-white font-black text-lg`}>
                  {index + 1}
                </div>
                <div>
                  {icons[index]}
                </div>
              </div>

              <h3 className={`text-lg font-bold ${textColors[index]} mb-2 leading-tight`}>
                {t(step.title)}
              </h3>

              <p className="text-sm text-gray-300 leading-snug mb-2">
                {t(step.description)}
              </p>

              {step.note && (
                <p className="text-xs text-gray-400 italic">
                  {t(step.note)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkshopCurriculum;
