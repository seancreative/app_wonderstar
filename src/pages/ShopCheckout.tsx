import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Star, Wallet, CreditCard, Smartphone, Check, ChevronRight, Ticket, X, Plus, AlertCircle, Trophy, MapPin, Store, Loader2, Gift, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useShop } from '../contexts/ShopContext';
import { useWallet } from '../hooks/useWallet';
import { useMasterBalances } from '../hooks/useMasterBalances';
import { useStars } from '../hooks/useStars';
import { useStamps } from '../hooks/useStamps';
import { useVouchers } from '../hooks/useVouchers';
import { fiuuService } from '../services/fiuuService';
import { wpayService } from '../services/wpayService';
import { activityTimelineService } from '../services/activityTimelineService';
import PageHeader from '../components/Layout/PageHeader';
import BottomNav from '../components/Layout/BottomNav';
import VoucherBanner from '../components/VoucherBanner';
import BonusSliderModal from '../components/BonusSliderModal';

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  visit_date?: string;
  metadata: any;
}

interface Voucher {
  id: string;
  code: string;
  title: string;
  description: string;
  type: 'discount' | 'gift';
  value: number;
  minSpend: number;
}

const ShopCheckout: React.FC = () => {
  const navigate = useNavigate();
  const { outletSlug } = useParams();
  const { user, reloadUser } = useAuth();
  const { selectedOutlet, refreshCartCount, selectedVoucher: contextVoucher, setSelectedVoucher: setContextVoucher, clearVoucher, appliedBonusAmount, setAppliedBonusAmount, clearBonus } = useShop();
  const { spend } = useWallet(); // Keep for spending function only
  const { balances, loading: balancesLoading } = useMasterBalances({
    userId: user?.id || null,
    userEmail: user?.email || null
  });
  const balance = balances?.wBalance || 0;
  const bonusBalance = balances?.bonusBalance || 0;
  const { earnStars, currentTier } = useStars();
  const { calculateStampsFromOrder, awardStamps } = useStamps();
  const { availableVouchers, loading: vouchersLoading, refresh: refreshVouchers } = useVouchers(user?.id);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [outletId, setOutletId] = useState<string>('');
  const [selectedPayment, setSelectedPayment] = useState<string>('wonderstars');
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showVouchers, setShowVouchers] = useState(false);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [showBonusTopupModal, setShowBonusTopupModal] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<any | null>(null);
  const [showOtherPayments, setShowOtherPayments] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentStep, setPaymentStep] = useState<'idle' | 'creating_order' | 'redirecting'>('idle');
  const [autoApplied, setAutoApplied] = useState(false);
  const [productMapping, setProductMapping] = useState<Map<string, string>>(new Map());
  const [isCompletingOrder, setIsCompletingOrder] = useState(false);

  useEffect(() => {
    if (user) {
      refreshVouchers();
    }
  }, [user]);

  useEffect(() => {
    if (contextVoucher && !autoApplied && cartItems.length > 0) {
      const subtotal = calculateSubtotal();
      const voucher = contextVoucher.voucher || contextVoucher;
      const minPurchase = voucher.min_purchase || 0;

      if (subtotal >= minPurchase && contextVoucher.usage_count < contextVoucher.max_usage_count) {
        setSelectedVoucher(contextVoucher);
        setAutoApplied(true);
      } else if (subtotal < minPurchase) {
        setErrorMessage(`This voucher requires a minimum purchase of RM ${minPurchase.toFixed(2)}`);
        setShowErrorModal(true);
        clearVoucher();
      }
    }
  }, [contextVoucher, cartItems, autoApplied]);

  const otherPaymentMethods = [
    {
      id: 'card',
      name: 'Credit/Debit Card',
      icon: CreditCard,
      badge: '+2.5 Stars per RM',
      description: 'Visa, Mastercard, Amex'
    },
    {
      id: 'fpx',
      name: 'FPX Online Banking',
      icon: Smartphone,
      badge: '+2.5 Stars per RM',
      description: 'Malaysian banks'
    },
    {
      id: 'grabpay',
      name: 'GrabPay',
      icon: Smartphone,
      badge: '+2.5 Stars per RM',
      description: 'Pay with GrabPay wallet'
    },
    {
      id: 'tng',
      name: 'Touch \'n Go eWallet',
      icon: Smartphone,
      badge: '+2.5 Stars per RM',
      description: 'Pay with TnG eWallet'
    },
  ];

  useEffect(() => {
    if (user) {
      loadCart();
    }
  }, [user]);

  const loadCart = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('shop_cart_items')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      if (!data || data.length === 0) {
        // Don't redirect if we're in the middle of completing an order
        if (!isCompletingOrder) {
          navigate(`/shop/${outletSlug}/cart`);
        }
        return;
      }

      setCartItems(data);
      if (data[0]?.outlet_id) {
        setOutletId(data[0].outlet_id);
      }

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

  const calculateSubtotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  };

  const calculateTierDiscount = () => {
    const subtotal = calculateSubtotal();
    const discountPct = currentTier?.shop_discount_pct || 0;
    return (subtotal * discountPct) / 100;
  };

  // Check if a specific cart item is eligible for voucher discount
  const getItemDiscount = (item: any, itemIndex: number) => {
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
      const productIdString = productMapping.get(item.product_id);

      // Check if eligible
      let isEligible = false;
      if (voucher.eligible_product_ids && voucher.eligible_product_ids.length > 0) {
        isEligible = productIdString ? voucher.eligible_product_ids.includes(productIdString) : false;
      } else if (voucher.eligible_category_ids && voucher.eligible_category_ids.length > 0) {
        const categoryId = item.metadata?.category_id;
        isEligible = categoryId && voucher.eligible_category_ids.includes(categoryId);
      } else if (voucher.eligible_subcategory_ids && voucher.eligible_subcategory_ids.length > 0) {
        const subcategoryId = item.metadata?.subcategory_id;
        isEligible = subcategoryId && voucher.eligible_subcategory_ids.includes(subcategoryId);
      } else {
        return null;
      }

      if (!isEligible) return null;

      // Count how many products before this one already got discount
      const maxProducts = voucher.max_products_per_use || 6;
      let productsDiscountedBefore = 0;

      for (let i = 0; i < itemIndex; i++) {
        const prevItem = cartItems[i];
        let prevIsEligible = false;

        if (voucher.eligible_product_ids && voucher.eligible_product_ids.length > 0) {
          const prevProductId = productMapping.get(prevItem.product_id);
          prevIsEligible = prevProductId ? voucher.eligible_product_ids.includes(prevProductId) : false;
        } else if (voucher.eligible_category_ids && voucher.eligible_category_ids.length > 0) {
          const prevCategoryId = prevItem.metadata?.category_id;
          prevIsEligible = prevCategoryId && voucher.eligible_category_ids.includes(prevCategoryId);
        } else if (voucher.eligible_subcategory_ids && voucher.eligible_subcategory_ids.length > 0) {
          const prevSubcategoryId = prevItem.metadata?.subcategory_id;
          prevIsEligible = prevSubcategoryId && voucher.eligible_subcategory_ids.includes(prevSubcategoryId);
        }

        if (prevIsEligible) {
          productsDiscountedBefore += prevItem.quantity;
        }
      }

      // Check how many of this item can get discount
      const remainingSlots = maxProducts - productsDiscountedBefore;
      if (remainingSlots <= 0) return null;

      const quantityWithDiscount = Math.min(item.quantity, remainingSlots);
      const isMaxReached = productsDiscountedBefore + quantityWithDiscount >= maxProducts;

      // Calculate discount
      if (voucher.voucher_type === 'percent') {
        const discountPerItem = (item.unit_price * parseFloat(voucher.value)) / 100;
        return {
          type: 'percent',
          value: voucher.value,
          amount: discountPerItem,
          quantityWithDiscount,
          isMaxReached
        };
      } else if (voucher.voucher_type === 'amount') {
        return {
          type: 'amount',
          value: voucher.value,
          amount: parseFloat(voucher.value),
          quantityWithDiscount,
          isMaxReached
        };
      }
    }

    return null;
  };

  const isVoucherMaxReached = () => {
    if (!selectedVoucher) return false;
    const voucher = selectedVoucher.voucher || selectedVoucher;

    if (voucher.application_scope === 'product_level' && voucher.product_application_method === 'per_product') {
      let applicableCount = 0;

      if (voucher.eligible_product_ids && voucher.eligible_product_ids.length > 0) {
        applicableCount = cartItems.filter(item => {
          const productIdString = productMapping.get(item.product_id);
          return productIdString && voucher.eligible_product_ids.includes(productIdString);
        }).reduce((sum, item) => sum + item.quantity, 0);
      } else if (voucher.eligible_category_ids && voucher.eligible_category_ids.length > 0) {
        applicableCount = cartItems.filter(item => {
          const categoryId = item.metadata?.category_id;
          return categoryId && voucher.eligible_category_ids.includes(categoryId);
        }).reduce((sum, item) => sum + item.quantity, 0);
      } else if (voucher.eligible_subcategory_ids && voucher.eligible_subcategory_ids.length > 0) {
        applicableCount = cartItems.filter(item => {
          const subcategoryId = item.metadata?.subcategory_id;
          return subcategoryId && voucher.eligible_subcategory_ids.includes(subcategoryId);
        }).reduce((sum, item) => sum + item.quantity, 0);
      }

      if (applicableCount > 0) {
        const maxProducts = voucher.max_products_per_use || 6;
        return applicableCount > maxProducts;
      }
    }
    return false;
  };

  // Calculate item-level discounts for detailed tracking
  const buildOrderItemsWithDiscounts = () => {
    const voucher = selectedVoucher?.voucher || selectedVoucher;
    const tierDiscountPct = currentTier?.shop_discount_pct || 0;

    return cartItems.map((item, itemIndex) => {
      const itemSubtotal = item.unit_price * item.quantity;
      let voucherDiscountForItem = 0;
      let tierDiscountForItem = (itemSubtotal * tierDiscountPct) / 100;

      // Calculate voucher discount for this item
      const itemDiscount = getItemDiscount(item, itemIndex);
      if (itemDiscount) {
        voucherDiscountForItem = itemDiscount.amount * itemDiscount.quantityWithDiscount;
      }

      const totalItemDiscount = voucherDiscountForItem + tierDiscountForItem;
      const finalItemPrice = Math.max(0, itemSubtotal - totalItemDiscount);

      return {
        product_id: item.product_id,
        product_name: item.metadata.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        item_discount_amount: totalItemDiscount,
        item_discount_type: voucherDiscountForItem > 0 ? 'voucher' : tierDiscountForItem > 0 ? 'tier' : 'none',
        voucher_discount_amount: voucherDiscountForItem,
        tier_discount_amount: tierDiscountForItem,
        total_price: finalItemPrice,
        metadata: {
          ...item.metadata,
          original_subtotal: itemSubtotal,
          discount_breakdown: {
            voucher: voucherDiscountForItem,
            tier: tierDiscountForItem,
            total: totalItemDiscount
          }
        }
      };
    });
  };

  const calculateDiscount = () => {
    if (!selectedVoucher) return 0;
    const subtotal = calculateSubtotal();
    const voucher = selectedVoucher.voucher || selectedVoucher;

    if (subtotal < (voucher.min_purchase || 0)) return 0;

    // Check outlet eligibility - only validate if specifically restricted
    if (voucher.outlet_restriction_type === 'specific_outlets') {
      if (!voucher.applicable_outlet_ids || voucher.applicable_outlet_ids.length === 0) {
        return 0; // No outlets selected means voucher can't be used anywhere
      }
      const currentOutletId = selectedOutlet?.id;
      if (!currentOutletId || !voucher.applicable_outlet_ids.includes(currentOutletId)) {
        return 0; // Current outlet not in the allowed list
      }
    }
    // If outlet_restriction_type is 'all_outlets' or undefined, voucher works everywhere

    // Product-level vouchers with per-product application method
    if (voucher.application_scope === 'product_level' && voucher.product_application_method === 'per_product') {
      // Count applicable products in cart
      let applicableCount = 0;
      let totalDiscount = 0;

      // If specific products are restricted
      if (voucher.eligible_product_ids && voucher.eligible_product_ids.length > 0) {
        applicableCount = cartItems.filter(item => {
          const productIdString = productMapping.get(item.product_id);
          return productIdString && voucher.eligible_product_ids.includes(productIdString);
        }).reduce((sum, item) => sum + item.quantity, 0);
      }
      // If categories are restricted
      else if (voucher.eligible_category_ids && voucher.eligible_category_ids.length > 0) {
        console.log('[Voucher Debug] Checking category eligibility');
        console.log('[Voucher Debug] Eligible categories:', voucher.eligible_category_ids);

        cartItems.forEach(item => {
          const categoryId = item.metadata?.category_id;
          console.log(`[Voucher Debug] Item ${item.product_id} has category_id:`, categoryId);
          if (!categoryId) {
            console.warn('⚠️ Cart item missing category_id in metadata!', { product_id: item.product_id, metadata: item.metadata });
          }
        });

        applicableCount = cartItems.filter(item => {
          const categoryId = item.metadata?.category_id;
          const isMatch = categoryId && voucher.eligible_category_ids.includes(categoryId);
          if (categoryId && !isMatch) {
            console.log('[Voucher Debug] Category mismatch:', categoryId, 'not in', voucher.eligible_category_ids);
          }
          return isMatch;
        }).reduce((sum, item) => sum + item.quantity, 0);

        console.log('[Voucher Debug] Found', applicableCount, 'applicable items by category');
      }
      // If subcategories are restricted
      else if (voucher.eligible_subcategory_ids && voucher.eligible_subcategory_ids.length > 0) {
        applicableCount = cartItems.filter(item => {
          const subcategoryId = item.metadata?.subcategory_id;
          return subcategoryId && voucher.eligible_subcategory_ids.includes(subcategoryId);
        }).reduce((sum, item) => sum + item.quantity, 0);
      }
      // No eligibility criteria specified
      else {
        console.warn('[Voucher] No eligible products specified - voucher not properly configured');
        return 0;
      }

      // Cap at max_products_per_use
      const maxProducts = voucher.max_products_per_use || 6;
      const effectiveCount = Math.min(applicableCount, maxProducts);

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
          console.log('[Voucher Debug] Calculating percentage discount for category-based voucher');
          cartItems.forEach(item => {
            const categoryId = item.metadata?.category_id;
            if (categoryId && voucher.eligible_category_ids.includes(categoryId)) {
              const itemDiscount = (item.unit_price * parseFloat(voucher.value)) / 100;
              const itemsToDiscount = Math.min(item.quantity, effectiveCount - (totalDiscount / itemDiscount));
              console.log(`[Voucher Debug] Applying ${voucher.value}% discount to item ${item.product_id}: RM${itemDiscount.toFixed(2)} x ${itemsToDiscount} = RM${(itemDiscount * itemsToDiscount).toFixed(2)}`);
              totalDiscount += itemDiscount * itemsToDiscount;
            }
          });
          console.log('[Voucher Debug] Total category-based discount:', totalDiscount);
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
      }

      // Cap discount at subtotal
      return Math.min(totalDiscount, subtotal);
    }

    // Order-total or product-level with total_once application method (original behavior)
    if (voucher.voucher_type === 'percent') {
      return (subtotal * parseFloat(voucher.value)) / 100;
    } else if (voucher.voucher_type === 'amount') {
      return Math.min(parseFloat(voucher.value), subtotal);
    }
    return 0;
  };

  const calculateTotal = () => {
    return Math.max(0, calculateSubtotal() - calculateTierDiscount() - calculateDiscount() - appliedBonusAmount);
  };

  const handleApplyBonus = () => {
    setShowBonusModal(true);
  };

  const handleBonusApply = (amount: number) => {
    const subtotalAfterDiscounts = calculateSubtotal() - calculateTierDiscount() - calculateDiscount();
    const maxBonus = Math.min(bonusBalance, subtotalAfterDiscounts);
    const safeAmount = Math.min(amount, maxBonus);
    const finalTotal = subtotalAfterDiscounts - safeAmount;

    if (finalTotal < 0) {
      setAppliedBonusAmount(subtotalAfterDiscounts);
    } else {
      setAppliedBonusAmount(safeAmount);
    }
  };

  const handleRemoveBonus = () => {
    setAppliedBonusAmount(0);
  };

  const handleBonusClick = () => {
    if (appliedBonusAmount > 0) {
      return;
    }

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

  const calculateStarsEarning = () => {
    // W Balance payments don't earn any stars
    if (selectedPayment === 'wonderstars') {
      return 0;
    }

    // Real money payments earn 2.5 stars per RM1
    const total = calculateTotal();
    return Math.floor(total * 2.5);
  };

  const handleTopUp = () => {
    setShowTopUpModal(false);
    navigate('/wallet');
  };

  const handleFiuuPayment = async (orderNumber: string, total: number, orderItems: any[]) => {
    try {
      if (!user) throw new Error('User not found');

      console.log('[Payment] Starting Fiuu payment flow');
      setPaymentStep('creating_order');

      console.log('[Payment] Creating shop order');
      const stampsEarnedCount = calculateStampsFromOrder(orderItems);
      const tierDiscountAmount = calculateTierDiscount();
      const voucherDiscount = calculateDiscount();
      const grossSales = calculateSubtotal();

      const fiuuOrderData: any = {
        order_number: orderNumber,
        user_id: user.id,
        outlet_id: outletId,
        items: orderItems,
        subtotal: grossSales,
        gross_sales: grossSales,
        discount_amount: voucherDiscount,
        bonus_discount_amount: appliedBonusAmount || 0,
        permanent_discount_amount: tierDiscountAmount,
        tier_discount_amount: tierDiscountAmount,
        tier_discount_pct: currentTier?.shop_discount_pct || 0,
        total_amount: total,
        payment_method: selectedPayment,
        stars_earned: calculateStarsEarning(),
        stamps_earned: stampsEarnedCount,
        qr_code: null,
        status: 'waiting_payment',
        payment_status: 'pending',
        fnbstatus: 'preparing',
        metadata: {
          bonus_discount_amount: appliedBonusAmount || 0
        }
      };

      if (selectedVoucher) {
        fiuuOrderData.user_voucher_id = selectedVoucher.id;
        fiuuOrderData.voucher_id = selectedVoucher.voucher_id;
        fiuuOrderData.voucher_code = (selectedVoucher.voucher || selectedVoucher).code;
      }

      const { data: order, error: orderError } = await supabase
        .from('shop_orders')
        .insert(fiuuOrderData)
        .select()
        .single();

      if (orderError) {
        console.error('[Payment] Order creation failed:', orderError);
        throw new Error(`Order creation failed: ${orderError.message}`);
      }

      console.log('[Payment] Shop order created:', order.id);

      const paymentOrderId = `ORD-${Date.now()}`;

      console.log('[Payment] Creating payment transaction');
      const { data: paymentTx, error: paymentError } = await supabase
        .from('payment_transactions')
        .insert({
          order_id: paymentOrderId,
          user_id: user.id,
          amount: total,
          payment_method: selectedPayment,
          shop_order_id: order.id,
          status: 'pending',
          metadata: {
            order_number: orderNumber,
            outlet_id: outletId,
            outlet_slug: outletSlug
          }
        })
        .select()
        .single();

      if (paymentError) {
        console.error('[Payment] Payment transaction creation failed:', paymentError);
        throw new Error(`Payment transaction creation failed: ${paymentError.message}`);
      }

      console.log('[Payment] Payment transaction created:', paymentTx.id);

      await supabase
        .from('shop_orders')
        .update({ payment_transaction_id: paymentTx.id })
        .eq('id', order.id);

      console.log('[Payment] Initiating payment with Fiuu');
      setPaymentStep('redirecting');

      const paymentMethod = fiuuService.mapPaymentMethodToFiuu(selectedPayment);

      let paymentResponse;
      try {
        const initiatePaymentPromise = fiuuService.initiatePayment({
          customer_id: user.id,
          user_id: user.id,
          product_id: `ORDER-${orderNumber}`,
          order_id: paymentOrderId,
          shop_order_id: order.id,
          amount: total,
          payment_method: paymentMethod,
          customer_name: user.name,
          customer_email: user.email,
          customer_phone: user.phone || '',
          product_name: `Order ${orderNumber} - ${orderItems.length} item(s)`,
          customer_country: user.country || 'MY'
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout - payment gateway is not responding')), 30000)
        );

        paymentResponse = await Promise.race([initiatePaymentPromise, timeoutPromise]);
        console.log('[Payment] Payment initiated successfully');
      } catch (initiateError) {
        console.error('[Payment] Failed to initiate payment:', initiateError);
        const errorMsg = initiateError instanceof Error ? initiateError.message : 'Failed to initialize payment';
        throw new Error(errorMsg);
      }

      console.log('[Payment] Payment request sent with order tracking IDs');

      if (!paymentResponse?.data?.payment_url || !paymentResponse?.data?.payment_data) {
        console.error('[Payment] Invalid payment response:', paymentResponse);
        throw new Error('Invalid payment response from provider. Please try again.');
      }

      console.log('[Payment] Updating transaction with payment URL');
      await supabase
        .from('payment_transactions')
        .update({
          fiuu_payment_url: paymentResponse.data.payment_url,
          fiuu_payment_data: paymentResponse.data.payment_data,
          status: 'processing'
        })
        .eq('id', paymentTx.id);

      // Store payment submission data for debugging
      try {
        const debugData = {
          submit_url: paymentResponse.data.payment_url,
          payment_method: selectedPayment,
          amount: total.toString(),
          order_number: orderNumber,
          shop_order_id: order.id,
          user_id: user.id,
          timestamp: new Date().toISOString()
        };

        const existingDebugData = sessionStorage.getItem('payment_debug_data');
        if (existingDebugData) {
          const parsed = JSON.parse(existingDebugData);
          Object.assign(parsed, debugData);
          sessionStorage.setItem('payment_debug_data', JSON.stringify(parsed));
        } else {
          sessionStorage.setItem('payment_debug_data', JSON.stringify(debugData));
        }
        console.log('[Payment Debug] Stored payment submission data for tracking');
      } catch (debugError) {
        console.warn('[Payment Debug] Failed to store debug data:', debugError);
      }

      console.log('[Payment] Redirecting to payment gateway in 1.5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 1500));

      console.log('[Payment] Submitting payment form');
      await fiuuService.submitPaymentForm(
        paymentResponse.data.payment_url,
        paymentResponse.data.payment_data
      );

    } catch (error) {
      console.error('[Payment] Error in Fiuu payment flow:', error);
      setPaymentStep('idle');
      setErrorMessage(error instanceof Error ? error.message : 'Payment initialization failed');
      setShowErrorModal(true);
      setProcessing(false);
    }
  };

  const handlePayNow = () => {
    const total = calculateTotal();

    console.log('[ShopCheckout] handlePayNow - Balance check:', {
      payment_method: selectedPayment,
      displayed_balance: balance,
      balance_source: 'useMasterBalances',
      total_to_pay: total,
      sufficient_funds: balance >= total
    });

    if (selectedPayment === 'wonderstars' && balance < total) {
      console.log('[ShopCheckout] ❌ Insufficient funds - showing top-up modal');
      setShowTopUpModal(true);
      return;
    }

    console.log('[ShopCheckout] ✅ Balance check passed, proceeding to payment...');
    handlePayment();
  };

  const handlePayment = async () => {
    console.log('[Payment] handlePayment called');

    if (!user) {
      console.error('[Payment] No user found');
      setErrorMessage('Please log in to continue');
      setShowErrorModal(true);
      return;
    }

    console.log('[Payment] User address check:', {
      address: user.address,
      city: user.city,
      state: user.state,
      postcode: user.postcode
    });

    if (!outletId || cartItems.length === 0) {
      console.error('[Payment] Cart empty or no outlet');
      setErrorMessage('Your cart is empty or outlet data is missing');
      setShowErrorModal(true);
      return;
    }

    const total = calculateTotal();
    console.log('[Payment] Payment details:', {
      payment_method: selectedPayment,
      total_amount: total,
      displayed_balance: balance
    });

    if (total === 0) {
      console.log('[Payment] Total is 0, processing as free order');
      await handleFreeOrder();
      return;
    }

    if (selectedPayment === 'wonderstars') {
      console.log('[Payment] WonderStars payment - verifying balance...');
      if (balance < total) {
        console.log('[Payment] ❌ Insufficient balance detected:', {
          balance: balance,
          required: total,
          shortfall: total - balance
        });
        setShowTopUpModal(true);
        return;
      }
      console.log('[Payment] ✅ Balance sufficient, will proceed to spend()');
    }

    console.log('[Payment] All checks passed, processing payment...');
    setProcessing(true);

    try {
      const orderNumber = `WP${Date.now().toString().slice(-8)}`;
      const qrCode = `WP-${Date.now()}-${user.id.substring(0, 8)}`;

      // Build order items with detailed discount tracking
      let orderItems = buildOrderItemsWithDiscounts();

      // Add free gift item if free_gift voucher is applied
      if (selectedVoucher && (selectedVoucher.voucher || selectedVoucher).voucher_type === 'free_gift') {
        const voucherData = selectedVoucher.voucher || selectedVoucher;
        orderItems.push({
          product_id: null,
          product_name: `FREE GIFT - ${voucherData.free_gift_name}`,
          quantity: 1,
          unit_price: 0,
          total: 0,
          metadata: {
            is_free_gift: true,
            voucher_id: voucherData.id,
            user_voucher_id: selectedVoucher.id,
            gift_name: voucherData.free_gift_name,
            product_name: `FREE GIFT - ${voucherData.free_gift_name}`,
            category: 'Free Gift'
          }
        });
      }

      // For online payments (card, fpx, etc.), use Fiuu flow
      if (selectedPayment !== 'wonderstars') {
        await handleFiuuPayment(orderNumber, total, orderItems);
        return;
      }

      // For W-Balance payments, use WPay API
      console.log('[Payment] Processing W-Balance payment via WPay API');

      // Calculate gross amount (the true cost before bonus deduction)
      // because WPay handles the bonus deduction logic itself
      const grossPaymentAmount = total + (appliedBonusAmount || 0);

      const wpayResponse = await wpayService.processPayment({
        email: user.email,
        payment_category: 'checkout',
        payment_type: 'wbalance',
        order_id: orderNumber,
        amount: grossPaymentAmount,
        customer_name: user.name,
        customer_phone: user.phone || '',
        product_name: `Shop order ${orderNumber} - ${cartItems.length} item(s)`,
        metadata: {
          outlet_id: outletId,
          outlet_name: selectedOutlet?.name,
          items_count: cartItems.length,
          voucher_code: selectedVoucher ? (selectedVoucher.voucher || selectedVoucher).code : null,
          voucher_discount: calculateDiscount(),
          tier_discount: calculateTierDiscount(),
          use_bonus: appliedBonusAmount || 0 // Explicitly tell backend how much bonus to use
        }
      });

      if (wpayResponse.wpay_status !== 'success') {
        console.error('[Payment] WPay payment failed:', wpayResponse);
        throw new Error(wpayResponse.message || 'Payment failed. Please check your balance.');
      }

      console.log('[Payment] ✅ WPay payment successful:', {
        order_id: wpayResponse.order_id,
        wbalance_used: wpayResponse.transaction_details?.wbalance_used,
        bonus_used: wpayResponse.transaction_details?.bonus_used,
        new_wbalance: wpayResponse.profile?.wbalance,
        new_bonus: wpayResponse.profile?.bonus
      });

      const stampsEarnedCount = calculateStampsFromOrder(orderItems);
      const tierDiscountAmount = calculateTierDiscount();
      const voucherDiscount = calculateDiscount();
      const grossSales = calculateSubtotal();

      // Get actual bonus used and stars awarded from WPay response
      const actualBonusUsed = wpayResponse.transaction_details?.bonus_used || 0;
      const actualStarsAwarded = wpayResponse.transaction_details?.stars_awarded ?? calculateStarsEarning();

      const orderData: any = {
        order_number: orderNumber,
        user_id: user.id,
        outlet_id: outletId,
        items: orderItems,
        subtotal: grossSales,
        gross_sales: grossSales,
        discount_amount: voucherDiscount,
        bonus_discount_amount: actualBonusUsed,
        permanent_discount_amount: tierDiscountAmount,
        tier_discount_amount: tierDiscountAmount,
        tier_discount_pct: currentTier?.shop_discount_pct || 0,
        total_amount: total,
        payment_method: selectedPayment,
        payment_type: 'deduction',
        stars_earned: actualStarsAwarded, // Use actual stars from WPay
        stamps_earned: stampsEarnedCount,
        qr_code: qrCode,
        status: 'ready',
        payment_status: 'paid',
        fnbstatus: 'preparing',
        metadata: {
          bonus_discount_amount: actualBonusUsed,
          stars_awarded: actualStarsAwarded,
          wpay_transaction_id: wpayResponse.transaction_id,
          wbalance_used: wpayResponse.transaction_details?.wbalance_used,
          bonus_used: wpayResponse.transaction_details?.bonus_used
        }
      };

      if (selectedVoucher) {
        orderData.user_voucher_id = selectedVoucher.id;
        orderData.voucher_id = selectedVoucher.voucher_id;
        orderData.voucher_code = (selectedVoucher.voucher || selectedVoucher).code;
      }

      // WPay already handled the bonus deduction, no need to call Supabase RPC

      const { data: order, error: orderError } = await supabase
        .from('shop_orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) {
        if (selectedPayment === 'wonderstars') {
          await spend(-total, `Refund for failed order ${orderNumber}`);
        }
        throw new Error(`Order creation failed: ${orderError.message}`);
      }

      try {
        const { data: existingRedemptions } = await supabase
          .from('order_item_redemptions')
          .select('item_index')
          .eq('order_id', order.id);

        const existingIndexes = new Set((existingRedemptions || []).map(r => r.item_index));

        for (let idx = 0; idx < orderItems.length; idx++) {
          if (existingIndexes.has(idx)) {
            continue;
          }

          const item = orderItems[idx];
          const { error: insertError } = await supabase
            .from('order_item_redemptions')
            .insert({
              order_id: order.id,
              user_id: user.id,
              item_index: idx,
              product_id: item.product_id,
              product_name: item.product_name,
              quantity: item.quantity,
              redeemed_quantity: 0,
              status: 'confirmed',
              redeemed_at_outlet_id: outletId
            });

          if (insertError && insertError.code !== '23505') {
            console.warn(`Failed to create redemption record for item ${idx}:`, insertError);
          }
        }
      } catch (redemptionError) {
        console.warn('Failed to create redemption records, but order was successful:', redemptionError);
      }

      try {
        await earnStars(calculateStarsEarning(), 'shop_purchase', {
          order_id: order.id,
          payment_method: selectedPayment
        });
      } catch (starsError) {
        console.warn('Failed to award stars, but order was successful:', starsError);
      }

      try {
        const stampsEarned = calculateStampsFromOrder(orderItems);
        if (stampsEarned > 0) {
          await awardStamps(stampsEarned, 'ticket_purchase', order.id, {
            order_number: orderNumber,
            outlet_id: outletId,
            items: orderItems
          });
        }
      } catch (stampsError) {
        console.warn('Failed to award stamps, but order was successful:', stampsError);
      }

      // Log order activity to timeline
      try {
        await activityTimelineService.helpers.logOrderPlaced(user.id, order.id, total);
      } catch (activityError) {
        console.warn('Failed to log order activity:', activityError);
      }

      if (selectedVoucher) {
        try {
          await supabase.rpc('use_user_voucher', { user_voucher_uuid: selectedVoucher.id });

          const discountAmount = calculateDiscount();
          await supabase
            .from('voucher_redemptions')
            .insert({
              user_voucher_id: selectedVoucher.id,
              user_id: user.id,
              voucher_id: selectedVoucher.voucher_id || (selectedVoucher.voucher?.id),
              order_id: order.id,
              discount_amount: discountAmount,
              original_price: calculateSubtotal(),
              final_price: total,
              metadata: {
                order_number: orderNumber,
                voucher_code: (selectedVoucher.voucher || selectedVoucher).code
              }
            });

          clearVoucher();
        } catch (voucherError) {
          console.warn('Failed to track voucher redemption, but order was successful:', voucherError);
        }
      }

      // Track bonus redemption if bonus was applied
      if (appliedBonusAmount > 0) {
        try {
          await supabase
            .from('bonus_transactions')
            .insert({
              user_id: user.id,
              order_id: order.id,
              amount: appliedBonusAmount,
              transaction_type: 'redemption',
              order_number: orderNumber,
              metadata: {
                payment_method: selectedPayment,
                voucher_used: selectedVoucher ? (selectedVoucher.voucher || selectedVoucher).code : null,
                subtotal: calculateSubtotal(),
                final_price: total
              }
            });
        } catch (bonusError) {
          console.warn('Failed to track bonus redemption, but order was successful:', bonusError);
        }
      }

      // Clear bonus discount after successful order
      clearBonus();

      // Set flag to prevent cart reload from redirecting during completion
      setIsCompletingOrder(true);

      const { error: clearCartError } = await supabase
        .from('shop_cart_items')
        .delete()
        .eq('user_id', user.id);

      if (clearCartError) {
        console.error('Failed to clear cart:', clearCartError);
      }

      await refreshCartCount();

      navigate(`/shop/${outletSlug}/order-success/${order.id}`, {
        state: { order },
        replace: true
      });
    } catch (error) {
      console.error('Error processing payment:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Payment failed. Please try again.');
      setShowErrorModal(true);
    } finally {
      setProcessing(false);
      setIsCompletingOrder(false);
    }
  };

  const handleFreeOrder = async () => {
    if (!user) return;

    setProcessing(true);
    try {
      const orderNumber = `WP${Date.now().toString().slice(-8)}`;
      const qrCode = `WP-${Date.now()}-${user.id.substring(0, 8)}`;

      // Build order items with detailed discount tracking
      let orderItems = buildOrderItemsWithDiscounts();

      // Add free gift item if free_gift voucher is applied
      if (selectedVoucher && (selectedVoucher.voucher || selectedVoucher).voucher_type === 'free_gift') {
        const voucherData = selectedVoucher.voucher || selectedVoucher;
        orderItems.push({
          product_id: null,
          product_name: `FREE GIFT - ${voucherData.free_gift_name}`,
          quantity: 1,
          unit_price: 0,
          total: 0,
          metadata: {
            is_free_gift: true,
            voucher_id: voucherData.id,
            user_voucher_id: selectedVoucher.id,
            gift_name: voucherData.free_gift_name,
            product_name: `FREE GIFT - ${voucherData.free_gift_name}`,
            category: 'Free Gift'
          }
        });
      }

      const stampsEarnedCount = calculateStampsFromOrder(orderItems);
      const tierDiscountAmount = calculateTierDiscount();
      const voucherDiscount = calculateDiscount();
      const grossSales = calculateSubtotal();

      const orderData: any = {
        order_number: orderNumber,
        user_id: user.id,
        outlet_id: outletId,
        items: orderItems,
        subtotal: grossSales,
        gross_sales: grossSales,
        discount_amount: voucherDiscount,
        bonus_discount_amount: appliedBonusAmount || 0,
        permanent_discount_amount: tierDiscountAmount,
        tier_discount_amount: tierDiscountAmount,
        tier_discount_pct: currentTier?.shop_discount_pct || 0,
        total_amount: 0,
        payment_method: 'free_reward',
        payment_type: 'redemption',
        stars_earned: 0,
        stamps_earned: stampsEarnedCount,
        qr_code: qrCode,
        status: 'ready',
        payment_status: 'paid',
        fnbstatus: 'preparing',
        metadata: {
          bonus_discount_amount: appliedBonusAmount || 0
        }
      };

      if (selectedVoucher) {
        orderData.user_voucher_id = selectedVoucher.id;
        orderData.voucher_id = selectedVoucher.voucher_id;
        orderData.voucher_code = (selectedVoucher.voucher || selectedVoucher).code;
      }

      // If there's an amount that needs to be paid from bonus, use WPay
      const amountBeforeDiscounts = grossSales - tierDiscountAmount - voucherDiscount;
      if (amountBeforeDiscounts > 0) {
        console.log('[Free Order] Processing via WPay with payment_type: free');
        console.log('[Free Order] Amount to cover with bonus:', amountBeforeDiscounts);

        const wpayResponse = await wpayService.processPayment({
          email: user.email,
          payment_category: 'checkout',
          payment_type: 'free', // Use 'free' payment type - uses only bonus
          order_id: orderNumber,
          amount: amountBeforeDiscounts,
          customer_name: user.name,
          customer_phone: user.phone || '',
          product_name: `Free order ${orderNumber} - ${cartItems.length} item(s)`,
          metadata: {
            outlet_id: outletId,
            outlet_name: selectedOutlet?.name,
            items_count: cartItems.length,
            voucher_code: selectedVoucher ? (selectedVoucher.voucher || selectedVoucher).code : null,
            voucher_discount: voucherDiscount,
            tier_discount: tierDiscountAmount,
            is_free_order: true
          }
        });

        if (wpayResponse.wpay_status !== 'success') {
          console.error('[Free Order] WPay payment failed:', wpayResponse);
          throw new Error(wpayResponse.message || 'Payment failed. Please check your bonus balance.');
        }

        console.log('[Free Order] ✅ WPay payment successful:', {
          order_id: wpayResponse.order_id,
          bonus_used: wpayResponse.transaction_details?.bonus_used,
          new_bonus: wpayResponse.profile?.bonus
        });

        // Update order data with actual bonus used from WPay
        orderData.bonus_discount_amount = wpayResponse.transaction_details?.bonus_used || 0;
        orderData.metadata.wpay_transaction_id = wpayResponse.transaction_id;
        orderData.metadata.bonus_used = wpayResponse.transaction_details?.bonus_used;
      }
      // If no amount needs to be paid (100% discount from voucher/tier), skip WPay call

      const { data: order, error: orderError } = await supabase
        .from('shop_orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      try {
        const { data: existingRedemptions } = await supabase
          .from('order_item_redemptions')
          .select('item_index')
          .eq('order_id', order.id);

        const existingIndexes = new Set((existingRedemptions || []).map(r => r.item_index));

        for (let idx = 0; idx < orderItems.length; idx++) {
          if (existingIndexes.has(idx)) continue;

          const item = orderItems[idx];
          await supabase
            .from('order_item_redemptions')
            .insert({
              order_id: order.id,
              user_id: user.id,
              item_index: idx,
              product_id: item.product_id,
              product_name: item.product_name,
              quantity: item.quantity,
              redeemed_quantity: 0,
              status: 'confirmed',
              redeemed_at_outlet_id: outletId
            });
        }
      } catch (redemptionError) {
        console.warn('Failed to create redemption records:', redemptionError);
      }

      try {
        const stampsEarned = calculateStampsFromOrder(orderItems);
        if (stampsEarned > 0) {
          await awardStamps(stampsEarned, 'ticket_purchase', order.id, {
            order_number: orderNumber,
            outlet_id: outletId,
            items: orderItems
          });
        }
      } catch (stampsError) {
        console.warn('Failed to award stamps:', stampsError);
      }

      // Log order activity to timeline
      try {
        await activityTimelineService.helpers.logOrderPlaced(user.id, order.id, 0);
      } catch (activityError) {
        console.warn('Failed to log order activity:', activityError);
      }

      if (selectedVoucher) {
        try {
          await supabase.rpc('use_user_voucher', { user_voucher_uuid: selectedVoucher.id });

          const discountAmount = calculateDiscount();
          await supabase
            .from('voucher_redemptions')
            .insert({
              user_voucher_id: selectedVoucher.id,
              user_id: user.id,
              voucher_id: selectedVoucher.voucher_id || (selectedVoucher.voucher?.id),
              order_id: order.id,
              discount_amount: discountAmount,
              original_price: calculateSubtotal(),
              final_price: 0,
              metadata: {
                order_number: orderNumber,
                voucher_code: (selectedVoucher.voucher || selectedVoucher).code
              }
            });

          clearVoucher();
        } catch (voucherError) {
          console.warn('Failed to track voucher redemption:', voucherError);
        }
      }

      // Track bonus redemption if bonus was applied
      if (appliedBonusAmount > 0) {
        try {
          await supabase
            .from('bonus_transactions')
            .insert({
              user_id: user.id,
              order_id: order.id,
              amount: appliedBonusAmount,
              transaction_type: 'redemption',
              order_number: orderNumber,
              metadata: {
                payment_method: 'free_order',
                voucher_used: selectedVoucher ? (selectedVoucher.voucher || selectedVoucher).code : null,
                subtotal: calculateSubtotal(),
                final_price: 0
              }
            });
        } catch (bonusError) {
          console.warn('Failed to track bonus redemption:', bonusError);
        }
      }

      clearBonus();

      // Set flag to prevent cart reload from redirecting during completion
      setIsCompletingOrder(true);

      await supabase
        .from('shop_cart_items')
        .delete()
        .eq('user_id', user.id);

      await refreshCartCount();

      navigate(`/shop/${outletSlug}/order-success/${order.id}`, {
        state: { order },
        replace: true
      });
    } catch (error) {
      console.error('Error processing free order:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to complete order. Please try again.');
      setShowErrorModal(true);
    } finally {
      setProcessing(false);
      setIsCompletingOrder(false);
    }
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const insufficientBalance = selectedPayment === 'wonderstars' && balance < calculateTotal();

  const handleVoucherBannerClick = async () => {
    await refreshVouchers();
    setShowVouchers(true);
  };

  const handleRemoveVoucher = () => {
    setSelectedVoucher(null);
    clearVoucher();
    setAutoApplied(false);
  };

  // Extract voucher code and title with proper fallback
  const getVoucherCode = () => {
    if (!selectedVoucher) return undefined;
    // Try nested voucher object first, then check direct properties
    return selectedVoucher.voucher?.code || selectedVoucher.code || undefined;
  };

  const getVoucherTitle = () => {
    if (!selectedVoucher) return undefined;
    // Try nested voucher object first, then check direct properties
    return selectedVoucher.voucher?.title || selectedVoucher.title || undefined;
  };

  const voucherCode = getVoucherCode();
  const voucherTitle = getVoucherTitle();

  console.log('[ShopCheckout] selectedVoucher:', selectedVoucher);
  console.log('[ShopCheckout] Extracted voucher details:', {
    voucherCode,
    voucherTitle,
    isApplied: !!selectedVoucher,
    hasNestedVoucher: !!selectedVoucher?.voucher,
    directCode: selectedVoucher?.code,
    directTitle: selectedVoucher?.title
  });

  return (
    <div className="min-h-screen pb-52 bg-gradient-to-b from-primary-50 to-white">
      <PageHeader />
      {selectedVoucher && (
        <VoucherBanner
          voucherCode={voucherCode}
          voucherTitle={voucherTitle}
          isApplied={true}
          onApply={() => { }}
          onRemove={() => { }}
        />
      )}
      <div className={`fixed left-0 right-0 z-40 glass border-b border-white/20 backdrop-blur-2xl max-w-md mx-auto ${selectedVoucher ? 'top-[120px]' : 'top-[72px]'}`}>
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/50 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Checkout</h1>
        </div>
      </div>

      <div className={`px-4 pt-4 pb-56 space-y-4 ${selectedVoucher ? 'mt-[176px]' : 'mt-[128px]'}`}>
        {selectedOutlet && (
          <div className="glass-strong border-2 border-primary-500 rounded-2xl p-4 shadow-lg animate-pop-in">
            <div className="flex items-center gap-2 mb-3">
              <Store className="w-5 h-5 text-primary-600" />
              <span className="text-sm font-bold text-primary-700 uppercase tracking-wide">Purchasing For</span>
            </div>
            <div className="flex items-start gap-3 mb-3">
              <div className="p-3 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl">
                <MapPin className="w-6 h-6 text-primary-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-gray-900">{selectedOutlet.name}</h3>
                <p className="text-sm text-gray-700 mt-0.5 font-semibold">{selectedOutlet.location}</p>
                <p className="text-xs text-gray-600 mt-1">{selectedOutlet.address}</p>
              </div>
            </div>
            <div className="p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border-2 border-orange-300">
              <p className="text-sm text-orange-900 font-bold text-center">
                ⚠️ Items only can be used in this outlet.
              </p>
            </div>
          </div>
        )}

        <div className="glass p-4 rounded-2xl space-y-3">
          <h3 className="font-bold text-gray-900 text-base">Order Summary</h3>
          <div className="space-y-2">
            {cartItems.map((item, itemIndex) => (
              <div key={item.id} className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 font-semibold">
                    {item.metadata.product_name} × {item.quantity}
                  </span>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900">
                      RM {(item.unit_price * item.quantity).toFixed(2)}
                    </span>
                    {(() => {
                      const discount = getItemDiscount(item, itemIndex);
                      if (discount) {
                        const totalItemDiscount = discount.amount * discount.quantityWithDiscount;
                        const isPartialDiscount = discount.quantityWithDiscount < item.quantity;
                        return (
                          <>
                            <div className="text-xs font-bold text-green-600 mt-0.5 flex items-center justify-end gap-1">
                              {discount.type === 'percent' ? (
                                <span>DISCOUNT {discount.value}% (RM {totalItemDiscount.toFixed(2)})</span>
                              ) : discount.quantityWithDiscount > 1 ? (
                                <span>DISCOUNT RM {discount.value} × {discount.quantityWithDiscount} = RM {totalItemDiscount.toFixed(2)}</span>
                              ) : (
                                <span>DISCOUNT RM {totalItemDiscount.toFixed(2)}</span>
                              )}
                            </div>
                            {isPartialDiscount && (
                              <div className="text-[10px] text-gray-500 mt-0.5">
                                Applied to {discount.quantityWithDiscount} of {item.quantity} items
                              </div>
                            )}
                          </>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                {item.metadata.selected_modifiers && Array.isArray(item.metadata.selected_modifiers) && item.metadata.selected_modifiers.length > 0 && (
                  <div className="ml-2 space-y-0.5">
                    {item.metadata.selected_modifiers.map((group: any, groupIndex: number) => (
                      <div key={groupIndex} className="text-xs text-gray-500">
                        {group.group_name}: {group.selected_options.map((opt: any, optIndex: number) => (
                          <span key={optIndex}>
                            {opt.quantity > 1 && `${opt.quantity}x `}
                            {opt.option_name}
                            {optIndex < group.selected_options.length - 1 && ', '}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="pt-3 border-t border-gray-200 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-semibold text-gray-900">
                RM {calculateSubtotal().toFixed(2)}
              </span>
            </div>
            {calculateTierDiscount() > 0 && (
              <div className="flex justify-between text-sm animate-slide-up">
                <div className="flex items-center gap-1">
                  <Trophy className="w-4 h-4 text-primary-600" />
                  <span className="text-primary-600 font-semibold">
                    {currentTier?.name} Discount ({currentTier?.shop_discount_pct}%)
                  </span>
                </div>
                <span className="font-bold text-primary-600">
                  - RM {calculateTierDiscount().toFixed(2)}
                </span>
              </div>
            )}
            {selectedVoucher && calculateDiscount() > 0 && (
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1">
                  <Ticket className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-green-600 font-semibold">
                    {voucherCode}
                  </span>
                </div>
                <span className="font-bold text-green-600">
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
            {(calculateTierDiscount() > 0 || calculateDiscount() > 0 || appliedBonusAmount > 0) && (
              <div className="flex items-center gap-2 px-2 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200 -mx-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs text-amber-900 font-bold">
                  Total Savings: RM {(calculateTierDiscount() + calculateDiscount() + appliedBonusAmount).toFixed(2)} 🎉
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-gray-200 mt-2">
              <span className="font-bold text-gray-900 text-base">Total</span>
              <span className="text-xl font-black text-gray-900">
                RM {calculateTotal().toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="w-full glass p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Ticket className="w-5 h-5 text-orange-600" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-gray-900 text-sm">Voucher</h3>
              {selectedVoucher ? (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <Ticket className="w-3 h-3 text-orange-600" />
                    <p className="text-xs text-orange-600 font-bold">
                      {voucherCode} applied
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-500">Go back to cart to change</p>
                </div>
              ) : (
                <p className="text-xs text-gray-600">No voucher applied</p>
              )}
            </div>
          </div>
          {selectedVoucher && <Check className="w-5 h-5 text-green-600" />}
        </div>

        <button
          onClick={handleBonusClick}
          disabled={appliedBonusAmount > 0}
          className={`w-full glass p-4 rounded-2xl flex items-center justify-between transition-all ${appliedBonusAmount > 0
            ? 'cursor-default'
            : 'hover:shadow-md cursor-pointer active:scale-[0.98]'
            }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${appliedBonusAmount > 0
              ? 'bg-orange-500'
              : bonusBalance > 0
                ? 'bg-orange-100'
                : 'bg-gray-100'
              }`}>
              <Gift className={`w-5 h-5 ${appliedBonusAmount > 0
                ? 'text-white'
                : bonusBalance > 0
                  ? 'text-orange-600'
                  : 'text-gray-400'
                }`} />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-gray-900 text-sm">
                Bonus Discount
              </h3>
              {appliedBonusAmount > 0 ? (
                <div className="space-y-0.5">
                  <p className="text-xs text-orange-600 font-bold">
                    RM {appliedBonusAmount.toFixed(2)} discount applied
                  </p>
                  <p className="text-[10px] text-gray-500">Go back to cart to change</p>
                </div>
              ) : bonusBalance > 0 ? (
                <p className="text-xs text-gray-600">
                  Available: RM {bonusBalance.toFixed(2)}
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  No bonus available
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {appliedBonusAmount > 0 ? (
              <Check className="w-5 h-5 text-green-600" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </button>

        <div className="glass p-4 rounded-2xl space-y-3">
          <h3 className="font-bold text-gray-900 text-base">Payment Method</h3>

          <button
            onClick={() => setSelectedPayment('wonderstars')}
            className={`w-full p-3 rounded-xl border-2 transition-all text-left ${selectedPayment === 'wonderstars'
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${selectedPayment === 'wonderstars' ? 'bg-primary-500' : 'bg-gray-100'
                }`}>
                <Wallet className={`w-5 h-5 ${selectedPayment === 'wonderstars' ? 'text-white' : 'text-gray-600'
                  }`} />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <h4 className="text-sm font-bold text-gray-900">W Balance</h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-green-100 text-green-700">
                    +1.2× Stars
                  </span>
                </div>
                <p className="text-xs text-gray-600">Pay with your W Balance</p>
                <p className="text-xs font-semibold mt-1 text-gray-700">
                  W Balance: RM {balance.toFixed(2)}
                </p>
                {insufficientBalance && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTopUpModal(true);
                    }}
                    className="mt-2 text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Top Up Now
                  </div>
                )}
              </div>

              {selectedPayment === 'wonderstars' && (
                <div className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
          </button>

          <button
            onClick={() => setShowOtherPayments(!showOtherPayments)}
            className="w-full p-3 rounded-xl border-2 border-gray-200 bg-white hover:border-gray-300 transition-all text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <CreditCard className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Other Payment Methods</h4>
                  <p className="text-xs text-gray-600">Card, FPX, GrabPay, TnG, Boost</p>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${showOtherPayments ? 'rotate-90' : ''
                }`} />
            </div>
          </button>

          {showOtherPayments && (
            <div className="space-y-2 animate-slide-up">
              {otherPaymentMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = selectedPayment === method.id;

                return (
                  <button
                    key={method.id}
                    onClick={() => setSelectedPayment(method.id)}
                    className={`w-full p-3 rounded-xl border-2 transition-all text-left ${isSelected
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary-500' : 'bg-gray-100'
                        }`}>
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-600'
                          }`} />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h4 className="text-sm font-bold text-gray-900">{method.name}</h4>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600">
                            {method.badge}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">{method.description}</p>
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
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

        {selectedPayment !== 'wonderstars' && (
          <div className="glass p-4 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Stars You'll Earn</span>
              <div className="flex items-center gap-1.5">
                <Star className="w-5 h-5 text-primary-600" fill="currentColor" />
                <span className="text-xl font-black text-primary-600">
                  +{calculateStarsEarning()}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-600 font-medium">
              Earn 2.5 stars for every RM1 spent with real money payments
            </p>
          </div>
        )}
      </div>

      <div className="fixed bottom-[84px] left-0 right-0 z-40 glass border-t border-white/20 backdrop-blur-2xl p-4 shadow-lg max-w-md mx-auto">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Total Payment</span>
            <span className="text-xl font-black text-gray-900">
              RM {calculateTotal().toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/shop/${outletSlug}`)}
              className="flex-1 py-3.5 bg-white border-2 border-primary-500 text-primary-600 rounded-xl font-bold text-base hover:bg-primary-50 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Shop More</span>
            </button>
            <button
              onClick={handlePayNow}
              disabled={processing}
              className={`flex-[1.5] py-3.5 text-white rounded-xl font-bold text-base hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 ${calculateTotal() === 0
                ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                : 'gradient-primary'
                }`}
            >
              <span>
                {processing
                  ? 'Processing...'
                  : calculateTotal() === 0
                    ? 'Complete Order (Free)'
                    : 'Pay Now'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

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
                <div className="text-center py-10 px-4">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-orange-50 rounded-full animate-pulse"></div>
                    </div>
                    <Ticket className="w-16 h-16 text-orange-300 mx-auto mb-3 relative z-10" />
                  </div>
                  <h3 className="text-lg font-black text-gray-900 mb-2">
                    You don't have a valid voucher to redeem this
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed max-w-xs mx-auto">
                    Earn stamps with every purchase and unlock exclusive vouchers to save on your future orders!
                  </p>
                  <div className="mt-6 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-2xl border border-orange-100">
                    <p className="text-xs text-orange-800 font-semibold">
                      💡 Tip: Complete more purchases to collect stamps and redeem amazing vouchers
                    </p>
                  </div>
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
                            const newVoucher = isSelected ? null : userVoucher;
                            setSelectedVoucher(newVoucher);
                            setContextVoucher(newVoucher);
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
                            <p className="text-xs text-gray-500 mt-1">
                              Uses: {userVoucher.usage_count}/{userVoucher.max_usage_count}
                            </p>
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

      {showTopUpModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm glass-strong rounded-3xl p-6 animate-scale-in backdrop-blur-3xl border border-white/40">
            <div className="text-center mb-6">
              <div className="relative">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Wallet className="w-8 h-8 text-orange-600" />
                </div>
                <div className="absolute inset-0 w-16 h-16 mx-auto bg-orange-400 rounded-full blur-xl opacity-30 animate-pulse"></div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Insufficient Balance</h2>
              <p className="text-sm text-gray-600">
                You need RM {calculateTotal().toFixed(2)} but only have RM {balance.toFixed(2)}
              </p>
              <p className="text-sm font-semibold text-orange-600 mt-2">
                Top up RM {(calculateTotal() - balance).toFixed(2)} more to continue
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleTopUp}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-transform shadow-lg"
              >
                Top Up Now
              </button>
              <button
                onClick={() => setShowTopUpModal(false)}
                className="w-full py-3 bg-white/60 backdrop-blur-sm text-gray-700 rounded-xl font-semibold hover:bg-white/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {processing && selectedPayment !== 'wonderstars' && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm glass-strong rounded-3xl p-8 animate-scale-in backdrop-blur-3xl border border-white/40">
            <div className="text-center space-y-6">
              <div className="relative">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-glow animate-pulse">
                  <Loader2 className="w-12 h-12 text-white animate-spin" />
                </div>
                <div className="absolute inset-0 w-24 h-24 mx-auto bg-primary-400 rounded-full blur-xl opacity-50 animate-pulse"></div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-gray-900">
                  {paymentStep === 'creating_order' ? 'Creating Order' : paymentStep === 'redirecting' ? 'Redirecting to Payment' : 'Processing'}
                </h2>
                <p className="text-sm text-gray-600">
                  {paymentStep === 'creating_order'
                    ? 'Setting up your order details...'
                    : paymentStep === 'redirecting'
                      ? 'You will be redirected to the payment gateway shortly...'
                      : 'Please wait while we process your request...'}
                </p>
              </div>

              <div className="glass-light p-4 rounded-2xl space-y-2">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${paymentStep === 'creating_order' || paymentStep === 'redirecting'
                    ? 'bg-green-500'
                    : 'bg-gray-300'
                    }`}></div>
                  <span className={`text-sm ${paymentStep === 'creating_order' || paymentStep === 'redirecting'
                    ? 'text-gray-900 font-semibold'
                    : 'text-gray-600'
                    }`}>Order Created</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${paymentStep === 'redirecting'
                    ? 'bg-green-500 animate-pulse'
                    : paymentStep === 'creating_order'
                      ? 'bg-primary-500 animate-pulse'
                      : 'bg-gray-300'
                    }`}></div>
                  <span className={`text-sm ${paymentStep === 'redirecting'
                    ? 'text-gray-900 font-semibold'
                    : 'text-gray-600'
                    }`}>Redirecting to Payment</span>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Please do not close this window or press back
              </p>
            </div>
          </div>
        </div>
      )}

      {showErrorModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
          <div className="relative w-full max-w-sm glass-strong rounded-3xl p-6 animate-scale-in backdrop-blur-3xl border border-white/40 shadow-2xl">
            <button
              onClick={() => setShowErrorModal(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-white/30 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>

            <div className="text-center space-y-4">
              <div className="relative">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-glow-red animate-shake">
                  <AlertCircle className="w-10 h-10 text-white" />
                </div>
                <div className="absolute inset-0 w-20 h-20 mx-auto bg-red-400 rounded-full blur-xl opacity-50 animate-pulse"></div>
              </div>

              <div>
                <h3 className="text-xl font-black text-gray-900 mb-1">
                  Payment Failed
                </h3>
                <p className="text-sm text-gray-600">
                  {errorMessage}
                </p>
              </div>

              <div className="glass-light p-4 rounded-2xl">
                <p className="text-xs text-gray-700 leading-relaxed">
                  Please check your payment details and try again. If the problem persists, contact support.
                </p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => setShowErrorModal(false)}
                  className="w-full py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-transform shadow-lg"
                >
                  Try Again
                </button>
                <button
                  onClick={() => {
                    setShowErrorModal(false);
                    navigate(-1);
                  }}
                  className="w-full py-3 bg-white/60 backdrop-blur-sm text-gray-700 rounded-xl font-semibold hover:bg-white/80 transition-colors"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BonusSliderModal
        isOpen={showBonusModal}
        onClose={() => setShowBonusModal(false)}
        bonusBalance={bonusBalance}
        subtotal={calculateSubtotal() - calculateTierDiscount()}
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

      <BottomNav />
    </div>
  );
};

export default ShopCheckout;
