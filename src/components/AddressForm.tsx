import React, { useState, useEffect } from 'react';
import { MapPin, X, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AddressFormProps {
  onSubmit: (addressData: AddressData) => void;
  onCancel: () => void;
  initialData?: Partial<AddressData>;
  loading?: boolean;
}

export interface AddressData {
  address: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

const malaysianStates = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Kuala Lumpur',
  'Labuan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Penang',
  'Perak',
  'Perlis',
  'Putrajaya',
  'Sabah',
  'Sarawak',
  'Selangor',
  'Terengganu'
];

const AddressForm: React.FC<AddressFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
  loading = false
}) => {
  const { user } = useAuth();

  const [formData, setFormData] = useState<AddressData>({
    address: initialData?.address || user?.address || '',
    city: initialData?.city || user?.city || '',
    state: initialData?.state || user?.state || '',
    postcode: initialData?.postcode || user?.postcode || '',
    country: initialData?.country || user?.country || 'MY'
  });

  const [errors, setErrors] = useState<Partial<Record<keyof AddressData, string>>>({});

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        address: user.address || prev.address,
        city: user.city || prev.city,
        state: user.state || prev.state,
        postcode: user.postcode || prev.postcode,
        country: user.country || prev.country
      }));
    }
  }, [user]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof AddressData, string>> = {};

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!formData.state) {
      newErrors.state = 'State is required';
    }

    if (!formData.postcode.trim()) {
      newErrors.postcode = 'Postcode is required';
    } else if (!/^\d{5}$/.test(formData.postcode)) {
      newErrors.postcode = 'Postcode must be 5 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleChange = (field: keyof AddressData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <MapPin className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Address Details</h2>
              <p className="text-xs text-gray-600">Required for payment processing</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Street Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="123 Main Street"
              className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                errors.address ? 'border-red-500' : 'border-gray-200'
              }`}
            />
            {errors.address && (
              <p className="text-xs text-red-600 mt-1">{errors.address}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="Kuala Lumpur"
                className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                  errors.city ? 'border-red-500' : 'border-gray-200'
                }`}
              />
              {errors.city && (
                <p className="text-xs text-red-600 mt-1">{errors.city}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Postcode
              </label>
              <input
                type="text"
                value={formData.postcode}
                onChange={(e) => handleChange('postcode', e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="50000"
                maxLength={5}
                className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                  errors.postcode ? 'border-red-500' : 'border-gray-200'
                }`}
              />
              {errors.postcode && (
                <p className="text-xs text-red-600 mt-1">{errors.postcode}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              State
            </label>
            <select
              value={formData.state}
              onChange={(e) => handleChange('state', e.target.value)}
              className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all appearance-none ${
                errors.state ? 'border-red-500' : 'border-gray-200'
              }`}
            >
              <option value="">Select State</option>
              {malaysianStates.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
            {errors.state && (
              <p className="text-xs text-red-600 mt-1">{errors.state}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Country
            </label>
            <input
              type="text"
              value="Malaysia"
              disabled
              className="w-full px-4 py-3 bg-gray-100 border-2 border-gray-200 rounded-xl text-gray-600"
            />
          </div>

          <div className="pt-4 space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? 'Saving Address...' : 'Continue to Payment'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddressForm;
