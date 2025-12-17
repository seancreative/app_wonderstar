import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Star, ShoppingCart, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useShop } from '../contexts/ShopContext';
import AddToCartToast from '../components/AddToCartToast';
import ImageSlider from '../components/ImageSlider';
import BottomNav from '../components/Layout/BottomNav';

interface Product {
  id: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  category_id?: string;
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
}

const ProductDetail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { outletSlug, productId } = useParams();
  const { user } = useAuth();
  const { selectedOutlet, refreshCartCount } = useShop();
  const isFromWorkshop = searchParams.get('from') === 'workshop';

  const [product, setProduct] = useState<Product | null>(location.state?.product || null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(!location.state?.product);
  const [addingToCart, setAddingToCart] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!product && productId) {
      loadProduct();
    }
  }, [productId]);

  const loadProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('shop_products')
        .select('*')
        .eq('id', productId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setProduct(data);
      } else {
        navigate(`/shop/${outletSlug}`);
      }
    } catch (error) {
      console.error('Error loading product:', error);
      navigate(`/shop/${outletSlug}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!product || !selectedOutlet || !user) return;

    setAddingToCart(true);
    try {
      const finalUnitPrice = getCurrentPrice();

      const { error: insertError } = await supabase
        .from('shop_cart_items')
        .insert({
          user_id: user.id,
          outlet_id: selectedOutlet.id,
          product_id: product.id,
          quantity: quantity,
          unit_price: finalUnitPrice,
          metadata: {
            product_name: product.name,
            category: product.category,
            category_id: product.category_id,
            subcategory: product.subcategory,
            subcategory_id: product.subcategory_id,
          },
        });

      if (insertError) throw insertError;

      await refreshCartCount();
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Failed to add to cart. Please try again.');
    } finally {
      setAddingToCart(false);
    }
  };

  const getCurrentPrice = () => {
    if (!product) return 0;
    const today = new Date().getDay();
    const isWeekend = today === 0 || today === 6;

    if (isWeekend && product.weekend_price) {
      return product.weekend_price;
    }
    return product.base_price;
  };

  const getTotalPrice = () => {
    return getCurrentPrice() * quantity;
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-32 bg-gradient-to-b from-primary-50 to-white">
        <div className="pt-20 px-4">
          <div className="animate-pulse space-y-4">
            <div className="w-full h-64 bg-gray-200 rounded-2xl"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  const images = product.images && product.images.length > 0
    ? product.images
    : product.image_url
    ? [product.image_url]
    : [];

  return (
    <div className="min-h-screen pb-44 bg-gradient-to-b from-primary-50 to-white">
      {/* Page Header - Fixed */}
      <div className={`fixed top-0 left-0 right-0 z-40 glass border-b border-white/20 backdrop-blur-2xl max-w-md mx-auto ${
        isFromWorkshop ? 'bg-gradient-to-r from-yellow-100/90 via-orange-100/90 to-pink-100/90' : ''
      }`}>
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(isFromWorkshop ? '/edu' : `/shop/${outletSlug}`)}
            className="p-2 hover:bg-white/50 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <div className="flex-1">
            {isFromWorkshop ? (
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-[10px] font-bold text-orange-600 uppercase">Workshop Booking</p>
                  <h1 className="text-sm font-black text-gray-900 truncate leading-tight">
                    {selectedOutlet?.name || 'Select Details'}
                  </h1>
                </div>
              </div>
            ) : (
              <h1 className="text-lg font-bold text-gray-900 truncate">
                {selectedOutlet?.name || 'Product Details'}
              </h1>
            )}
          </div>
        </div>
      </div>

      {/* Content with proper top padding to account for fixed header */}
      <div className="pt-16">
        {/* Workshop Badge */}
        {isFromWorkshop && (
          <div className="px-4 pt-4 pb-2">
            <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white p-3 rounded-xl flex items-center gap-2 shadow-lg">
              <Sparkles className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold">Educational Workshop</p>
                <p className="text-[10px] opacity-90">Complete your booking below</p>
              </div>
            </div>
          </div>
        )}

        {/* Product Images */}
        {images.length > 0 && (
          <div className="px-4 pt-4">
            <ImageSlider images={images} className="rounded-2xl overflow-hidden" />
          </div>
        )}

        {/* Product Details */}
        <div className="px-4 pt-6 space-y-4">
          {/* Product Name & Price */}
          <div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">{product.name}</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-primary-600">
                RM {getCurrentPrice().toFixed(2)}
              </span>
              {product.weekend_price && product.weekend_price !== product.base_price && (
                <span className="text-sm text-gray-500">
                  (Weekday: RM {product.base_price.toFixed(2)})
                </span>
              )}
            </div>
            {product.bonus_stars && product.bonus_stars > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <Star className="w-4 h-4 text-amber-500" fill="currentColor" />
                <span className="text-sm font-bold text-gray-700">
                  +{product.bonus_stars} bonus stars
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="bg-white/60 p-4 rounded-xl">
              <h3 className="font-bold text-gray-900 mb-2">Description</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* Workshop Details */}
          {product.category && product.category.toLowerCase().includes('workshop') && (
            <div className="bg-blue-50 p-4 rounded-xl space-y-2">
              <h3 className="font-bold text-gray-900">Workshop Details</h3>
              {product.workshop_date && (
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Date:</span> {new Date(product.workshop_date).toLocaleDateString()}
                </p>
              )}
              {product.duration_minutes && (
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Duration:</span> {product.duration_minutes} minutes
                </p>
              )}
              {product.age_min && product.age_max && (
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Age Range:</span> {product.age_min}-{product.age_max} years
                </p>
              )}
              {product.max_capacity && (
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Max Capacity:</span> {product.max_capacity} participants
                </p>
              )}
            </div>
          )}

          {/* Stock Status */}
          {product.stock !== undefined && product.stock !== null && (
            <div className={`p-3 rounded-xl ${product.stock > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className={`text-sm font-bold ${product.stock > 0 ? 'text-green-700' : 'text-red-700'}`}>
                {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
              </p>
            </div>
          )}

          {/* Quantity Selector */}
          <div className="bg-white/60 p-4 rounded-xl">
            <h3 className="font-bold text-gray-900 mb-3">Quantity</h3>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="w-12 h-12 rounded-xl bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 font-bold hover:bg-gray-300 transition-colors flex items-center justify-center"
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className="text-2xl font-black text-gray-900 min-w-[60px] text-center">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                disabled={product.stock !== undefined && quantity >= product.stock}
                className="w-12 h-12 rounded-xl bg-primary-500 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold hover:bg-primary-600 transition-colors flex items-center justify-center"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Total Price */}
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-4 rounded-xl text-white">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">Total</span>
              <span className="text-2xl font-black">RM {getTotalPrice().toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Button - Above BottomNav */}
      <div className="fixed bottom-[84px] left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-200 max-w-md mx-auto z-30">
        <button
          onClick={handleAddToCart}
          disabled={addingToCart || (product.stock !== undefined && product.stock <= 0)}
          className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
        >
          {addingToCart ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Adding to Cart...
            </>
          ) : product.stock !== undefined && product.stock <= 0 ? (
            'Out of Stock'
          ) : (
            <>
              <ShoppingCart className="w-5 h-5" />
              Add to Cart
            </>
          )}
        </button>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Toast Notification */}
      {showToast && (
        <AddToCartToast
          productName={product.name}
          quantity={quantity}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
};

export default ProductDetail;
