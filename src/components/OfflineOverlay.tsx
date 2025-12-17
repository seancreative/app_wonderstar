import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useOffline } from '../contexts/OfflineContext';

const OfflineOverlay: React.FC = () => {
  const { isOnline, isRetrying, retryConnection } = useOffline();

  if (isOnline) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-white/85 backdrop-blur-sm flex items-center justify-center z-[9999]"
      style={{ pointerEvents: 'auto' }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        onClick={(e) => e.stopPropagation()}
      />

      <div className="pointer-events-auto flex flex-col items-center justify-center gap-6 px-6 text-center max-w-md">
        <div className="relative w-48 h-48 flex items-center justify-center">
          <img
            src="/wtf080.gif"
            alt="Offline"
            className="w-full h-full object-contain"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-center gap-2 text-gray-800">
            <WifiOff className="w-8 h-8" />
            <h2 className="text-3xl font-bold">Oops!</h2>
          </div>
          <p className="text-xl font-semibold text-gray-700">You are offline</p>
          <p className="text-sm text-gray-600 mt-2">
            Please check your internet connection and try again
          </p>
        </div>

        <button
          onClick={retryConnection}
          disabled={isRetrying}
          className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          <RefreshCw className={`w-5 h-5 ${isRetrying ? 'animate-spin' : ''}`} />
          {isRetrying ? 'Checking...' : 'Retry'}
        </button>
      </div>
    </div>
  );
};

export default OfflineOverlay;
