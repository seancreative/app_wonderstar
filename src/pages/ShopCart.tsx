import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, Star, ShoppingBag, MapPin, Ticket, ChevronRight, X, Check, Sparkles, TrendingDown, Gift } from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useShop } from '../contexts/ShopContext';
import { useVouchers } from '../hooks/useVouchers';
import { useMasterBalances } from '../hooks/useMasterBalances';
import PageHeader from '../components/Layout/PageHeader';
import BottomNav from '../components/Layout/BottomNav';
import VoucherBanner from '../components/VoucherBanner';
import ConfirmationModal from '../components/ConfirmationModal';
import BonusSliderModal from '../components/BonusSliderModal';

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  visit_date?: string;
  metadata: {
    product_name: string;
    category: string;
    category_id?: string;
    subcategory?: string;
    subcategory_id?: string;
    variants?: Record<string, any>;
    addons?: string[];
  };
}

const ShopCart: React.FC = () => {
  const navigate = useNavigate();
  const { outletSlug } = useParams();
  const { user } = useAuth();
  const { selectedOutlet, refreshCartCount, selectedVoucher, setSelectedVoucher, clearVoucher, appliedBonusAmount, setAppliedBonusAmount, clearBonus } = useShop();
  const { availableVouchers, loading: vouchersLoading, refresh: refreshVouchers } = useVouchers(user?.id);
  const { balances, loading: balancesLoading } = useMasterBalances({
    userId: user?.id || null,
    userEmail: user?.email || null
  });
  const bonusBalance = balances?.bonusBalance || 0;
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVouchers, setShowVouchers] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    itemId?: string;
    itemName?: string;
  }>({ isOpen: false });
  const [showSavingsCelebration, setShowSavingsCelebration] = useState(false);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [showBonusTopupModal, setShowBonusTopupModal] = useState(false);
  const [productMapping, setProductMapping] = useState<Map<string, string>>(new Map());
  const [bonusRemovalModal, setBonusRemovalModal] = useState(false);
  const [pendingVoucherAction, setPendingVoucherAction] = useState<'select' | 'change' | null>(null);
  const isNavigatingAway = React.useRef(false);

  useEffect(() => {
    if (!selectedOutlet) {
      navigate('/shop');
      return;
    }
    if (user && !isNavigatingAway.current) {
      loadCart();
    }
  }, [user, selectedOutlet]);

  useEffect(() => {
    if (cartItems.length > 0 && selectedVoucher) {
      const discount = calculateDiscount();
      console.log('[Cart] Discount calculated:', discount);
      if (discount > 0) {
        console.log('[Cart] Triggering confetti and showing celebration');
        setShowSavingsCelebration(true);
        setTimeout(() => {
          triggerConfetti();
        }, 100);
      } else {
        setShowSavingsCelebration(false);
      }
    } else {
      setShowSavingsCelebration(false);
    }
  }, [selectedVoucher, cartItems]);

  const triggerConfetti = () => {
    console.log('[Cart] Confetti function called');
    try {
      const duration = 2000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval: any = setInterval(function () {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti(Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        }));
        confetti(Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        }));
      }, 250);
      console.log('[Cart] Confetti interval started');
    } catch (error) {
      console.error('[Cart] Confetti error:', error);
    }
  };

  const loadCart = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('shop_cart_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCartItems(data || []);

      // Load product mapping for voucher calculations
      const { data: products } = await supabase
        .from('shop_products')
        .select('id, product_id');

      if (products) {
        const mapping = new Map<string, string>();
        products.forEach(p => {
          if (p.product_id) {
            mapping.set(p.id, p.product_id);
          }
        });
        setProductMapping(mapping);
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveClick = (itemId: string, itemName: string) => {
    setConfirmModal({ isOpen: true, itemId, itemName });
  };

  const removeItem = async () => {
    if (!confirmModal.itemId) return;

    try {
      const { error } = await supabase
        .from('shop_cart_items')
        .delete()
        .eq('id', confirmModal.itemId);

      if (error) throw error;

      clearVoucher();
      clearBonus();

      await loadCart();
      await refreshCartCount();
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  };

  const calculateStarsEarning = (paymentMethod: string = 'wonderstars') => {
    const finalAmount = calculateTotal();
    const baseStars = Math.floor(finalAmount * 25);
    const multiplier = paymentMethod === 'wonderstars' ? 1.2 : 1.0;
    return Math.max(0, Math.floor(baseStars * multiplier));
  };

  const formatVariants = (variants?: Record<string, any>) => {
    if (!variants) return '';
    return Object.entries(variants)
      .map(([type, variant]) => `${type}: ${variant.name}`)
      .join(', ');
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) return;
    isNavigatingAway.current = true;
    navigate(`/shop/${outletSlug}/checkout`);
  };

  const handleRemoveVoucher = () => {
    clearVoucher();
  };

  // Check if a specific cart item is eligible for voucher discount
  const getItemDiscount = (item: CartItem, itemIndex: number) => {
    if (!selectedVoucher) return null;
    const voucher = selectedVoucher.voucher || selectedVoucher;
    const subtotal = calculateSubtotal();

    if (subtotal < (voucher.min_purchase || 0)) return null;

    // Check outlet eligibility - only validate if specifically restricted
    if (voucher.outlet_restriction_type === 'specific_outlets') {
      if (!voucher.applicable_outlet_ids || voucher.applicable_outlet_ids.length === 0) {
        return null; // No outlets selected means voucher can't be used anywhere
      }
      const currentOutletId = selectedOutlet?.id;
      if (!currentOutletId || !voucher.applicable_outlet_ids.includes(currentOutletId)) {
        return null; // Current outlet not in the allowed list
      }
    }
    // If outlet_restriction_type is 'all_outlets' or undefined, voucher works everywhere

    // Only for per-product vouchers
    if (voucher.application_scope === 'product_level' && voucher.product_application_method === 'per_product') {
      // Check if this item is eligible - MUST be explicitly in eligible list
      let isEligible = false;

      // Check product-level eligibility (most specific)
      if (voucher.eligible_product_ids && voucher.eligible_product_ids.length > 0) {
        isEligible = voucher.eligible_product_ids.includes(item.product_id);
      }
      // Check category-level eligibility
      else if (voucher.eligible_category_ids && voucher.eligible_category_ids.length > 0) {
        const categoryId = item.metadata?.category_id;
        if (!categoryId) {
          console.warn('⚠️ [Cart] Item missing category_id in metadata!', { product_id: item.product_id, metadata: item.metadata });
        }
        isEligible = categoryId && voucher.eligible_category_ids.includes(categoryId);
      }
      // Check subcategory-level eligibility
      else if (voucher.eligible_subcategory_ids && voucher.eligible_subcategory_ids.length > 0) {
        const subcategoryId = item.metadata?.subcategory_id;
        isEligible = subcategoryId && voucher.eligible_subcategory_ids.includes(subcategoryId);
      }
      // No eligibility criteria specified - voucher not properly configured
      else {
        console.warn('[Voucher] No eligible products specified for voucher:', voucher.code);
        return null;
      }

      if (!isEligible) return null;

      // Count how many products before this one already received discount
      let productsDiscountedBefore = 0;
      for (let i = 0; i < itemIndex; i++) {
        const previousItem = cartItems[i];
        let isPreviousEligible = false;

        if (voucher.eligible_product_ids && voucher.eligible_product_ids.length > 0) {
          isPreviousEligible = voucher.eligible_product_ids.includes(previousItem.product_id);
        } else if (voucher.eligible_category_ids && voucher.eligible_category_ids.length > 0) {
          const categoryId = previousItem.metadata?.category_id;
          isPreviousEligible = categoryId && voucher.eligible_category_ids.includes(categoryId);
        } else if (voucher.eligible_subcategory_ids && voucher.eligible_subcategory_ids.length > 0) {
          const subcategoryId = previousItem.metadata?.subcategory_id;
          isPreviousEligible = subcategoryId && voucher.eligible_subcategory_ids.includes(subcategoryId);
        }

        if (isPreviousEligible) {
          productsDiscountedBefore += previousItem.quantity;
        }
      }

      const maxProducts = voucher.max_products_per_use || 6;

      // If we've already reached the max, this item gets no discount
      if (productsDiscountedBefore >= maxProducts) {
        return null;
      }

      // Calculate how many units of this item can get discount
      const remainingSlots = maxProducts - productsDiscountedBefore;
      const discountedQuantity = Math.min(item.quantity, remainingSlots);

      // If none of this item's quantity gets discount, return null
      if (discountedQuantity === 0) {
        return null;
      }

      // Calculate discount for this item
      if (voucher.voucher_type === 'percent') {
        const discountPerItem = (item.unit_price * parseFloat(voucher.value)) / 100;
        return {
          type: 'percent',
          value: voucher.value,
          amount: discountPerItem,
          perQuantity: true,
          discountedQuantity,
          totalQuantity: item.quantity
        };
      } else if (voucher.voucher_type === 'amount') {
        return {
          type: 'amount',
          value: voucher.value,
          amount: parseFloat(voucher.value),
          perQuantity: true,
          discountedQuantity,
          totalQuantity: item.quantity
        };
      }
    }

    return null;
  };

  const calculateDiscount = () => {
    if (!selectedVoucher) return 0;
    const subtotal = calculateSubtotal();
    const voucher = selectedVoucher.voucher || selectedVoucher;

    console.group(`💰 Voucher Calculation: ${voucher.code}`);
    console.log('RAW selectedVoucher:', selectedVoucher);
    console.log('Voucher Configuration:', {
      code: voucher.code,
      type: voucher.voucher_type,
      value: voucher.value,
      application_scope: voucher.application_scope,
      product_application_method: voucher.product_application_method,
      min_purchase: voucher.min_purchase,
      eligible_product_ids: voucher.eligible_product_ids,
      eligible_product_ids_type: typeof voucher.eligible_product_ids,
      eligible_product_ids_length: voucher.eligible_product_ids?.length
    });
    console.log('Cart Subtotal:', subtotal);

    if (!voucher.code || !voucher.voucher_type || !voucher.value) {
      console.error('❌ ERROR: Voucher missing critical fields (code, voucher_type, or value)');
      console.groupEnd();
      return 0;
    }

    if (subtotal < (voucher.min_purchase || 0)) {
      console.warn(`❌ Minimum purchase not met! Need RM${voucher.min_purchase}, have RM${subtotal}`);
      console.groupEnd();
      return 0;
    }

    // Check outlet eligibility - only validate if specifically restricted
    if (voucher.outlet_restriction_type === 'specific_outlets') {
      if (!voucher.applicable_outlet_ids || voucher.applicable_outlet_ids.length === 0) {
        console.warn(`❌ Voucher has specific outlet restriction but no outlets selected!`);
        console.groupEnd();
        return 0; // No outlets selected means voucher can't be used anywhere
      }
      const currentOutletId = selectedOutlet?.id;
      if (!currentOutletId || !voucher.applicable_outlet_ids.includes(currentOutletId)) {
        console.warn(`❌ Voucher not applicable at current outlet!`);
        console.log('Current outlet ID:', currentOutletId);
        console.log('Applicable outlet IDs:', voucher.applicable_outlet_ids);
        console.groupEnd();
        return 0; // Current outlet not in the allowed list
      }
      console.log('✅ Outlet eligibility check passed');
    } else {
      console.log('✅ Voucher applies to all outlets');
    }

    // Provide default values for NULL/undefined fields
    const effectiveApplicationScope = voucher.application_scope || 'order_total';
    const effectiveProductMethod = voucher.product_application_method || 'total_once';

    if (!voucher.application_scope) {
      console.warn('⚠️ application_scope is NULL, defaulting to "order_total"');
    }
    if (!voucher.product_application_method && effectiveApplicationScope === 'product_level') {
      console.warn('⚠️ product_application_method is NULL, defaulting to "total_once"');
    }

    // Product-level vouchers with per-product application method
    if (effectiveApplicationScope === 'product_level' && effectiveProductMethod === 'per_product') {
      console.log('[Voucher Debug] Per-product voucher detected:', voucher.code);
      console.log('[Voucher Debug] Voucher type:', voucher.voucher_type, 'Value:', voucher.value);

      // Count applicable products in cart
      let applicableCount = 0;
      let totalDiscount = 0;

      // If specific products are restricted
      if (voucher.eligible_product_ids && voucher.eligible_product_ids.length > 0) {
        console.log('[Voucher Debug] Eligible product IDs:', voucher.eligible_product_ids);
        console.log('[Voucher Debug] Cart items:', cartItems.map(i => ({
          id: i.product_id,
          mappedId: productMapping.get(i.product_id),
          name: i.metadata?.product_name,
          qty: i.quantity
        })));

        const matchingItems = cartItems.filter(item => {
          const productIdString = productMapping.get(item.product_id);
          return productIdString && voucher.eligible_product_ids.includes(productIdString);
        });
        console.log('[Voucher Debug] Matching items:', matchingItems.length, 'items');

        applicableCount = matchingItems.reduce((sum, item) => sum + item.quantity, 0);
        console.log('[Voucher Debug] Applicable count:', applicableCount, 'products');
      }
      // If categories are restricted
      else if (voucher.eligible_category_ids && voucher.eligible_category_ids.length > 0) {
        console.log('[Voucher Debug] Eligible category IDs:', voucher.eligible_category_ids);
        console.log('[Voucher Debug] Cart items:', cartItems.map(i => ({
          id: i.product_id,
          name: i.metadata?.product_name,
          category_id: i.metadata?.category_id,
          qty: i.quantity
        })));

        const matchingItems = cartItems.filter(item => {
          const categoryId = item.metadata?.category_id;
          return categoryId && voucher.eligible_category_ids.includes(categoryId);
        });
        console.log('[Voucher Debug] Matching items by category:', matchingItems.length, 'items');

        applicableCount = matchingItems.reduce((sum, item) => sum + item.quantity, 0);
        console.log('[Voucher Debug] Applicable count:', applicableCount, 'products');
      }
      // If subcategories are restricted
      else if (voucher.eligible_subcategory_ids && voucher.eligible_subcategory_ids.length > 0) {
        console.log('[Voucher Debug] Eligible subcategory IDs:', voucher.eligible_subcategory_ids);
        console.log('[Voucher Debug] Cart items:', cartItems.map(i => ({
          id: i.product_id,
          name: i.metadata?.product_name,
          subcategory_id: i.metadata?.subcategory_id,
          qty: i.quantity
        })));

        const matchingItems = cartItems.filter(item => {
          const subcategoryId = item.metadata?.subcategory_id;
          return subcategoryId && voucher.eligible_subcategory_ids.includes(subcategoryId);
        });
        console.log('[Voucher Debug] Matching items by subcategory:', matchingItems.length, 'items');

        applicableCount = matchingItems.reduce((sum, item) => sum + item.quantity, 0);
        console.log('[Voucher Debug] Applicable count:', applicableCount, 'products');
      }
      // No eligibility criteria specified
      else {
        console.warn('[Voucher Debug] No eligible products specified - voucher not properly configured');
        return 0;
      }

      // Cap at max_products_per_use
      const maxProducts = voucher.max_products_per_use || 6;
      const effectiveCount = Math.min(applicableCount, maxProducts);
      console.log('[Voucher Debug] Effective count:', effectiveCount, '(max:', maxProducts + ')');

      if (voucher.voucher_type === 'percent') {
        // For per-product percentage: apply percentage to each applicable item (only eligible ones)
        if (voucher.eligible_product_ids && voucher.eligible_product_ids.length > 0) {
          cartItems.forEach(item => {
            const productIdString = productMapping.get(item.product_id);
            if (productIdString && voucher.eligible_product_ids.includes(productIdString)) {
              const itemDiscount = (item.unit_price * parseFloat(voucher.value)) / 100;
              const itemsToDiscount = Math.min(item.quantity, effectiveCount - (totalDiscount / itemDiscount));
              totalDiscount += itemDiscount * itemsToDiscount;
            }
          });
        } else if (voucher.eligible_category_ids && voucher.eligible_category_ids.length > 0) {
          console.log('[Cart Debug] Calculating category-based discount');
          cartItems.forEach(item => {
            const categoryId = item.metadata?.category_id;
            if (!categoryId) {
              console.warn('⚠️ [Cart] Missing category_id when calculating discount', item.product_id);
            }
            if (categoryId && voucher.eligible_category_ids.includes(categoryId)) {
              const itemDiscount = (item.unit_price * parseFloat(voucher.value)) / 100;
              const itemsToDiscount = Math.min(item.quantity, effectiveCount - (totalDiscount / itemDiscount));
              console.log(`[Cart Debug] Discount for ${item.product_id}: RM${(itemDiscount * itemsToDiscount).toFixed(2)}`);
              totalDiscount += itemDiscount * itemsToDiscount;
            }
          });
          console.log('[Cart Debug] Total discount:', totalDiscount);
        } else if (voucher.eligible_subcategory_ids && voucher.eligible_subcategory_ids.length > 0) {
          cartItems.forEach(item => {
            const subcategoryId = item.metadata?.subcategory_id;
            if (subcategoryId && voucher.eligible_subcategory_ids.includes(subcategoryId)) {
              const itemDiscount = (item.unit_price * parseFloat(voucher.value)) / 100;
              const itemsToDiscount = Math.min(item.quantity, effectiveCount - (totalDiscount / itemDiscount));
              totalDiscount += itemDiscount * itemsToDiscount;
            }
          });
        }
      } else if (voucher.voucher_type === 'amount') {
        // For per-product fixed amount: multiply by number of applicable products
        totalDiscount = parseFloat(voucher.value) * effectiveCount;
        console.log('[Voucher Debug] Calculated discount: RM' + voucher.value + ' × ' + effectiveCount + ' = RM' + totalDiscount);
      }

      // Cap discount at subtotal
      const finalDiscount = Math.min(totalDiscount, subtotal);
      console.log('[Voucher Debug] Final discount:', finalDiscount, '(capped at subtotal:', subtotal + ')');
      console.log(`✅ Total Discount: RM ${finalDiscount.toFixed(2)}`);
      console.groupEnd();
      return finalDiscount;
    }

    // Order-total or product-level with total_once application method (original behavior)
    console.log('ℹ️ Using order-level discount calculation (scope:', effectiveApplicationScope, ', method:', effectiveProductMethod, ')');
    let orderDiscount = 0;
    if (voucher.voucher_type === 'percent') {
      orderDiscount = (subtotal * parseFloat(voucher.value)) / 100;
    } else if (voucher.voucher_type === 'amount') {
      orderDiscount = Math.min(parseFloat(voucher.value), subtotal);
    } else if (voucher.voucher_type === 'free_gift') {
      // Free gifts don't affect the discount amount (gift is added as item with RM 0.00)
      orderDiscount = 0;
    }
    console.log(`✅ Order Discount: RM ${orderDiscount.toFixed(2)}`);
    console.groupEnd();
    return orderDiscount;
  };

  const calculateTotal = () => {
    return Math.max(0, calculateSubtotal() - calculateDiscount() - appliedBonusAmount);
  };

  const handleApplyBonus = () => {
    if (bonusBalance === 0) {
      setShowBonusTopupModal(true);
      return;
    }
    setShowBonusModal(true);
  };

  const handleBonusTopup = () => {
    setShowBonusTopupModal(false);
    navigate('/wallet/topup');
  };

  const handleBonusApply = (amount: number) => {
    const subtotalAfterVoucher = calculateSubtotal() - calculateDiscount();
    const maxBonus = Math.min(bonusBalance, subtotalAfterVoucher);
    const safeAmount = Math.min(amount, maxBonus);
    const finalTotal = subtotalAfterVoucher - safeAmount;

    if (finalTotal < 0) {
      setAppliedBonusAmount(subtotalAfterVoucher);
    } else {
      setAppliedBonusAmount(safeAmount);
    }
  };

  const handleVoucherButtonClick = () => {
    if (appliedBonusAmount > 0) {
      setBonusRemovalModal(true);
      setPendingVoucherAction(selectedVoucher ? 'change' : 'select');
    } else {
      setShowVouchers(true);
    }
  };

  const handleConfirmBonusRemoval = () => {
    clearBonus();
    setBonusRemovalModal(false);
    setPendingVoucherAction(null);
    setShowVouchers(true);
  };

  const handleCancelBonusRemoval = () => {
    setBonusRemovalModal(false);
    setPendingVoucherAction(null);
  };

  const handleVoucherBannerClick = async () => {
    await refreshVouchers();
    if (appliedBonusAmount > 0) {
      setBonusRemovalModal(true);
      setPendingVoucherAction('select');
    } else {
      setShowVouchers(true);
    }
  };

  const handleRemoveBonus = () => {
    setAppliedBonusAmount(0);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please login to view your cart</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 gradient-primary text-white rounded-xl font-bold"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-36 bg-gradient-to-b from-primary-50 to-white">
      <PageHeader />
      <VoucherBanner
        voucherCode={selectedVoucher?.code || selectedVoucher?.voucher?.code}
        voucherTitle={selectedVoucher?.title || selectedVoucher?.voucher?.title}
        isApplied={!!selectedVoucher}
        onApply={handleVoucherBannerClick}
        onRemove={handleRemoveVoucher}
      />
      <div className="glass border-b border-white/20 backdrop-blur-2xl max-w-md mx-auto mt-[120px]">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/50 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Shopping Cart</h1>
            <p className="text-xs text-gray-600">{cartItems.length} items</p>
          </div>
        </div>
      </div>

      {selectedOutlet && (
        <div className="max-w-md mx-auto px-4 mt-4">
          <div className="glass-strong border-2 border-primary-500 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-bold text-primary-700 uppercase tracking-wide">Purchase Location</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <MapPin className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-gray-900">{selectedOutlet.name}</h3>
                <p className="text-xs text-gray-600 mt-0.5">{selectedOutlet.location}</p>
                <p className="text-xs text-gray-500 mt-0.5">{selectedOutlet.address}</p>
              </div>
            </div>
            <div className="mt-3 p-2 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-xs text-orange-800 font-semibold">
                ⚠️ All items in your cart are for this outlet only
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 pt-4 pb-48 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : cartItems.length === 0 ? (
          <div className="glass p-8 rounded-2xl text-center space-y-3">
            <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto" />
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Your cart is empty</h3>
              <p className="text-sm text-gray-600">Add some items to get started</p>
            </div>
            <button
              onClick={() => navigate(`/shop/${outletSlug}`)}
              className="px-6 py-2.5 gradient-primary text-white rounded-xl font-bold hover:scale-105 transition-transform"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2.5">
              {cartItems.map((item, itemIndex) => (
                <div key={item.id} className="glass p-3.5 rounded-2xl space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 text-base">{item.metadata.product_name}</h3>
                      <p className="text-xs text-primary-600 font-semibold">{item.metadata.category}</p>

                      {item.visit_date && (
                        <p className="text-xs text-gray-600 mt-0.5">
                          Visit: {new Date(item.visit_date).toLocaleDateString()}
                        </p>
                      )}

                      {item.metadata.variants && (
                        <p className="text-xs text-gray-600 mt-0.5">
                          {formatVariants(item.metadata.variants)}
                        </p>
                      )}

                      {item.metadata.addons && Array.isArray(item.metadata.addons) && item.metadata.addons.length > 0 && (
                        <p className="text-xs text-gray-600 mt-0.5">
                          Add-ons: {item.metadata.addons.join(', ')}
                        </p>
                      )}

                      {item.metadata.selected_modifiers && Array.isArray(item.metadata.selected_modifiers) && item.metadata.selected_modifiers.length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {item.metadata.selected_modifiers.map((group: any, groupIndex: number) => (
                            <div key={groupIndex} className="text-xs text-gray-600">
                              <span className="font-semibold text-gray-700">{group.group_name}:</span>
                              {' '}
                              {group.selected_options.map((opt: any, optIndex: number) => (
                                <span key={optIndex}>
                                  {opt.quantity > 1 && <span className="font-semibold">{opt.quantity}x </span>}
                                  {opt.option_name}
                                  {opt.addon_price > 0 && (
                                    <span className="text-gray-500"> (+RM {(opt.addon_price * opt.quantity).toFixed(2)})</span>
                                  )}
                                  {optIndex < group.selected_options.length - 1 && ', '}
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleRemoveClick(item.id, item.metadata.product_name)}
                      className="p-1.5 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">Qty:</span>
                      <span className="text-sm font-bold text-gray-900">{item.quantity}</span>
                    </div>
                    <div className="text-right">
                      {(() => {
                        const discount = getItemDiscount(item, itemIndex);
                        if (discount) {
                          const discountedQty = discount.discountedQuantity || item.quantity;
                          const totalItemDiscount = discount.amount * discountedQty;
                          const originalPrice = item.unit_price * item.quantity;
                          const finalPrice = originalPrice - totalItemDiscount;
                          const isPartialDiscount = discountedQty < item.quantity;

                          return (
                            <>
                              <div className="flex items-center justify-end gap-2">
                                <p className="text-sm text-gray-400 line-through">
                                  RM {originalPrice.toFixed(2)}
                                </p>
                                <div className="px-2 py-0.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full animate-pulse">
                                  <p className="text-[10px] font-black text-white">
                                    {discount.type === 'percent' ? `-${discount.value}%` : `-RM${discount.value}`}
                                  </p>
                                </div>
                              </div>
                              <p className="text-lg font-black text-green-600 mt-1 animate-bounce">
                                RM {finalPrice.toFixed(2)}
                              </p>
                              <div className="flex items-center justify-end gap-1 mt-1">
                                <Sparkles className="w-3 h-3 text-amber-500 animate-spin" />
                                <p className="text-[10px] font-bold text-amber-600">
                                  YOU SAVE RM {totalItemDiscount.toFixed(2)}!
                                </p>
                              </div>
                              {isPartialDiscount && (
                                <p className="text-[9px] text-gray-500 mt-0.5">
                                  Discount applied to {discountedQty} of {item.quantity} items
                                </p>
                              )}
                            </>
                          );
                        }
                        return (
                          <p className="text-lg font-black text-gray-900">
                            RM {(item.unit_price * item.quantity).toFixed(2)}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedVoucher && (selectedVoucher.voucher || selectedVoucher).voucher_type === 'free_gift' && (
              <div className="glass p-3.5 rounded-2xl border-2 border-dashed border-pink-300 bg-gradient-to-br from-pink-50 to-rose-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5 text-pink-600" />
                      <h3 className="font-bold text-gray-900 text-base">
                        FREE GIFT - {(selectedVoucher.voucher || selectedVoucher).free_gift_name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-1 bg-pink-100 text-pink-700 rounded-full font-bold">
                        FREE
                      </span>
                      <p className="text-xs text-gray-600">
                        Complimentary with voucher: {(selectedVoucher.voucher || selectedVoucher).code}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-400 line-through">RM 0.00</p>
                      <div className="px-2 py-0.5 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full">
                        <p className="text-[10px] font-black text-white">FREE</p>
                      </div>
                    </div>
                    <p className="text-lg font-black text-pink-600 mt-1">RM 0.00</p>
                    <p className="text-[10px] text-gray-500 mt-1">Qty: 1</p>
                  </div>
                </div>
              </div>
            )}

            {calculateDiscount() > 0 && showSavingsCelebration && (
              <div className="glass-strong border-2 border-green-500 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4 rounded-2xl shadow-lg animate-bounce-subtle relative overflow-hidden z-10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400/20 to-emerald-400/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-teal-400/20 to-cyan-400/20 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>

                <div className="relative z-10">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full animate-spin-slow">
                      <TrendingDown className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-black text-gray-900 animate-pulse">AMAZING SAVINGS!</h3>
                    <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full animate-spin-slow" style={{ animationDelay: '0.3s' }}>
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                  </div>

                  <div className="text-center space-y-1">
                    <p className="text-sm text-gray-700 font-semibold">You're saving with voucher:</p>
                    <p className="text-xs font-bold text-green-700 bg-white/60 px-3 py-1 rounded-full inline-block">
                      {(selectedVoucher.voucher || selectedVoucher).code}
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-300 to-transparent"></div>
                      <div className="px-4 py-2 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 rounded-full shadow-lg animate-pulse">
                        <p className="text-2xl font-black text-white">
                          RM {calculateDiscount().toFixed(2)}
                        </p>
                      </div>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-300 to-transparent"></div>
                    </div>
                    <p className="text-xs text-gray-600 font-semibold mt-2">
                      🎉 Keep shopping to save even more!
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="glass p-4 rounded-2xl space-y-3">
              <h3 className="font-bold text-gray-900 text-base">Order Summary</h3>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Subtotal</span>
                  <span className={`text-sm font-semibold ${calculateDiscount() > 0 ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                    RM {calculateSubtotal().toFixed(2)}
                  </span>
                </div>
                {selectedVoucher && calculateDiscount() > 0 && (
                  <div className="flex justify-between text-sm animate-slide-up bg-green-50 -mx-2 px-2 py-1.5 rounded-lg">
                    <div className="flex items-center gap-1">
                      <Ticket className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-green-700 font-bold">Voucher Discount</span>
                    </div>
                    <span className="font-black text-green-600">
                      - RM {calculateDiscount().toFixed(2)}
                    </span>
                  </div>
                )}
                {appliedBonusAmount > 0 && (
                  <div className="flex justify-between text-sm animate-slide-up bg-orange-50 -mx-2 px-2 py-1.5 rounded-lg">
                    <div className="flex items-center gap-1">
                      <Gift className="w-3.5 h-3.5 text-orange-600" />
                      <span className="text-orange-700 font-bold">Bonus Discount</span>
                    </div>
                    <span className="font-black text-orange-600">
                      - RM {appliedBonusAmount.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-gray-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900 text-base">Total</span>
                  <div className="text-right">
                    {(calculateDiscount() > 0 || appliedBonusAmount > 0) && (
                      <p className="text-xs text-gray-400 line-through mb-1">
                        RM {calculateSubtotal().toFixed(2)}
                      </p>
                    )}
                    <span className={`text-xl font-black ${(calculateDiscount() > 0 || appliedBonusAmount > 0) ? 'text-green-600' : 'text-gray-900'}`}>
                      RM {calculateTotal().toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleVoucherButtonClick}
                  className="w-full p-3 rounded-xl border-2 border-dashed border-orange-300 hover:border-orange-400 hover:bg-orange-50 transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-orange-600" />
                      <span className="text-sm font-bold text-gray-900">
                        {selectedVoucher ? 'Change Voucher' : 'Select Voucher'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                  {selectedVoucher && (
                    <p className="text-xs text-green-600 font-semibold mt-1 ml-6">
                      Voucher ({(selectedVoucher.voucher || selectedVoucher).code}) applied
                    </p>
                  )}
                </button>

                <button
                  onClick={appliedBonusAmount > 0 ? handleRemoveBonus : handleApplyBonus}
                  disabled={calculateSubtotal() - calculateDiscount() <= 0}
                  className={`w-full p-3 rounded-xl border-2 transition-all text-left ${appliedBonusAmount > 0
                    ? 'border-orange-400 bg-orange-50'
                    : bonusBalance > 0
                      ? 'border-dashed border-orange-300 hover:border-orange-400 hover:bg-orange-50'
                      : 'border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gift className={`w-4 h-4 ${appliedBonusAmount > 0 || bonusBalance > 0
                        ? 'text-orange-600'
                        : 'text-gray-400'
                        }`} />
                      <span className="text-sm font-bold text-gray-900">
                        {appliedBonusAmount > 0 ? 'Remove Bonus' : 'Apply Bonus Discount'}
                      </span>
                    </div>
                    {appliedBonusAmount > 0 ? (
                      <X className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <p className="text-xs font-semibold mt-1 ml-6">
                    {appliedBonusAmount > 0 ? (
                      <span className="text-orange-600">RM {appliedBonusAmount.toFixed(2)} Bonus applied</span>
                    ) : bonusBalance > 0 ? (
                      <span className="text-gray-600">Available: RM {bonusBalance.toFixed(2)}</span>
                    ) : (
                      <span className="text-gray-500">No bonus available</span>
                    )}
                  </p>
                </button>

                {(calculateDiscount() > 0 || appliedBonusAmount > 0) && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span className="text-xs text-amber-900 font-bold">
                      Total Savings: RM {(calculateDiscount() + appliedBonusAmount).toFixed(2)} 🎉
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 rounded-xl">
                  <Star className="w-4 h-4 text-primary-600" fill="currentColor" />
                  <span className="text-xs text-gray-700">
                    Earn up to <span className="font-bold text-primary-600">{calculateStarsEarning('wonderstars')} stars</span> with WonderStars
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {cartItems.length > 0 && (
        <div className="fixed bottom-[88px] left-1/2 -translate-x-1/2 w-full max-w-md z-40 px-4">
          <div className="glass border-t border-white/20 backdrop-blur-2xl p-4 rounded-t-2xl">
            <button
              onClick={handleCheckout}
              className="w-full py-3 gradient-primary text-white rounded-xl font-bold text-base hover:scale-105 active:scale-95 transition-transform"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
      <BottomNav />

      {showVouchers && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-t-3xl animate-slide-up max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">Select Voucher</h2>
              <button
                onClick={() => setShowVouchers(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 pt-4">
              {vouchersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : availableVouchers.length === 0 ? (
                <div className="text-center py-8">
                  <Ticket className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No vouchers available</p>
                  <p className="text-sm text-gray-500 mt-1">Redeem voucher codes to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableVouchers.map((userVoucher) => {
                    const voucher = userVoucher.voucher;
                    if (!voucher) return null;

                    const isSelected = selectedVoucher?.id === userVoucher.id;
                    const subtotal = calculateSubtotal();
                    const minPurchase = voucher.min_purchase || 0;
                    const canUse = subtotal >= minPurchase && userVoucher.usage_count < userVoucher.max_usage_count;

                    return (
                      <button
                        key={userVoucher.id}
                        onClick={() => {
                          if (canUse) {
                            setSelectedVoucher(isSelected ? null : userVoucher);
                            setShowVouchers(false);
                          }
                        }}
                        disabled={!canUse}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${isSelected
                          ? 'border-orange-500 bg-orange-50'
                          : canUse
                            ? 'border-gray-200 bg-white hover:border-orange-300'
                            : 'border-gray-200 bg-gray-50 opacity-60'
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-orange-100 rounded-lg flex-shrink-0">
                            <Ticket className="w-5 h-5 text-orange-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 text-sm">
                              {voucher.title || voucher.code}
                            </h3>
                            {voucher.description && (
                              <p className="text-xs text-gray-600 mt-0.5">{voucher.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <p className="text-xs text-gray-500">
                                Min. spend: RM {minPurchase.toFixed(2)}
                              </p>
                              {voucher.voucher_type === 'percent' && (
                                <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-semibold">
                                  {voucher.value}% OFF
                                </span>
                              )}
                              {voucher.voucher_type === 'amount' && (
                                <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-semibold">
                                  RM{voucher.value} OFF
                                </span>
                              )}
                            </div>
                            {userVoucher.max_usage_count < 99999 && (
                              <p className="text-xs text-gray-500 mt-1">
                                Uses: {userVoucher.usage_count}/{userVoucher.max_usage_count}
                              </p>
                            )}
                            {!canUse && subtotal < minPurchase && (
                              <p className="text-xs text-red-600 font-semibold mt-1">
                                Spend RM {(minPurchase - subtotal).toFixed(2)} more to use
                              </p>
                            )}
                            {!canUse && userVoucher.usage_count >= userVoucher.max_usage_count && (
                              <p className="text-xs text-red-600 font-semibold mt-1">
                                Usage limit reached
                              </p>
                            )}
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false })}
        onConfirm={removeItem}
        title="Remove Item"
        message={`Remove "${confirmModal.itemName}" from your cart? Any voucher or bonus discount will be removed. Please apply again.`}
        confirmText="Remove"
        cancelText="Keep it"
        type="danger"
      />

      <BonusSliderModal
        isOpen={showBonusModal}
        onClose={() => setShowBonusModal(false)}
        bonusBalance={bonusBalance}
        subtotal={calculateSubtotal()}
        discount={calculateDiscount()}
        onApply={handleBonusApply}
      />

      {showBonusTopupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                <Gift className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                No Bonus Available
              </h3>
              <p className="text-gray-600">
                Kindly topup W Balance to enjoy Bonus Discount
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <button
                onClick={handleBonusTopup}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg"
              >
                Topup now
              </button>
              <button
                onClick={() => setShowBonusTopupModal(false)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={bonusRemovalModal}
        onClose={handleCancelBonusRemoval}
        onConfirm={handleConfirmBonusRemoval}
        title="Remove Bonus Discount?"
        message="Bonus discount will be removed. After selecting a voucher, you can apply Bonus Discount again."
        confirmText="Yes"
        cancelText="Cancel"
        type="warning"
      />
    </div>
  );
};

export default ShopCart;
