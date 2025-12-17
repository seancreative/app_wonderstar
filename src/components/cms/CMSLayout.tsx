import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { supabase } from '../../lib/supabase';
import VersionModal from '../VersionModal';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Store,
  Users,
  DollarSign,
  Award,
  Briefcase,
  Megaphone,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Shield,
  FileText,
  Scan,
  Tag,
  Image,
  AlertTriangle,
  List,
  Gift,
  PackageIcon,
  GraduationCap,
  Wallet,
  Crown,
  Bell,
  CreditCard,
  Database,
  Globe
} from 'lucide-react';

interface CMSLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  path: string;
  icon: any;
  resource?: string;
  subItems?: NavItem[];
}

const CMSLayout: React.FC<CMSLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, logout: adminLogout } = useAdminAuth();
  const { staff, logout: staffLogout } = useStaffAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('...');
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['/cms/settings']);

  // Determine current user
  const currentUser = admin || staff;
  const isStaff = !admin && !!staff;

  useEffect(() => {
    checkMaintenanceMode();
    loadLatestVersion();

    const subscription = supabase
      .channel('system_settings_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'system_settings',
        filter: 'setting_key=eq.maintenance_mode'
      }, (payload) => {
        if (payload.new && 'setting_value' in payload.new) {
          setMaintenanceMode(payload.new.setting_value === 'true');
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkMaintenanceMode = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'maintenance_mode')
        .single();

      if (!error && data) {
        setMaintenanceMode(data.setting_value === 'true');
      }
    } catch (error) {
      console.error('Error checking maintenance mode:', error);
    }
  };

  const loadLatestVersion = async () => {
    try {
      const { data, error } = await supabase
        .from('app_versions')
        .select('version')
        .order('release_date', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setCurrentVersion(data.version);
      }
    } catch (error) {
      console.error('Failed to load version');
    }
  };

  // Map staff permissions to nav items
  const staffPermissions = isStaff && staff?.role === 'manager'
    ? (staff as any).assigned_permissions || {}
    : {};

  const allNavItems: NavItem[] = [
    { label: 'Dashboard', path: '/cms/dashboard', icon: LayoutDashboard, resource: 'dashboard' },
    { label: 'Orders', path: '/cms/orders', icon: ShoppingBag, resource: 'orders' },
    { label: 'Products', path: '/cms/products', icon: Package, resource: 'products' },
    { label: 'Customers', path: '/cms/customers', icon: Users, resource: 'customers' },
    { label: 'Redemptions', path: '/cms/redemptions', icon: FileText, resource: 'redemptions' },
    { label: 'Rewards', path: '/cms/rewards', icon: Award, resource: 'rewards' },
    { label: 'Gacha', path: '/cms/gacha', icon: Gift, resource: 'gacha' },
    { label: 'EduStars', path: '/cms/edu-workshops', icon: GraduationCap, resource: 'eduworkshops' },
    { label: 'Marketing', path: '/cms/marketing', icon: Megaphone, resource: 'marketing' },
    { label: 'Analytics', path: '/cms/analytics', icon: BarChart3, resource: 'analytics' },
    { label: 'Finance', path: '/cms/financial', icon: DollarSign, resource: 'finance' },
    {
      label: 'Settings',
      path: '/cms/settings',
      icon: Settings,
      resource: 'settings',
      subItems: [
        { label: 'General', path: '/cms/settings?tab=general', icon: Settings, resource: 'settings' },
        { label: 'Outlets', path: '/cms/settings?tab=outlets', icon: Store, resource: 'settings' },
        { label: 'Users', path: '/cms/settings?tab=users', icon: Users, resource: 'settings' },
        { label: 'Security', path: '/cms/settings?tab=security', icon: Shield, resource: 'settings' },
        { label: 'Notifications', path: '/cms/settings?tab=notifications', icon: Bell, resource: 'settings' },
        { label: 'Payments', path: '/cms/settings?tab=payments', icon: CreditCard, resource: 'settings' },
        { label: 'Topup Packages', path: '/cms/settings?tab=topup', icon: Wallet, resource: 'settings' },
        { label: 'Tier Benefits', path: '/cms/settings?tab=tiers', icon: Crown, resource: 'settings' },
        { label: 'System', path: '/cms/settings?tab=system', icon: Database, resource: 'settings' }
      ]
    }
  ];

  // Filter navigation items based on permissions
  const navItems = isStaff
    ? allNavItems.filter(item => {
        if (!item.resource) return true;
        return staffPermissions[item.resource] === true;
      })
    : allNavItems;

  const handleLogout = async () => {
    if (isStaff) {
      await staffLogout();
    } else {
      await adminLogout();
    }
    navigate('/cms/login');
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'outlet_manager':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'manager':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'staff':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'analyst':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'star_scanner':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getRoleLabel = (role: string) => {
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-30 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className="h-16 border-b border-gray-200 flex items-center justify-between px-4">
          {!sidebarCollapsed && (
            <h1 className="text-xl font-black text-gray-900">
              Wonder<span className="text-blue-600">Stars</span>
            </h1>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 overflow-y-auto h-[calc(100vh-4rem)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            const isExpanded = expandedMenus.includes(item.path);
            const hasSubItems = item.subItems && item.subItems.length > 0;

            return (
              <div key={item.path}>
                {hasSubItems ? (
                  <div>
                    <button
                      onClick={() => {
                        if (isExpanded) {
                          setExpandedMenus(expandedMenus.filter(p => p !== item.path));
                        } else {
                          setExpandedMenus([...expandedMenus, item.path]);
                        }
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all group ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : 'text-gray-700 hover:bg-gray-50 font-medium'
                      }`}
                      title={sidebarCollapsed ? item.label : ''}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`w-5 h-5 flex-shrink-0 ${
                            isActive ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'
                          }`}
                        />
                        {!sidebarCollapsed && <span>{item.label}</span>}
                      </div>
                      {!sidebarCollapsed && (
                        <ChevronRight
                          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      )}
                    </button>
                    {isExpanded && !sidebarCollapsed && (
                      <div className="ml-4 mt-1 mb-2 space-y-1">
                        {item.subItems.map((subItem) => {
                          const SubIcon = subItem.icon;
                          const subIsActive = location.search.includes(subItem.path.split('?')[1] || '');
                          return (
                            <Link
                              key={subItem.path}
                              to={subItem.path}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm ${
                                subIsActive
                                  ? 'bg-blue-100 text-blue-700 font-semibold'
                                  : 'text-gray-600 hover:bg-gray-100 font-medium'
                              }`}
                            >
                              <SubIcon className="w-4 h-4 flex-shrink-0" />
                              <span>{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all group ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-gray-700 hover:bg-gray-50 font-medium'
                    }`}
                    title={sidebarCollapsed ? item.label : ''}
                  >
                    <Icon
                      className={`w-5 h-5 flex-shrink-0 ${
                        isActive ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'
                      }`}
                    />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </Link>
                )}
              </div>
            );
          })}

          {/* Star Scanner - Highlighted Feature */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Link
              to="/cms/star-scanner"
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl mb-1 transition-all group ${
                location.pathname === '/cms/star-scanner'
                  ? 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg scale-105'
                  : 'bg-gradient-to-br from-yellow-300 to-orange-400 hover:from-yellow-400 hover:to-orange-500 hover:shadow-lg hover:scale-105'
              }`}
              title={sidebarCollapsed ? 'Star Scanner' : ''}
            >
              <div className={`${sidebarCollapsed ? 'w-8 h-8' : 'w-12 h-12'} bg-white rounded-full flex items-center justify-center shadow-md transition-all`}>
                <Scan className={`${sidebarCollapsed ? 'w-5 h-5' : 'w-6 h-6'} text-orange-600`} />
              </div>
              {!sidebarCollapsed && (
                <span className="text-sm font-black text-white drop-shadow-md">Star Scanner</span>
              )}
            </Link>
          </div>

          {/* Version Button */}
          <div className="mt-2">
            <button
              onClick={() => setShowVersionModal(true)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full transition-all text-gray-700 hover:bg-gray-50 font-medium"
              title={sidebarCollapsed ? `Version ${currentVersion}` : ''}
            >
              <PackageIcon className="w-5 h-5 flex-shrink-0 text-gray-500" />
              {!sidebarCollapsed && <span>v{currentVersion}</span>}
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div
        className={`flex-1 transition-all duration-300 ${
          sidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        {/* Top Bar */}
        <header className={`h-16 border-b sticky top-0 z-20 flex items-center justify-between px-6 transition-colors ${
          maintenanceMode
            ? 'bg-red-600 border-red-700'
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center gap-4">
            {maintenanceMode && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-700 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-white animate-pulse" />
                <span className="text-sm font-bold text-white">MAINTENANCE MODE ACTIVE</span>
              </div>
            )}
            <h2 className={`text-lg font-bold ${maintenanceMode ? 'text-white' : 'text-gray-900'}`}>
              Content Management System
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Admin User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  maintenanceMode ? 'hover:bg-red-700' : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg">
                  {isStaff
                    ? staff?.staff_name?.charAt(0).toUpperCase() || 'S'
                    : admin?.name?.charAt(0).toUpperCase() || 'A'
                  }
                </div>
                <div className="text-left hidden md:block">
                  <p className={`text-sm font-bold ${maintenanceMode ? 'text-white' : 'text-gray-900'}`}>
                    {isStaff ? staff?.staff_name : admin?.name}
                  </p>
                  <p className={`text-xs px-2 py-0.5 rounded-full border inline-block ${getRoleColor(isStaff ? staff?.role || '' : admin?.role || '')}`}>
                    {getRoleLabel(isStaff ? staff?.role || '' : admin?.role || '')}
                  </p>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${maintenanceMode ? 'text-white' : 'text-gray-500'} ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 animate-scale-in">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-bold text-gray-900">
                      {isStaff ? staff?.staff_name : admin?.name}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {isStaff ? staff?.email : admin?.email}
                    </p>
                    {isStaff && staff?.outlet_id && (
                      <p className="text-xs text-blue-600 mt-1 font-medium">Outlet Staff</p>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-red-50 transition-colors text-red-600 font-semibold"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 pb-20">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 py-4 px-6">
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Developed & Powered by <span className="font-bold text-gray-900">CRAVE</span>
            </p>
          </div>
        </footer>
      </div>

      {/* Version Modal */}
      <VersionModal
        isOpen={showVersionModal}
        onClose={() => setShowVersionModal(false)}
        currentVersion={currentVersion}
      />

      {/* Click outside to close user menu */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowUserMenu(false)}
        ></div>
      )}
    </div>
  );
};

export default CMSLayout;
