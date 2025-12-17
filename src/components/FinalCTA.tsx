import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { aiGeniusTranslations } from '../translations/aiGenius';
import { ArrowDown, Sparkles } from 'lucide-react';

const FinalCTA: React.FC = () => {
  const { t } = useLanguage();

  const scrollToWorkshops = () => {
    const workshopsSection = document.getElementById('workshops-list');
    if (workshopsSection) {
      workshopsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 py-10 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvZz48L3N2Zz4=')] opacity-20"></div>

      <div className="relative max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
          {t(aiGeniusTranslations.finalCta.title)}
        </h2>

        <p className="text-lg md:text-xl text-white font-semibold mb-4">
          {t(aiGeniusTranslations.finalCta.headline)}
        </p>

        <p className="text-base text-white/90 leading-relaxed mb-6 max-w-2xl mx-auto">
          {t(aiGeniusTranslations.finalCta.description)}
        </p>

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 mb-6 border border-white/20">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-yellow-300" />
            <p className="text-sm text-yellow-300 font-bold">
              {t(aiGeniusTranslations.finalCta.voucherReminder).split(':')[0]}:
            </p>
          </div>
          <code className="text-2xl md:text-3xl font-black text-white tracking-wider">
            AIGENIUS25
          </code>
          <p className="text-lg font-bold text-green-300 mt-2">
            RM20 {t(aiGeniusTranslations.specialVoucher.discountedPrice).split(' ').slice(1).join(' ')}
          </p>
        </div>

        <p className="text-base text-white/90 mb-6">
          {t(aiGeniusTranslations.finalCta.closing)}
        </p>

        <button
          onClick={scrollToWorkshops}
          className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-gray-900 font-bold px-8 py-4 rounded-full shadow-2xl hover:shadow-xl transition-all transform hover:scale-105 inline-flex items-center gap-2"
        >
          <span className="text-lg">View AI Genius Workshops</span>
          <ArrowDown className="w-5 h-5 animate-bounce" />
        </button>
      </div>
    </div>
  );
};

export default FinalCTA;
