import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { StaffAuthProvider } from './contexts/StaffAuthContext';
import { KitchenAuthProvider, useKitchenAuth } from './contexts/KitchenAuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ShopProvider } from './contexts/ShopContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { ToastProvider } from './contexts/ToastContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { WPayDebugProvider } from './contexts/WPayDebugContext';
import { supabase } from './lib/supabase';
import { cleanInvalidCookies } from './utils/cookieUtils';

import AppLayout from './components/Layout/AppLayout';
import AnimatedBackground from './components/Layout/AnimatedBackground';
import MobileContainer from './components/Layout/MobileContainer';
import DebugBox from './components/DebugBox';
import { WPayDebugBox } from './components/WPayDebugBox';
import { WPayDebugConnector } from './components/WPayDebugConnector';
import ScrollToTop from './components/ScrollToTop';
import OfflineOverlay from './components/OfflineOverlay';

import Welcome from './pages/Welcome';
import Signup from './pages/Signup';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import AddChild from './pages/AddChild';
import Home from './pages/Home';
import Stars from './pages/Stars';
import Missions from './pages/Missions';
import MyQR from './pages/MyQR';
import Profile from './pages/Profile';
import Wallet from './pages/Wallet';
import WalletTopup from './pages/WalletTopup';
import Rewards from './pages/Rewards';
import CheckIn from './pages/CheckIn';
import Workshops from './pages/Workshops';
import EduWorkshops from './pages/EduWorkshops';
import Settings from './pages/Settings';
import OutletSelection from './pages/OutletSelection';
import ShopMenu from './pages/ShopMenu';
import ProductDetail from './pages/ProductDetail';
import ShopCart from './pages/ShopCart';
import ShopCheckout from './pages/ShopCheckout';
import OrderSuccess from './pages/OrderSuccess';
import PaymentCallback from './pages/PaymentCallback';
import WPayCallback from './pages/WPayCallback';
import CMSLogin from './pages/cms/CMSLogin';
import CMSDashboard from './pages/cms/CMSDashboard';
import CMSOrders from './pages/cms/CMSOrders';
import CMSProducts from './pages/cms/CMSProducts';
import CMSCategories from './pages/cms/CMSCategories';
import CMSModifiers from './pages/cms/CMSModifiers';
import CMSCustomers from './pages/cms/CMSCustomers';
import CMSOutlets from './pages/cms/CMSOutlets';
import CMSStaff from './pages/cms/CMSStaff';
import CMSRedemptionLogs from './pages/cms/CMSRedemptionLogs';
import CMSStarScanner from './pages/cms/CMSStarScanner';
import StaffScanner from './pages/cms/StaffScanner';
import StaffLogin from './pages/StaffLogin';
import CMSFinancial from './pages/cms/CMSFinancial';
import CMSRewards from './pages/cms/CMSRewards';
import CMSWorkshops from './pages/cms/CMSWorkshops';
import CMSEduWorkshops from './pages/cms/CMSEduWorkshops';
import CMSMarketing from './pages/cms/CMSMarketing';
import CMSRedemptions from './pages/cms/CMSRedemptions';
import CMSPromoSliders from './pages/cms/CMSPromoSliders';
import CMSAnalytics from './pages/cms/CMSAnalytics';
import CMSSettings from './pages/cms/CMSSettings';
import CMSAIInsights from './pages/cms/CMSAIInsights';
import CMSUserMigration from './pages/cms/CMSUserMigration';
import CMSWalletHealth from './pages/cms/CMSWalletHealth';
import CMSUnauthorized from './pages/cms/CMSUnauthorized';
import Maintenance from './pages/Maintenance';
import EggGachaPage from './pages/EggGachaPage';
import ShareGachaPage from './pages/ShareGachaPage';
import CMSGacha from './pages/cms/CMSGacha';
import ResetPassword from './pages/ResetPassword';
import KMSKitchen from './pages/kms/KMSKitchen';

const MaintenanceGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    checkMaintenanceMode();

    const subscription = supabase
      .channel('maintenance_check')
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
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white"></div>
      </div>
    );
  }

  const isCMSRoute = location.pathname.startsWith('/cms');
  const isKMSRoute = location.pathname.startsWith('/kms');

  if (maintenanceMode && !isCMSRoute && !isKMSRoute) {
    return <Maintenance />;
  }

  return <>{children}</>;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen gradient-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen gradient-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};

const KitchenProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { kitchenUser, loading } = useKitchenAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!kitchenUser) {
    return <Navigate to="/cms/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  useEffect(() => {
    cleanInvalidCookies();
  }, []);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <LanguageProvider>
        <ToastProvider>
          <OfflineProvider>
            <WPayDebugProvider>
              <ThemeProvider>
                <AdminAuthProvider>
                  <StaffAuthProvider>
                    <KitchenAuthProvider>
                      <AuthProvider>
                        <ShopProvider>
                          <MaintenanceGuard>
                  <Routes>
                {/* CMS Routes - Full Width */}
                <Route path="/cms/*" element={
                  <div className="theme-gradient-bg min-h-screen transition-all duration-500">
                    <Routes>
                      <Route path="login" element={<CMSLogin />} />
                      <Route path="staff-login" element={<StaffLogin />} />
                      <Route path="staff-scanner" element={<StaffScanner />} />
                      <Route path="dashboard" element={<CMSDashboard />} />
                      <Route path="orders" element={<CMSOrders />} />
                      <Route path="ai-insights" element={<CMSAIInsights />} />
                      <Route path="products" element={<CMSProducts />} />
                      <Route path="categories" element={<CMSCategories />} />
                      <Route path="modifiers" element={<CMSModifiers />} />
                      <Route path="customers" element={<CMSCustomers />} />
                      <Route path="outlets" element={<CMSOutlets />} />
                      <Route path="staff" element={<CMSStaff />} />
                      <Route path="redemption-logs" element={<CMSRedemptionLogs />} />
                      <Route path="star-scanner" element={<CMSStarScanner />} />
                      <Route path="financial" element={<CMSFinancial />} />
                      <Route path="wallet-health" element={<CMSWalletHealth />} />
                      <Route path="rewards" element={<CMSRewards />} />
                      <Route path="workshops" element={<CMSWorkshops />} />
                      <Route path="edu-workshops" element={<CMSEduWorkshops />} />
                      <Route path="marketing" element={<CMSMarketing />} />
                      <Route path="redemptions" element={<CMSRedemptions />} />
                      <Route path="promo-sliders" element={<CMSPromoSliders />} />
                      <Route path="analytics" element={<CMSAnalytics />} />
                      <Route path="gacha" element={<CMSGacha />} />
                      <Route path="settings" element={<CMSSettings />} />
                      <Route path="user-migration" element={<CMSUserMigration />} />
                      <Route path="unauthorized" element={<CMSUnauthorized />} />
                      <Route path="*" element={<Navigate to="/cms/dashboard" replace />} />
                    </Routes>
                  </div>
                } />

                {/* KMS Routes - Kitchen Management System */}
                <Route path="/kms/*" element={
                  <div className="min-h-screen bg-white">
                    <Routes>
                      <Route path="dashboard" element={
                        <KitchenProtectedRoute>
                          <KMSKitchen />
                        </KitchenProtectedRoute>
                      } />
                      <Route path="*" element={<Navigate to="/kms/dashboard" replace />} />
                    </Routes>
                  </div>
                } />

                {/* Customer Routes - Mobile Container with Animated Background */}
                <Route path="*" element={
                  <>
                    <AnimatedBackground />
                    <Routes>
                      <Route
                        path="/login"
                        element={
                          <PublicRoute>
                            <Login />
                          </PublicRoute>
                        }
                      />
                      <Route
                        path="/"
                        element={
                          <PublicRoute>
                            <Welcome />
                          </PublicRoute>
                        }
                      />
                      <Route
                        path="/signup"
                        element={
                          <PublicRoute>
                            <Signup />
                          </PublicRoute>
                        }
                      />
                      <Route
                        path="/forgot-password"
                        element={
                          <PublicRoute>
                            <ForgotPassword />
                          </PublicRoute>
                        }
                      />

<Route
                                  path="/reset-password"
                                  element={
                                    <PublicRoute>
                                      <ResetPassword />
                                    </PublicRoute>
                                  }
                                />

                      
                      <Route path="*" element={
                        <MobileContainer>
                          <Routes>
                            <Route
                              path="/add-child"
                              element={
                                <ProtectedRoute>
                                  <AddChild />
                                </ProtectedRoute>
                              }
                            />

                            <Route
                              element={
                                <ProtectedRoute>
                                  <AppLayout />
                                </ProtectedRoute>
                              }
                            >
                              <Route path="/home" element={<Home />} />
                              <Route path="/stars" element={<Stars />} />
                              <Route path="/edu" element={<EduWorkshops />} />
                              <Route path="/myqr" element={<MyQR />} />
                              <Route path="/profile" element={<Profile />} />
                            </Route>

                            <Route
                              path="/missions"
                              element={
                                <ProtectedRoute>
                                  <Missions />
                                </ProtectedRoute>
                              }
                            />

                            <Route
                              path="/wallet"
                              element={
                                <ProtectedRoute>
                                  <Wallet />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/wallet/topup"
                              element={
                                <ProtectedRoute>
                                  <WalletTopup />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/rewards"
                              element={
                                <ProtectedRoute>
                                  <Rewards />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/egg-gacha"
                              element={
                                <ProtectedRoute>
                                  <EggGachaPage />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/share-gacha"
                              element={
                                <ProtectedRoute>
                                  <ShareGachaPage />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/checkin"
                              element={
                                <ProtectedRoute>
                                  <CheckIn />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/workshops"
                              element={
                                <ProtectedRoute>
                                  <Workshops />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/settings"
                              element={
                                <ProtectedRoute>
                                  <Settings />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/shop"
                              element={
                                <ProtectedRoute>
                                  <OutletSelection />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/shop/:outletSlug"
                              element={
                                <ProtectedRoute>
                                  <ShopMenu />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/shop/:outletSlug/product/:productId"
                              element={
                                <ProtectedRoute>
                                  <ProductDetail />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/shop/:outletSlug/cart"
                              element={
                                <ProtectedRoute>
                                  <ShopCart />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/shop/:outletSlug/checkout"
                              element={
                                <ProtectedRoute>
                                  <ShopCheckout />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/shop/:outletSlug/order-success/:orderId"
                              element={
                                <ProtectedRoute>
                                  <OrderSuccess />
                                </ProtectedRoute>
                              }
                            />
<Route
                                  path="/payment/callback"
                                  element={<PaymentCallback />}
                                />
                            <Route
                                  path="/wpay/callback"
                                  element={<WPayCallback />}
                                />


                            <Route
                              path="/myqr"
                              element={
                                <ProtectedRoute>
                                  <PaymentCallback />
                                </ProtectedRoute>
                              }
                            />

                            <Route path="*" element={<Navigate to="/" replace />} />
                          </Routes>
                        </MobileContainer>
                      } />
                    </Routes>
                  </>
                } />
              </Routes>
                  </MaintenanceGuard>
                  <WPayDebugConnector />
                  <DebugBox />
                  <WPayDebugBox />
              </ShopProvider>
            </AuthProvider>
          </KitchenAuthProvider>
          </StaffAuthProvider>
        </AdminAuthProvider>
      </ThemeProvider>
      <OfflineOverlay />
    </WPayDebugProvider>
    </OfflineProvider>
    </ToastProvider>
    </LanguageProvider>
  </BrowserRouter>
);
}

export default App;
