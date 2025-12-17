import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { useStaffAuth } from '../../contexts/StaffAuthContext';

const CMSUnauthorized: React.FC = () => {
  const navigate = useNavigate();
  const { staff, logout } = useStaffAuth();

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    if (staff?.permissions?.star_scanner) {
      navigate('/cms/star-scanner');
    } else if (staff?.permissions?.orders) {
      navigate('/cms/orders');
    } else {
      navigate('/cms/dashboard');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/staff/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
            <ShieldAlert className="w-10 h-10 text-red-600" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Access Denied
          </h1>

          <p className="text-gray-600 mb-2">
            You don't have permission to access this resource.
          </p>

          {staff && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg text-left">
              <p className="text-sm text-gray-700 mb-1">
                <span className="font-semibold">Logged in as:</span> {staff.staff_name}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Role:</span>{' '}
                <span className="capitalize">{staff.role.replace('_', ' ')}</span>
              </p>
            </div>
          )}

          <p className="text-sm text-gray-500 mt-4">
            If you believe this is an error, please contact your administrator.
          </p>

          <div className="mt-8 space-y-3">
            <button
              onClick={handleGoBack}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Go Back
            </button>

            <button
              onClick={handleGoHome}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Home className="w-5 h-5" />
              Go to Homepage
            </button>

            <button
              onClick={handleLogout}
              className="w-full px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
            >
              Log out and sign in with different account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CMSUnauthorized;
