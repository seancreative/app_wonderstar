import React from 'react';

interface LoadingScreenProps {
  text?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'fullscreen' | 'content';
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  text = 'Loading your data...',
  size = 'large',
  variant = 'fullscreen'
}) => {
  const sizeClasses = {
    small: 'w-16 h-16',
    medium: 'w-24 h-24',
    large: 'w-32 h-32'
  };

  if (variant === 'content') {
    return (
      <div className="w-full min-h-[400px] flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <img
              src="/wonderstar-nobg.png"
              alt="WonderStars"
              className={`${sizeClasses[size]} object-contain animate-pulse-scale`}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-orange-400/20 rounded-full blur-xl animate-pulse"></div>
          </div>

          {text && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-lg font-bold theme-text-primary animate-fade-in">
                {text}
              </p>
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <img
            src="/wonderstar-nobg.png"
            alt="WonderStars"
            className={`${sizeClasses[size]} object-contain animate-pulse-scale`}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-orange-400/20 rounded-full blur-xl animate-pulse"></div>
        </div>

        {text && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-lg font-bold text-gray-700 animate-fade-in">
              {text}
            </p>
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;
