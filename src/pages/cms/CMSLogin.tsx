import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { useKitchenAuth } from '../../contexts/KitchenAuthContext';
import { supabase } from '../../lib/supabase';
import { Lock, Mail, AlertCircle, Eye, EyeOff, Shield, Users, Scan, ChefHat } from 'lucide-react';

type LoginType = 'admin' | 'manager' | 'scanner' | 'kitchen';

const CMSLogin: React.FC = () => {
  const navigate = useNavigate();
  const { login: adminLogin } = useAdminAuth();
  const { login: staffLogin } = useStaffAuth();
  const { login: kitchenLogin } = useKitchenAuth();
  const [loginType, setLoginType] = useState<LoginType>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (loginType === 'admin') {
        await adminLogin(email, password);
        navigate('/cms/dashboard');
      } else if (loginType === 'kitchen') {
        // Kitchen login
        await kitchenLogin(email, password);
        navigate('/kms/dashboard');
      } else {
        // Manager or Scanner login
        if (!password) {
          throw new Error('Please enter your password or passcode');
        }
        await staffLogin(email, password);

        // Smart redirect based on role and permissions
        const { data: staffData } = await supabase
          .from('staff_passcodes')
          .select('role, assigned_permissions')
          .eq('email', email.toLowerCase().trim())
          .eq('is_active', true)
          .maybeSingle();

        if (staffData) {
          const role = staffData.role;
          const permissions = staffData.assigned_permissions || {};

          // For Scanner login type - always go to scanner
          if (loginType === 'scanner') {
            navigate('/cms/staff-scanner');
          }
          // For Manager login type - check permissions
          else if (loginType === 'manager') {
            if (role === 'manager') {
              // Find first enabled permission to determine landing page
              if (permissions.dashboard) {
                navigate('/cms/dashboard');
              } else if (permissions.rewards) {
                navigate('/cms/rewards');
              } else if (permissions.marketing) {
                navigate('/cms/marketing');
              } else if (permissions.orders) {
                navigate('/cms/orders');
              } else if (permissions.products) {
                navigate('/cms/products');
              } else if (permissions.redemptions) {
                navigate('/cms/redemptions');
              } else if (permissions.analytics) {
                navigate('/cms/analytics');
              } else if (permissions.finance) {
                navigate('/cms/financial');
              } else {
                // Manager with no CMS permissions, go to scanner
                navigate('/cms/staff-scanner');
              }
            } else {
              // Not a manager, go to scanner
              navigate('/cms/staff-scanner');
            }
          }
        } else {
          // Fallback to scanner
          navigate('/cms/staff-scanner');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const getPlaceholder = () => {
    if (loginType === 'admin') return 'admin@wonderstars.com';
    if (loginType === 'manager') return 'manager@wonderstars.com';
    if (loginType === 'kitchen') return 'kitchen@wonderstars.com';
    return 'scanner@wonderstars.com';
  };

  const getPasswordLabel = () => {
    if (loginType === 'admin') return 'Password';
    return 'Password';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40"></div>

      <div className="relative w-full max-w-md">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur-xl opacity-30 animate-pulse"></div>

        <div className="relative bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg transform rotate-3">
              <Lock className="w-10 h-10 text-white transform -rotate-3" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 mb-2">WonderStars CMS</h1>
            <p className="text-gray-600 font-medium">Select your role and sign in</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 font-semibold">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Radio Button Group */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">Login As</label>
              <div className="grid grid-cols-2 gap-2">
                {/* Admin Option */}
                <label className={`flex flex-col items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  loginType === 'admin'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="loginType"
                    value="admin"
                    checked={loginType === 'admin'}
                    onChange={(e) => setLoginType(e.target.value as LoginType)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mt-2 ${
                    loginType === 'admin' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Shield className={`w-5 h-5 ${
                      loginType === 'admin' ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="mt-2 text-center">
                    <p className={`font-bold text-sm ${
                      loginType === 'admin' ? 'text-blue-900' : 'text-gray-900'
                    }`}>Admin</p>
                    <p className="text-xs text-gray-500">Full system access</p>
                  </div>
                </label>

                {/* Manager/Staff Option */}
                <label className={`flex flex-col items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  loginType === 'manager'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="loginType"
                    value="manager"
                    checked={loginType === 'manager'}
                    onChange={(e) => setLoginType(e.target.value as LoginType)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mt-2 ${
                    loginType === 'manager' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Users className={`w-5 h-5 ${
                      loginType === 'manager' ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="mt-2 text-center">
                    <p className={`font-bold text-sm ${
                      loginType === 'manager' ? 'text-blue-900' : 'text-gray-900'
                    }`}>Manager / Staff</p>
                    <p className="text-xs text-gray-500">Dashboard & management</p>
                  </div>
                </label>

                {/* Scanner Option */}
                <label className={`flex flex-col items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  loginType === 'scanner'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="loginType"
                    value="scanner"
                    checked={loginType === 'scanner'}
                    onChange={(e) => setLoginType(e.target.value as LoginType)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mt-2 ${
                    loginType === 'scanner' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Scan className={`w-5 h-5 ${
                      loginType === 'scanner' ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="mt-2 text-center">
                    <p className={`font-bold text-sm ${
                      loginType === 'scanner' ? 'text-blue-900' : 'text-gray-900'
                    }`}>Scanner</p>
                    <p className="text-xs text-gray-500">QR code scanning only</p>
                  </div>
                </label>

                {/* Kitchen Option */}
                <label className={`flex flex-col items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  loginType === 'kitchen'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="loginType"
                    value="kitchen"
                    checked={loginType === 'kitchen'}
                    onChange={(e) => setLoginType(e.target.value as LoginType)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mt-2 ${
                    loginType === 'kitchen' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <ChefHat className={`w-5 h-5 ${
                      loginType === 'kitchen' ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="mt-2 text-center">
                    <p className={`font-bold text-sm ${
                      loginType === 'kitchen' ? 'text-blue-900' : 'text-gray-900'
                    }`}>Kitchen</p>
                    <p className="text-xs text-gray-500">Order preparation & tracking</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 font-medium placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  placeholder={getPlaceholder()}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2">
                {getPasswordLabel()}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 font-medium placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center hover:scale-110 transition-transform"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {loginType === 'admin' && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-center text-sm text-gray-500">
                Default credentials for testing:
                <br />
                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded mt-1 inline-block">
                  admin
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400">
            Developed & Powered by <span className="font-bold text-white">CRAVE</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CMSLogin;
