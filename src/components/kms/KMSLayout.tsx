import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useKitchenAuth } from '../../contexts/KitchenAuthContext';
import { LogOut, ChefHat, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useOffline } from '../../contexts/OfflineContext';

interface KMSLayoutProps {
  children: React.ReactNode;
  onRefresh?: () => void;
}

const KMSLayout: React.FC<KMSLayoutProps> = ({ children, onRefresh }) => {
  const navigate = useNavigate();
  const { kitchenUser, logout } = useKitchenAuth();
  const { isOffline } = useOffline();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/cms/login');
  };

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      await onRefresh();
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white border-b-2 border-gray-200 shadow-sm">
        <div className="max-w-full px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <ChefHat className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900">Order Display System</h1>
                <p className="text-sm font-medium text-gray-600">WonderStars ODS</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isOffline ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-2 border-red-200 rounded-lg">
                  <WifiOff className="w-5 h-5 text-red-600" />
                  <span className="font-bold text-red-700 text-sm">Offline</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border-2 border-green-200 rounded-lg">
                  <Wifi className="w-5 h-5 text-green-600" />
                  <span className="font-bold text-green-700 text-sm">Online</span>
                </div>
              )}

              {onRefresh && (
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className={`flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-lg transition-all ${
                    isRefreshing ? 'cursor-not-allowed' : ''
                  }`}
                >
                  <RefreshCw className={`w-5 h-5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="font-bold text-blue-700 text-sm">Refresh</span>
                </button>
              )}

              <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-2 border-gray-200 rounded-lg">
                <div className="text-right">
                  <p className="font-bold text-gray-900 text-sm">{kitchenUser?.staff_name}</p>
                  <p className="text-xs font-medium text-gray-600">{kitchenUser?.role.toUpperCase()}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition-all hover:scale-110 active:scale-95"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full">
        {children}
      </main>
    </div>
  );
};

export default KMSLayout;
