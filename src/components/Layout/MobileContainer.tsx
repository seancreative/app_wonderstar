import React from 'react';
import { useLocation } from 'react-router-dom';

interface MobileContainerProps {
  children: React.ReactNode;
}

const MobileContainer: React.FC<MobileContainerProps> = ({ children }) => {
  const location = useLocation();

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-0 sm:p-4 md:p-6 lg:p-8">
      <div className="relative w-full max-w-md min-h-screen bg-white/95 shadow-2xl sm:rounded-3xl sm:min-h-[calc(100vh-2rem)] md:min-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-4rem)]">
        {children}

      </div>
    </div>
  );
};

export default MobileContainer;
