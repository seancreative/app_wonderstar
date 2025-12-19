import React from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import { useTheme } from '../../contexts/ThemeContext';

const AppLayout: React.FC = () => {
  const { theme } = useTheme();

  const getBackgroundClass = () => {
    switch (theme) {
      case 'dark':
        return 'bg-gradient-to-br from-gray-900 via-primary-900 to-gray-800';
      case 'colorful':
        return 'bg-gradient-to-br from-pink-300 via-primary-300 to-blue-300';
      case 'robotic':
        return 'bg-gradient-to-br from-gray-800 via-slate-700 to-gray-900';
      default:
        return 'bg-gradient-to-br from-primary-100 via-silver-100 to-primary-50';
    }
  };

  return (
    <div className={`min-h-screen ${getBackgroundClass()} transition-colors duration-500 relative`}>
      <main className="pb-20 min-h-screen">
        <Outlet />
      </main>
      <BottomNav />

    </div>
  );
};

export default AppLayout;
