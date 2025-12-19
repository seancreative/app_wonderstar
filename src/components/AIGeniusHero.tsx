import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { aiGeniusTranslations } from '../translations/aiGenius';
import { Sparkles, Zap, ArrowRight } from 'lucide-react';

const AIGeniusHero: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-950">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvZz48L3N2Zz4=')] opacity-20"></div>

      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-violet-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-2000"></div>
      </div>

      <div className="relative max-w-4xl mx-auto px-6 py-16 space-y-8">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
            <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
            <span className="text-white font-bold text-sm">AI-powered Edu Workshops</span>
            <Zap className="w-5 h-5 text-yellow-400 animate-pulse" />
          </div>

          <div className="flex items-center justify-center gap-2">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 border border-white/20 shadow-lg">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 rounded-full text-sm font-bold transition-all ${language === 'en'
                  ? 'bg-white text-purple-900 shadow-lg'
                  : 'text-white/70 hover:text-white'
                  }`}
              >
                EN
              </button>
              <span className="text-white/40">|</span>
              <button
                onClick={() => setLanguage('bm')}
                className={`px-3 py-1 rounded-full text-sm font-bold transition-all ${language === 'bm'
                  ? 'bg-white text-purple-900 shadow-lg'
                  : 'text-white/70 hover:text-white'
                  }`}
              >
                BM
              </button>
            </div>
          </div>

          <div className="max-w-3xl mx-auto rounded-3xl overflow-hidden shadow-2xl border-4 border-white/20">
            <img
              src="/aigenius-splash.jpg"
              alt="AI Genius Educational Workshops"
              className="w-full h-auto"
            />
          </div>



          <div className="max-w-3xl mx-auto bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
            <p className="text-white text-lg leading-relaxed">
              {t(aiGeniusTranslations.hero.description)}
            </p>
          </div>

          <a
            href="https://aigeniusworkshop.test/view"
            target="_blank"
            rel="noopener noreferrer"
            className="group w-full flex items-center justify-center gap-3 px-8 py-5 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 rounded-2xl shadow-[0_0_20px_rgba(45,212,191,0.3)] border border-cyan-400/30 hover:shadow-[0_0_30px_rgba(45,212,191,0.6)] hover:scale-[1.02] transition-all duration-300 cursor-pointer relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            <span className="text-white font-black text-xl tracking-wider uppercase drop-shadow-md">ACCESS WITH A CODE</span>
            <ArrowRight className="w-6 h-6 text-white group-hover:translate-x-1 transition-transform" />
          </a>

          <div className="bg-gradient-to-r from-yellow-400/20 via-orange-400/20 to-pink-400/20 backdrop-blur-md rounded-2xl p-6 border border-yellow-400/30">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 animate-pulse"></div>
              <p className="text-white text-base leading-relaxed text-left">
                {t(aiGeniusTranslations.hero.announcement)}
              </p>
            </div>
          </div>
        </div>

        <div className="absolute -bottom-10 left-0 right-0 h-20 bg-gradient-to-b from-transparent to-white"></div>
      </div>
    </div>
  );
};

export default AIGeniusHero;
