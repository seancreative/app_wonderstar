import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { aiGeniusTranslations } from '../translations/aiGenius';
import { Rocket, Sparkles } from 'lucide-react';

const StartTheJourney: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="relative bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100 py-16 overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjMpIi8+PC9nPjwvc3ZnPg==')] opacity-40"></div>

      <div className="absolute top-10 left-10 w-32 h-32 bg-purple-300 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-32 h-32 bg-pink-300 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-pulse delay-1000"></div>

      <div className="relative max-w-4xl mx-auto px-4 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-5 py-2 bg-white rounded-full shadow-lg border-2 border-purple-300">
          <Sparkles className="w-5 h-5 text-purple-500 animate-pulse" />
          <span className="font-bold text-purple-700">Ready to Begin?</span>
          <Sparkles className="w-5 h-5 text-purple-500 animate-pulse" />
        </div>

        <h2 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600">
          {t(aiGeniusTranslations.cta.title)}
        </h2>

        <p className="text-2xl md:text-3xl font-bold text-gray-800 leading-relaxed">
          {t(aiGeniusTranslations.cta.subtitle)}
        </p>

        <div className="flex items-center justify-center gap-4 pt-4">
          <Rocket className="w-12 h-12 text-purple-600 animate-bounce" />
          <div className="w-32 h-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 rounded-full"></div>
          <Rocket className="w-12 h-12 text-pink-600 animate-bounce delay-200" />
        </div>

        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 border-2 border-purple-300 shadow-xl">
          <p className="text-lg font-semibold text-purple-800">
            Explore our exciting AI Genius workshops below
          </p>
        </div>
      </div>
    </div>
  );
};

export default StartTheJourney;
