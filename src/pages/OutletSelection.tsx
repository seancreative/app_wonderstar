import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Navigation, Search, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useShop } from '../contexts/ShopContext';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/Layout/PageHeader';
import BottomNav from '../components/Layout/BottomNav';
import FacilitiesModal from '../components/FacilitiesModal';
import ConfirmationModal from '../components/ConfirmationModal';

interface Outlet {
  id: string;
  name: string;
  location: string;
  status: string;
  address: string;
  image_url: string;
  cover_image_url?: string;
}

const OutletSelection: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const productId = searchParams.get('productId');
  const { user } = useAuth();
  const { setSelectedOutlet, cartCount, getCartOutlet, clearCart, selectedOutlet } = useShop();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showFacilities, setShowFacilities] = useState(false);
  const [selectedOutletForFacilities, setSelectedOutletForFacilities] = useState<Outlet | null>(null);
  const [showChangeOutletWarning, setShowChangeOutletWarning] = useState(false);
  const [pendingOutlet, setPendingOutlet] = useState<Outlet | null>(null);
  const [currentCartOutlet, setCurrentCartOutlet] = useState<Outlet | null>(null);

  useEffect(() => {
    loadOutlets();
    loadCurrentCartOutlet();
  }, []);

  const loadCurrentCartOutlet = async () => {
    if (user && cartCount > 0) {
      const outlet = await getCartOutlet();
      setCurrentCartOutlet(outlet);
    }
  };

  const loadOutlets = async () => {
    try {
      console.log('[OutletSelection] Loading outlets...');
      const { data, error } = await supabase
        .from('outlets')
        .select('*')
        .eq('is_active', true)
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (error) throw error;
      console.log('[OutletSelection] Loaded outlets:', data?.length || 0);
      data?.forEach(o => console.log(' -', o.name, '| is_active:', o.is_active, '| status:', o.status));
      setOutlets(data || []);
    } catch (error) {
      console.error('[OutletSelection] Error loading outlets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOutletSelect = async (outlet: Outlet) => {
    const outletWithSlug = {
      ...outlet,
      slug: outlet.location.toLowerCase().replace(/\s+/g, '-')
    };

    if (cartCount > 0 && currentCartOutlet && currentCartOutlet.id !== outlet.id) {
      setPendingOutlet(outletWithSlug);
      setShowChangeOutletWarning(true);
      return;
    }

    await setSelectedOutlet(outletWithSlug);

    if (productId) {
      navigate(`/shop/${outletWithSlug.slug}/product/${productId}?from=workshop`);
    } else if (returnTo) {
      navigate(returnTo);
    } else {
      navigate(`/shop/${outletWithSlug.slug}`);
    }
  };

  const handleConfirmOutletChange = async () => {
    if (!pendingOutlet) return;

    const success = await clearCart();
    if (success) {
      await setSelectedOutlet(pendingOutlet);
      setCurrentCartOutlet(null);

      if (productId) {
        navigate(`/shop/${pendingOutlet.slug}/product/${productId}?from=workshop`);
      } else if (returnTo) {
        navigate(returnTo);
      } else {
        navigate(`/shop/${pendingOutlet.slug}`);
      }
    } else {
      console.error('Failed to clear cart');
      alert('Failed to clear cart. Please try again.');
    }
  };

  const handleGetDirections = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  };

  const handleShowFacilities = (outlet: Outlet) => {
    setSelectedOutletForFacilities(outlet);
    setShowFacilities(true);
  };

  const filteredOutlets = outlets.filter(outlet =>
    outlet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    outlet.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    outlet.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-28 bg-gradient-to-b from-primary-50 to-white">
      <PageHeader />
      <div className="max-w-md mx-auto px-4 pt-20 space-y-4">

        <div className="relative animate-pop-in">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 glass rounded-xl text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredOutlets.length === 0 ? (
          <div className="glass p-8 rounded-2xl text-center">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-base font-bold text-gray-900">No outlets found</p>
            <p className="text-sm text-gray-600 mt-1">Try adjusting your search</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOutlets.map((outlet, index) => (
              <div
                key={outlet.id}
                onClick={() => handleOutletSelect(outlet)}
                className="glass rounded-2xl overflow-hidden hover:scale-[1.01] active:scale-98 transition-all animate-pop-in shadow-lg cursor-pointer"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex gap-3 p-3">
                  <div className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-primary-100 to-primary-200">
                    <img
                      src={outlet.cover_image_url || outlet.image_url}
                      alt={outlet.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{outlet.name}</h3>
                    </div>

                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-gray-700 leading-snug">{outlet.address}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGetDirections(outlet.address);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 glass rounded-lg text-primary-600 font-bold text-xs hover:scale-105 active:scale-95 transition-transform"
                      >
                        <Navigation className="w-3 h-3" />
                        Get Directions
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShowFacilities(outlet);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-bold text-xs hover:scale-105 active:scale-95 transition-transform shadow-md"
                      >
                        <Building2 className="w-3 h-3" />
                        Facilities
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />

      {showFacilities && selectedOutletForFacilities && (
        <FacilitiesModal
          outletId={selectedOutletForFacilities.id}
          outletName={selectedOutletForFacilities.name}
          onClose={() => {
            setShowFacilities(false);
            setSelectedOutletForFacilities(null);
          }}
        />
      )}

      <ConfirmationModal
        isOpen={showChangeOutletWarning}
        onClose={() => {
          setShowChangeOutletWarning(false);
          setPendingOutlet(null);
        }}
        onConfirm={handleConfirmOutletChange}
        title="Change Outlet?"
        message={`You have ${cartCount} item${cartCount > 1 ? 's' : ''} in your cart from ${currentCartOutlet?.name}. Changing to ${pendingOutlet?.name} will clear your cart. Do you want to continue?`}
        confirmText="Yes, Clear Cart"
        cancelText="Keep Shopping"
        type="warning"
      />
    </div>
  );
};

export default OutletSelection;
