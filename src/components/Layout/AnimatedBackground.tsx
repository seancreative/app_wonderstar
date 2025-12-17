import React from 'react';
import { Star, Sparkles } from 'lucide-react';

const AnimatedBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-pink-500/20 rounded-full -top-20 -left-20 animate-float blur-3xl"></div>
        <div className="absolute w-64 h-64 bg-blue-500/20 rounded-full -bottom-10 -right-10 animate-float-delayed blur-3xl"></div>
        <div className="absolute w-48 h-48 bg-yellow-400/20 rounded-full top-1/3 right-1/3 animate-pulse-slow blur-2xl"></div>
        <div className="absolute w-32 h-32 bg-purple-400/30 rounded-full bottom-1/4 left-1/4 animate-float blur-2xl" style={{ animationDelay: '1.5s' }}></div>
      </div>

      <div className="absolute inset-0 pointer-events-none">
        <Star className="absolute w-6 h-6 text-yellow-300 top-[15%] left-[10%] animate-twinkle" style={{ animationDelay: '0s' }} />
        <Star className="absolute w-4 h-4 text-pink-300 top-[25%] right-[15%] animate-twinkle" style={{ animationDelay: '0.5s' }} />
        <Star className="absolute w-5 h-5 text-blue-300 top-[60%] left-[20%] animate-twinkle" style={{ animationDelay: '1s' }} />
        <Star className="absolute w-3 h-3 text-yellow-200 top-[45%] right-[25%] animate-twinkle" style={{ animationDelay: '1.5s' }} />
        <Star className="absolute w-4 h-4 text-purple-300 top-[70%] right-[10%] animate-twinkle" style={{ animationDelay: '2s' }} />
        <Star className="absolute w-5 h-5 text-pink-200 top-[35%] left-[85%] animate-twinkle" style={{ animationDelay: '2.5s' }} />
        <Star className="absolute w-3 h-3 text-blue-200 top-[80%] left-[15%] animate-twinkle" style={{ animationDelay: '3s' }} />
        <Star className="absolute w-6 h-6 text-yellow-300 top-[10%] right-[30%] animate-twinkle" style={{ animationDelay: '3.5s' }} />
        <Star className="absolute w-4 h-4 text-pink-300 bottom-[20%] left-[35%] animate-twinkle" style={{ animationDelay: '4s' }} />
        <Star className="absolute w-5 h-5 text-blue-300 top-[50%] right-[5%] animate-twinkle" style={{ animationDelay: '4.5s' }} />

        <Sparkles className="absolute w-8 h-8 text-yellow-300 top-[20%] right-[5%] animate-bounce-gentle" style={{ animationDelay: '0s' }} />
        <Sparkles className="absolute w-6 h-6 text-pink-300 bottom-[30%] left-[8%] animate-bounce-gentle" style={{ animationDelay: '1s' }} />
        <Sparkles className="absolute w-7 h-7 text-blue-300 bottom-[15%] right-[20%] animate-bounce-gentle" style={{ animationDelay: '2s' }} />
      </div>
    </div>
  );
};

export default AnimatedBackground;
