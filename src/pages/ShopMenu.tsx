import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Star, Store, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useShop } from '../contexts/ShopContext';
import { useWallet } from '../hooks/useWallet';
import PageHeader from '../components/Layout/PageHeader';
import BottomNav from '../components/Layout/BottomNav';
import VoucherBanner from '../components/VoucherBanner';
import AddToCartToast from '../components/AddToCartToast';
import ConfirmationModal from '../components/ConfirmationModal';
import ProductDetailModal from '../components/ProductDetailModal';
import LoadingScreen from '../components/LoadingScreen';

interface Product {
  id: string;
  name: string;
  description?: string;
  category: string;
  category_id?: string;
  subcategory?: string;
  subcategory_id?: string;
  base_price: number;
  weekend_price?: number;
  pricing_type?: string;
  variants?: any;
  addons?: any;
  image_url?: string;
  images?: string[];
  stock?: number;
  workshop_date?: string;
  duration_minutes?: number;
  age_min?: number;
  age_max?: number;
  max_capacity?: number;
  bonus_stars?: number;
  special_discount?: boolean;
  is_recommended?: boolean;
  recommended_sort_order?: number;
}

interface Subcategory {
  id: string;
  subcategory_id: string;
  category_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

const ShopMenu: React.FC = () => {
  const navigate = useNavigate();
  const { outletSlug } = useParams();
  const { user } = useAuth();
  const { selectedOutlet, refreshCartCount, clearOutlet, addToCart, cartCount, clearCart } = useShop();
  const { loading: walletLoading } = useWallet();

  const [selectedCategory, setSelectedCategory] = useState<string | null>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [appliedVoucher, setAppliedVoucher] = useState<string | null>(null);
  const [appliedVoucherDetails, setAppliedVoucherDetails] = useState<{ code: string; restriction_type: string | null } | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastProductName, setToastProductName] = useState('');
  const [showChangeOutletWarning, setShowChangeOutletWarning] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [availableSubcategories, setAvailableSubcategories] = useState<Subcategory[]>([]);
  const [categories, setCategories] = useState<Array<{id: string; name: string; icon?: string; category_id: string}>>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      loadVoucherPreference();
    }
  }, [user]);

  useEffect(() => {
    if (appliedVoucher) {
      loadVoucherDetails();
    } else {
      setAppliedVoucherDetails(null);
    }
  }, [appliedVoucher]);

  const loadVoucherPreference = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('selected_voucher_code')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading voucher preference:', error);
        return;
      }

      if (data?.selected_voucher_code) {
        setAppliedVoucher(data.selected_voucher_code);
      } else {
        setAppliedVoucher(null);
      }
    } catch (error) {
      console.error('Error loading voucher preference:', error);
    }
  };

  const loadVoucherDetails = async () => {
    if (!appliedVoucher) return;

    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select('code, restriction_type')
        .eq('code', appliedVoucher)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error loading voucher details:', error);
        return;
      }

      if (data) {
        setAppliedVoucherDetails(data);
      }
    } catch (error) {
      console.error('Error loading voucher details:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, category_id, name, icon')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setCategories(data);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const getSubcategoryFilters = () => {
    const filters = [{ id: 'all', label: 'ALL' }];
    return [...filters, ...availableSubcategories.map(sub => ({
      id: sub.id,
      label: sub.name
    }))];
  };


  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      const ticketsCategory = categories.find(cat => cat.name.toLowerCase().includes('ticket'));
      if (ticketsCategory) {
        setSelectedCategory(ticketsCategory.id);
      } else {
        setSelectedCategory(categories[0].id);
      }
    }
  }, [categories]);

  useEffect(() => {
    if (!selectedOutlet) {
      navigate('/shop');
      return;
    }
    if (selectedCategory) {
      loadSubcategories();
      loadProducts();
    }
    refreshCartCount();
  }, [selectedCategory, selectedSubcategory, selectedOutlet]);

  const loadSubcategories = async () => {
    if (!selectedCategory || selectedCategory === 'all') {
      setAvailableSubcategories([]);
      return;
    }

    try {
      const { data: subcategoriesData, error } = await supabase
        .from('subcategories')
        .select('*')
        .eq('category_id', selectedCategory)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setAvailableSubcategories(subcategoriesData || []);
    } catch (error) {
      console.error('Error loading subcategories:', error);
      setAvailableSubcategories([]);
    }
  };

  const loadProducts = async () => {
    if (!selectedCategory || !selectedOutlet) return;

    setLoading(true);
    try {
      const { data: productIds, error: outletError } = await supabase
        .from('product_outlets')
        .select('product_id')
        .eq('outlet_id', selectedOutlet.id)
        .eq('is_available', true);

      if (outletError) throw outletError;

      const availableProductIds = productIds?.map(po => po.product_id) || [];

      if (availableProductIds.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('shop_products')
        .select('*')
        .eq('is_active', true)
        .in('id', availableProductIds);

      if (selectedCategory !== 'all') {
        query = query.eq('category_id', selectedCategory);
      }

      if (selectedSubcategory && selectedSubcategory !== 'all') {
        query = query.eq('subcategory_id', selectedSubcategory);
      }

      const { data, error } = await query
        .order('is_recommended', { ascending: false, nullsFirst: false })
        .order('recommended_sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
  };


  const handleChangeStore = () => {
    if (cartCount > 0) {
      setShowChangeOutletWarning(true);
      return;
    }
    clearOutlet();
    navigate('/shop');
  };

  const handleConfirmChangeStore = async () => {
    const success = await clearCart();
    if (success) {
      clearOutlet();
      navigate('/shop');
    } else {
      console.error('Failed to clear cart');
      alert('Failed to clear cart. Please try again.');
    }
  };

  const formatPrice = (price: number) => {
    return `RM${price.toFixed(2)}`;
  };

  const getShortDescription = (product: Product) => {
    const currentCategory = categories.find(cat => cat.id === selectedCategory);
    const categoryName = currentCategory?.name || '';

    if (categoryName.toLowerCase().includes('ticket')) {
      const ageGroup = product.name.split(' ')[0];
      return `${ageGroup} access`;
    }
    if (categoryName.toLowerCase().includes('workshop')) {
      return `${product.duration_minutes || 90} mins`;
    }
    if (product.subcategory_id) {
      const subcategory = availableSubcategories.find(sub => sub.id === product.subcategory_id);
      return subcategory?.name || product.subcategory || 'Item';
    }
    if (product.subcategory) {
      return product.subcategory;
    }
    return 'Item';
  };

  const getCurrentFilters = () => {
    if (availableSubcategories.length > 0) return getSubcategoryFilters();
    return [{ id: 'all', label: 'ALL' }];
  };

  const getFilteredProducts = () => {
    if (!searchTerm.trim()) {
      return products;
    }

    const search = searchTerm.toLowerCase().trim();
    return products.filter(product =>
      product.name.toLowerCase().includes(search) ||
      product.description?.toLowerCase().includes(search)
    );
  };

  const handleVoucherClick = () => {
    navigate('/stars');
  };

  const handleRemoveVoucher = async () => {
    setAppliedVoucher(null);

    if (user) {
      try {
        await supabase
          .from('user_preferences')
          .update({
            selected_voucher_code: null,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);
      } catch (error) {
        console.error('Error removing voucher preference:', error);
      }
    }
  };

  const isInitialLoading = (loading && products.length === 0) || categoriesLoading || walletLoading;

  const shouldHideVoucherBanner = outletSlug === 'melaka' || outletSlug === 'kuala-terengganu';

  return (
    <div className="min-h-screen pb-28 bg-gradient-to-b from-primary-50 to-white">
      <PageHeader />
      {!shouldHideVoucherBanner && (
        <VoucherBanner
          voucherCode={appliedVoucher || undefined}
          isApplied={!!appliedVoucher}
          onApply={handleVoucherClick}
          onRemove={handleRemoveVoucher}
        />
      )}
      {isInitialLoading ? (
        <div className="max-w-md mx-auto">
          <LoadingScreen variant="content" text="Loading menu..." />
        </div>
      ) : (
        <>
      <div className={`fixed left-0 right-0 z-40 glass border-b border-white/20 backdrop-blur-2xl max-w-md mx-auto ${shouldHideVoucherBanner ? 'top-[72px]' : (appliedVoucher ? 'top-[200px]' : 'top-[144px]')}`}>
        <div className="px-4 py-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/home')}
              className="p-1.5 hover:bg-white/50 rounded-lg transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                </div>
                <h1 className="text-base font-black text-gray-900 truncate leading-tight">{selectedOutlet?.name}</h1>
                <p className="text-[10px] text-gray-500 truncate">{selectedOutlet?.location}</p>
              </div>
              <button
                onClick={handleChangeStore}
                className="flex items-center gap-1 text-[10px] text-primary-600 font-bold hover:bg-primary-50 px-2 py-1 rounded-lg transition-colors flex-shrink-0"
              >
                <Store className="w-3 h-3" />
                Change Outlet
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`max-w-md mx-auto px-4 py-2 ${shouldHideVoucherBanner ? 'mt-[128px]' : (appliedVoucher ? 'mt-[256px]' : 'mt-[200px]')}`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 glass rounded-xl text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      <div className={`max-w-md mx-auto flex ${shouldHideVoucherBanner ? 'h-[calc(100vh-240px)]' : 'h-[calc(100vh-300px)]'}`}>
        <div className="w-12 glass border-r border-white/20 p-0.5 space-y-0.5 overflow-y-auto">
          {categoriesLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setSelectedSubcategory(null);
                  }}
                  className={`w-full p-1 rounded-lg text-center transition-all ${
                    selectedCategory === category.id
                      ? 'bg-primary-500 text-white shadow-lg'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-lg mb-0.5">{category.icon || '🎁'}</div>
                  <div className="text-[7px] font-bold leading-tight">{category.name}</div>
                </button>
              ))}
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2.5">
          <div className="sticky top-0 z-30 bg-gradient-to-b from-primary-50 via-primary-50 to-transparent pb-3 -mx-2.5 px-2.5 mb-2">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {getCurrentFilters().map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => {
                    setSelectedSubcategory(filter.id);
                  }}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all flex-shrink-0 ${
                    ((!selectedSubcategory && filter.id === 'all') || selectedSubcategory === filter.id)
                      ? 'bg-primary-500 text-white shadow-md'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-600"></div>
            </div>
          ) : getFilteredProducts().length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xs text-gray-600">No products available</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {getFilteredProducts().map((product) => (
                <div
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className="glass rounded-xl overflow-hidden hover:shadow-lg active:scale-95 transition-all cursor-pointer"
                >
                  <div className="relative aspect-square bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-3xl">
                        {categories.find(cat => cat.id === selectedCategory)?.icon || '🎁'}
                      </div>
                    )}
                    {product.is_recommended && (
                      <div className="absolute top-1 left-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-1.5 py-0.5 rounded-full shadow-lg z-20 flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5" fill="currentColor" />
                        <span className="text-[8px] font-bold">RECOMMENDED</span>
                      </div>
                    )}
                    {product.special_discount && (
                      <>
                        {!appliedVoucherDetails ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('/stars');
                            }}
                            className="absolute top-1 right-1 bg-red-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg z-10 hover:bg-red-600 transition-colors active:scale-95"
                          >
                            <span className="text-[8px] font-black leading-tight text-center">USE<br/>VOUCHER</span>
                          </button>
                        ) : appliedVoucherDetails.restriction_type === 'special_discount' ? (
                          <div className="absolute top-1 right-1 bg-red-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg z-10">
                            <span className="text-[10px] font-black leading-tight text-center">-RM5</span>
                          </div>
                        ) : null}
                      </>
                    )}
                    {product.bonus_stars && product.bonus_stars > 0 && (
                      <div className={`absolute ${
                        product.special_discount && (
                          !appliedVoucherDetails ||
                          appliedVoucherDetails.restriction_type === 'special_discount'
                        ) ? 'top-12 right-1' : 'top-1 right-1'
                      } flex items-center gap-0.5 bg-primary-500 text-white px-1 py-0.5 rounded-full z-10`}>
                        <Star className="w-2.5 h-2.5" fill="currentColor" />
                        <span className="text-[9px] font-bold">+{product.bonus_stars}</span>
                      </div>
                    )}
                    {product.weekend_price && product.weekend_price !== product.base_price && (
                      <div className="absolute top-1 left-1 bg-purple-500 text-white px-1.5 py-0.5 rounded-full">
                        <span className="text-[9px] font-bold">WKND</span>
                      </div>
                    )}
                  </div>

                  <div className="p-2 space-y-1">
                    <div>
                      <h3 className="font-bold text-gray-900 text-[11px] leading-tight line-clamp-2">{product.name}</h3>
                      <p className="text-[10px] text-gray-500">
                        {getShortDescription(product)}
                      </p>
                    </div>

                    <div className="pt-0.5">
                      {product.special_discount && appliedVoucherDetails?.restriction_type === 'special_discount' ? (
                        <>
                          <p className="text-sm font-bold text-gray-400 line-through">
                            {formatPrice(product.base_price)}
                          </p>
                          <p className="text-base font-black text-red-600">
                            {formatPrice(product.base_price - 5)}
                          </p>
                        </>
                      ) : (
                        <p className="text-base font-black text-gray-900">
                          {formatPrice(product.base_price)}
                        </p>
                      )}
                      {product.weekend_price && product.weekend_price !== product.base_price && (
                        <p className="text-[9px] text-purple-600 font-bold">
                          Wknd: {formatPrice(product.weekend_price)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <AddToCartToast
        show={showToast}
        productName={toastProductName}
        onClose={() => setShowToast(false)}
      />

      <ConfirmationModal
        isOpen={showChangeOutletWarning}
        onClose={() => setShowChangeOutletWarning(false)}
        onConfirm={handleConfirmChangeStore}
        title="Change Outlet?"
        message={`You have ${cartCount} item${cartCount > 1 ? 's' : ''} in your cart from ${selectedOutlet?.name}. Changing outlets will clear your cart. Do you want to continue?`}
        confirmText="Yes, Clear Cart"
        cancelText="Keep Shopping"
        type="warning"
      />

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddedToCart={() => {
            setToastProductName(selectedProduct.name);
            setShowToast(true);
          }}
        />
      )}
        </>
      )}

      <BottomNav />
    </div>
  );
};

export default ShopMenu;
