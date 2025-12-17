import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface OfflineContextType {
  isOnline: boolean;
  isRetrying: boolean;
  retryConnection: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
};

interface OfflineProviderProps {
  children: ReactNode;
}

export const OfflineProvider: React.FC<OfflineProviderProps> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isRetrying, setIsRetrying] = useState(false);

  const checkConnection = async (): Promise<boolean> => {
    try {
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
      });
      return true;
    } catch (error) {
      return false;
    }
  };

  const retryConnection = async () => {
    setIsRetrying(true);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const online = await checkConnection();
    setIsOnline(online || navigator.onLine);

    setIsRetrying(false);
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <OfflineContext.Provider value={{ isOnline, isRetrying, retryConnection }}>
      {children}
    </OfflineContext.Provider>
  );
};
