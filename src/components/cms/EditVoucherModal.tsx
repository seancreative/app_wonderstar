import React, { useState, useEffect } from 'react';
import { X, Tag, Percent, DollarSign, Calendar, Hash, AlertCircle, Search, ShoppingBag, Package, Layers, Store, MapPin, Gift } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface EditVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  voucher: any;
}

const EditVoucherModal: React.FC<EditVoucherModalProps> = ({ isOpen, onClose, onSuccess, voucher }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [selectedOutlets, setSelectedOutlets] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [specialDiscountCount, setSpecialDiscountCount] = useState(0);
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed' | 'free_gift',
    discount_value: '',
    free_gift_name: '',
    min_purchase_amount: '',
    max_discount_amount: '',
    usage_limit: '',
    usage_limit_per_user: '1',
    user_daily_limit: '',
    expires_at: '',
    valid_for_today_only: false,
    application_scope: 'order_total' as 'order_total' | 'product_level',
    product_application_method: 'total_once' as 'total_once' | 'per_product',
    restriction_type: 'none' as 'none' | 'products' | 'categories' | 'subcategories' | 'special_discount',
    max_products_per_use: '6',
    outlet_restriction_type: 'all_outlets' as 'all_outlets' | 'specific_outlets'
  });

  useEffect(() => {
    if (isOpen && voucher) {
      loadProducts();
      loadCategories();
      loadSubcategories();
      loadOutlets();
      loadSpecialDiscountCount();
      populateFormData();
    }
  }, [isOpen, voucher]);

  const populateFormData = () => {
    if (!voucher) return;

    const hasProducts = voucher.eligible_product_ids && voucher.eligible_product_ids.length > 0;
    const hasCategories = voucher.eligible_category_ids && voucher.eligible_category_ids.length > 0;
    const hasSubcategories = voucher.eligible_subcategory_ids && voucher.eligible_subcategory_ids.length > 0;

    let restrictionType: 'none' | 'products' | 'categories' | 'subcategories' | 'special_discount' = 'none';
    if (hasProducts) {
      checkIfSpecialDiscountVoucher(voucher.eligible_product_ids).then(isSpecial => {
        if (isSpecial) {
          setFormData(prev => ({ ...prev, restriction_type: 'special_discount' }));
        }
      });
      restrictionType = 'products';
    } else if (hasCategories) restrictionType = 'categories';
    else if (hasSubcategories) restrictionType = 'subcategories';

    let discountType: 'percentage' | 'fixed' | 'free_gift' = 'percentage';
    if (voucher.voucher_type === 'percent') {
      discountType = 'percentage';
    } else if (voucher.voucher_type === 'free_gift') {
      discountType = 'free_gift';
    } else {
      discountType = 'fixed';
    }

    setFormData({
      code: voucher.code || '',
      description: voucher.description || '',
      discount_type: discountType,
      discount_value: voucher.value?.toString() || '',
      free_gift_name: voucher.free_gift_name || '',
      min_purchase_amount: voucher.min_purchase > 0 ? voucher.min_purchase.toString() : '',
      max_discount_amount: voucher.metadata?.max_discount_amount?.toString() || '',
      usage_limit: voucher.max_uses?.toString() || '',
      usage_limit_per_user: voucher.usage_limit_per_user?.toString() || '1',
      user_daily_limit: voucher.user_daily_limit?.toString() || '',
      expires_at: voucher.expires_at ? new Date(voucher.expires_at).toISOString().split('T')[0] : '',
      valid_for_today_only: voucher.valid_for_today_only || false,
      application_scope: voucher.application_scope || 'order_total',
      product_application_method: voucher.product_application_method || 'total_once',
      restriction_type: restrictionType,
      max_products_per_use: voucher.max_products_per_use?.toString() || '6',
      outlet_restriction_type: voucher.outlet_restriction_type || 'all_outlets'
    });

    setSelectedProducts(voucher.eligible_product_ids || []);
    setSelectedCategories(voucher.eligible_category_ids || []);
    setSelectedSubcategories(voucher.eligible_subcategory_ids || []);
    setSelectedOutlets(voucher.applicable_outlet_ids || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validation for free gift type
      if (formData.discount_type === 'free_gift') {
        if (!formData.free_gift_name || formData.free_gift_name.trim().length < 3) {
          throw new Error('Gift name must be at least 3 characters');
        }
        if (formData.free_gift_name.length > 50) {
          throw new Error('Gift name must be less than 50 characters');
        }
      }

      const discountValue = formData.discount_type === 'free_gift' ? 0 : parseFloat(formData.discount_value);

      if (formData.discount_type === 'percentage' && (discountValue <= 0 || discountValue > 100)) {
        throw new Error('Percentage discount must be between 0 and 100');
      }

      if (formData.discount_type === 'fixed' && discountValue <= 0) {
        throw new Error('Fixed discount must be greater than 0');
      }

      if (formData.application_scope === 'product_level' && formData.restriction_type !== 'none' && formData.restriction_type !== 'special_discount' && selectedProducts.length === 0 && selectedCategories.length === 0 && selectedSubcategories.length === 0) {
        throw new Error('Please select at least one product, category, or subcategory for product-level vouchers');
      }

      if (formData.valid_for_today_only && !formData.expires_at) {
        throw new Error('Please select an expiry date for today-only vouchers');
      }

      // Validate outlet restrictions
      if (formData.outlet_restriction_type === 'specific_outlets' && selectedOutlets.length === 0) {
        throw new Error('⚠️ Please select at least one outlet when using specific outlet restrictions');
      }

      const maxProductsPerUse = formData.application_scope === 'product_level'
        ? parseInt(formData.max_products_per_use) || 6
        : 1;

      if (formData.application_scope === 'product_level' && (maxProductsPerUse < 1 || maxProductsPerUse > 20)) {
        throw new Error('Maximum products per use must be between 1 and 20');
      }

      let eligibleProductIds: string[] = [];

      if (formData.restriction_type === 'products') {
        eligibleProductIds = selectedProducts;
      } else if (formData.restriction_type === 'special_discount') {
        const { data: specialProducts } = await supabase
          .from('shop_products')
          .select('product_id')
          .eq('is_active', true)
          .eq('special_discount', true);
        eligibleProductIds = specialProducts?.map(p => p.product_id) || [];
      } else if (formData.restriction_type === 'none' && selectedProducts.length > 0) {
        // User selected products but chose "All Products" - this is likely a mistake
        // Auto-correct to use the selected products
        console.warn('Restriction type is "none" but products are selected. Auto-correcting to use selected products.');
        eligibleProductIds = selectedProducts;
      }

      const isDailyRedeemable = formData.restriction_type === 'special_discount';

      let voucherType: string;
      if (formData.discount_type === 'percentage') {
        voucherType = 'percent';
      } else if (formData.discount_type === 'fixed') {
        voucherType = 'amount';
      } else {
        voucherType = 'free_gift';
      }

      const voucherData: any = {
        code: formData.code.toUpperCase().trim(),
        description: formData.description.trim(),
        voucher_type: voucherType,
        value: discountValue,
        application_scope: formData.application_scope,
        product_application_method: formData.application_scope === 'product_level' ? formData.product_application_method : 'total_once',
        min_purchase: 0,
        eligible_product_ids: eligibleProductIds,
        eligible_category_ids: formData.restriction_type === 'categories' ? selectedCategories : [],
        eligible_subcategory_ids: formData.restriction_type === 'subcategories' ? selectedSubcategories : [],
        max_products_per_use: maxProductsPerUse,
        usage_limit_per_user: formData.usage_limit_per_user ? parseInt(formData.usage_limit_per_user) : 1,
        user_daily_limit: formData.user_daily_limit ? parseInt(formData.user_daily_limit) : null,
        valid_for_today_only: formData.valid_for_today_only,
        is_daily_redeemable: isDailyRedeemable,
        outlet_restriction_type: formData.outlet_restriction_type,
        applicable_outlet_ids: formData.outlet_restriction_type === 'specific_outlets' ? selectedOutlets : [],
        free_gift_name: formData.discount_type === 'free_gift' ? formData.free_gift_name.trim().toUpperCase() : null
      };

      if (formData.min_purchase_amount) {
        voucherData.min_purchase = parseFloat(formData.min_purchase_amount);
      }

      if (formData.max_discount_amount && formData.discount_type === 'percentage') {
        const metadata = { max_discount_amount: parseFloat(formData.max_discount_amount) };
        voucherData.metadata = metadata;
      }

      if (formData.usage_limit) {
        voucherData.max_uses = parseInt(formData.usage_limit);
      }

      if (formData.expires_at) {
        const expiryDate = new Date(formData.expires_at);
        if (formData.valid_for_today_only) {
          expiryDate.setHours(23, 59, 59, 999);
        }
        voucherData.expires_at = expiryDate.toISOString();
      } else {
        voucherData.expires_at = null;
      }

      const { error: updateError } = await supabase
        .from('vouchers')
        .update(voucherData)
        .eq('id', voucher.id);

      if (updateError) {
        if (updateError.code === '23505') {
          throw new Error('Voucher code already exists. Please use a different code.');
        }
        throw updateError;
      }

      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Error updating voucher:', err);
      setError(err.message || 'Failed to update voucher');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('shop_products')
        .select('id, product_id, name, category_id, base_price, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, category_id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadSubcategories = async () => {
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .select('id, subcategory_id, category_id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSubcategories(data || []);
    } catch (error) {
      console.error('Error loading subcategories:', error);
    }
  };

  const loadSpecialDiscountCount = async () => {
    try {
      const { count, error } = await supabase
        .from('shop_products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('special_discount', true);

      if (error) throw error;
      setSpecialDiscountCount(count || 0);
    } catch (error) {
      console.error('Error loading special discount count:', error);
    }
  };

  const loadOutlets = async () => {
    try {
      const { data, error } = await supabase
        .from('outlets')
        .select('id, name, location, address, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setOutlets(data || []);
    } catch (error) {
      console.error('Error loading outlets:', error);
    }
  };

  const checkIfSpecialDiscountVoucher = async (productIds: string[]): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('shop_products')
        .select('product_id')
        .eq('is_active', true)
        .eq('special_discount', true);

      if (error) throw error;
      const specialProductIds = data?.map(p => p.product_id) || [];

      return productIds.length > 0 &&
             productIds.every(id => specialProductIds.includes(id)) &&
             specialProductIds.every(id => productIds.includes(id));
    } catch (error) {
      console.error('Error checking special discount:', error);
      return false;
    }
  };

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleSubcategory = (subcategoryId: string) => {
    setSelectedSubcategories(prev =>
      prev.includes(subcategoryId)
        ? prev.filter(id => id !== subcategoryId)
        : [...prev, subcategoryId]
    );
  };

  const toggleOutlet = (outletId: string) => {
    setSelectedOutlets(prev =>
      prev.includes(outletId)
        ? prev.filter(id => id !== outletId)
        : [...prev, outletId]
    );
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.product_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleClose = () => {
    setSearchQuery('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black">Edit Voucher</h2>
              <p className="text-blue-100 text-sm">Update voucher details and settings</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-red-900">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Voucher Code *
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none font-mono font-bold uppercase"
                  placeholder="SUMMER2024"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Must be unique and easy to remember</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Description *
              </label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
                rows={3}
                placeholder="E.g., Summer Sale - 20% off all items"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Discount Type *
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, discount_type: 'percentage' })}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    formData.discount_type === 'percentage'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Percent className={`w-6 h-6 ${formData.discount_type === 'percentage' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className="text-sm font-bold">Percentage</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, discount_type: 'fixed' })}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    formData.discount_type === 'fixed'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <DollarSign className={`w-6 h-6 ${formData.discount_type === 'fixed' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className="text-sm font-bold">Fixed Amount</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, discount_type: 'free_gift' })}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    formData.discount_type === 'free_gift'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Gift className={`w-6 h-6 ${formData.discount_type === 'free_gift' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className="text-sm font-bold">FREE GIFT</span>
                </button>
              </div>
            </div>

            {formData.discount_type === 'free_gift' ? (
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Gift Name *
                </label>
                <div className="relative">
                  <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={formData.free_gift_name}
                    onChange={(e) => setFormData({ ...formData, free_gift_name: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none font-bold uppercase"
                    placeholder="CAKE"
                    maxLength={50}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Enter the name of the free gift (e.g., CAKE, DRINK, TOY)</p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Discount Value *
                </label>
                <div className="relative">
                  {formData.discount_type === 'percentage' ? (
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  ) : (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">RM</span>
                  )}
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    max={formData.discount_type === 'percentage' ? '100' : undefined}
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none font-bold"
                    placeholder={formData.discount_type === 'percentage' ? '20' : '50.00'}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Minimum Purchase (Optional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">RM</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.min_purchase_amount}
                  onChange={(e) => setFormData({ ...formData, min_purchase_amount: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  placeholder="100.00"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Minimum order amount required</p>
            </div>

            {formData.discount_type === 'percentage' && (
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Max Discount Cap (Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">RM</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.max_discount_amount}
                    onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    placeholder="50.00"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Maximum discount amount</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Usage Limit (Optional)
              </label>
              <input
                type="number"
                min="1"
                value={formData.usage_limit}
                onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                placeholder="Unlimited"
              />
              <p className="text-xs text-gray-500 mt-1">Total redemptions across ALL users (e.g., 1000 users can redeem)</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                User Lifetime Limit (Optional)
              </label>
              <input
                type="number"
                min="1"
                value={formData.usage_limit_per_user}
                onChange={(e) => setFormData({ ...formData, usage_limit_per_user: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                placeholder="1"
              />
              <p className="text-xs text-gray-500 mt-1">How many times EACH user can use this voucher total (default: 1)</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                User Daily Limit (Optional)
              </label>
              <input
                type="number"
                min="1"
                value={formData.user_daily_limit}
                onChange={(e) => setFormData({ ...formData, user_daily_limit: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                placeholder="Unlimited"
              />
              <p className="text-xs text-gray-500 mt-1">How many times EACH user can use this voucher PER DAY (empty = unlimited daily uses)</p>
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Expiry Date (Optional)
              </label>
              <div className="space-y-3">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="date"
                    value={formData.expires_at}
                    onChange={(e) => {
                      setFormData({ ...formData, expires_at: e.target.value });
                      if (formData.valid_for_today_only && e.target.value) {
                        const today = new Date().toISOString().split('T')[0];
                        if (e.target.value !== today) {
                          setFormData({ ...formData, expires_at: e.target.value, valid_for_today_only: false });
                        }
                      }
                    }}
                    min={new Date().toISOString().split('T')[0]}
                    disabled={formData.valid_for_today_only}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
                <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={formData.valid_for_today_only}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      const today = new Date().toISOString().split('T')[0];
                      setFormData({
                        ...formData,
                        valid_for_today_only: isChecked,
                        expires_at: isChecked ? today : formData.expires_at
                      });
                    }}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-900">Same date as redemption day</div>
                    <div className="text-xs text-gray-600">Voucher is only valid for today</div>
                  </div>
                  {formData.valid_for_today_only && (
                    <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                      Valid for today only
                    </span>
                  )}
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">Leave empty for no expiry</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Application Scope *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, application_scope: 'order_total', restriction_type: 'none' });
                  }}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    formData.application_scope === 'order_total'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-bold text-sm mb-1">Order Total</div>
                  <div className="text-xs text-gray-600">Discount applies to entire order</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, application_scope: 'product_level' });
                  }}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    formData.application_scope === 'product_level'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-bold text-sm mb-1">Product Level</div>
                  <div className="text-xs text-gray-600">Discount applies to specific products</div>
                </button>
              </div>
            </div>

            {formData.application_scope === 'product_level' && (
              <>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Application Method *
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, product_application_method: 'total_once' })}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        formData.product_application_method === 'total_once'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-bold text-sm mb-1">Apply to Overall Total</div>
                      <div className="text-xs text-gray-600">
                        Discount applies once to the total price
                        {formData.discount_type === 'percentage'
                          ? ` (e.g., ${formData.discount_value || '20'}% off total)`
                          : ` (e.g., RM${formData.discount_value || '5'} off total)`
                        }
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, product_application_method: 'per_product' })}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        formData.product_application_method === 'per_product'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-bold text-sm mb-1">Apply to Every Applicable Product</div>
                      <div className="text-xs text-gray-600">
                        Discount applies to each product individually
                        {formData.discount_type === 'percentage'
                          ? ` (e.g., ${formData.discount_value || '20'}% off each item)`
                          : ` (e.g., RM${formData.discount_value || '5'} × ${formData.max_products_per_use || '6'} products = RM${(parseFloat(formData.discount_value || '5') * parseInt(formData.max_products_per_use || '6')).toFixed(2)} max discount)`
                        }
                      </div>
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Maximum Products Per Use *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="20"
                    value={formData.max_products_per_use}
                    onChange={(e) => setFormData({ ...formData, max_products_per_use: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none font-bold"
                    placeholder="6"
                  />
                  <p className="text-xs text-gray-500 mt-1">How many products can this voucher be applied to in a single order (1-20)</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Restriction Type *
                  </label>
                  <p className="text-xs text-gray-600 mb-3">
                    <strong>All Products:</strong> No restrictions, applies to entire order.
                    <strong className="ml-2">By Product:</strong> Select specific products below.
                  </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, restriction_type: 'none' });
                      setSelectedProducts([]);
                      setSelectedCategories([]);
                      setSelectedSubcategories([]);
                    }}
                    className={`p-3 rounded-xl border-2 transition-all text-sm font-bold ${
                      formData.restriction_type === 'none'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    All Products
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, restriction_type: 'products' })}
                    className={`p-3 rounded-xl border-2 transition-all text-sm font-bold ${
                      formData.restriction_type === 'products'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    By Product
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, restriction_type: 'categories' })}
                    className={`p-3 rounded-xl border-2 transition-all text-sm font-bold ${
                      formData.restriction_type === 'categories'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    By Category
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, restriction_type: 'subcategories' })}
                    className={`p-3 rounded-xl border-2 transition-all text-sm font-bold ${
                      formData.restriction_type === 'subcategories'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    By Subcategory
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, restriction_type: 'special_discount' })}
                    className={`p-3 rounded-xl border-2 transition-all text-sm font-bold ${
                      formData.restriction_type === 'special_discount'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    Special Discount
                  </button>
                </div>

                {formData.restriction_type === 'products' && (
                  <div className="border-2 border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-gray-900">
                        Select Products ({selectedProducts.length})
                      </span>
                      {selectedProducts.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedProducts([])}
                          className="text-xs text-blue-600 hover:text-blue-700 font-bold"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search products..."
                        className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {filteredProducts.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-8">No products found</p>
                      ) : (
                        filteredProducts.map((product) => (
                          <label
                            key={product.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-100"
                          >
                            <input
                              type="checkbox"
                              checked={selectedProducts.includes(product.product_id)}
                              onChange={() => toggleProduct(product.product_id)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <ShoppingBag className="w-4 h-4 text-gray-400" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-gray-900 truncate">{product.name}</div>
                              <div className="text-xs text-gray-500">{product.product_id} • RM {product.base_price}</div>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {formData.restriction_type === 'categories' && (
                  <div className="border-2 border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-gray-900">
                        Select Categories ({selectedCategories.length})
                      </span>
                      {selectedCategories.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedCategories([])}
                          className="text-xs text-blue-600 hover:text-blue-700 font-bold"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {categories.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-8">No categories found</p>
                      ) : (
                        categories.map((category) => (
                          <label
                            key={category.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-100"
                          >
                            <input
                              type="checkbox"
                              checked={selectedCategories.includes(category.id)}
                              onChange={() => toggleCategory(category.id)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <Package className="w-4 h-4 text-gray-400" />
                            <div className="flex-1">
                              <div className="text-sm font-bold text-gray-900">{category.name}</div>
                              <div className="text-xs text-gray-500">{category.category_id}</div>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {formData.restriction_type === 'subcategories' && (
                  <div className="border-2 border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-gray-900">
                        Select Subcategories ({selectedSubcategories.length})
                      </span>
                      {selectedSubcategories.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedSubcategories([])}
                          className="text-xs text-blue-600 hover:text-blue-700 font-bold"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {subcategories.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-8">No subcategories found</p>
                      ) : (
                        subcategories.map((subcategory) => {
                          const parentCategory = categories.find(c => c.id === subcategory.category_id);
                          return (
                            <label
                              key={subcategory.id}
                              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-100"
                            >
                              <input
                                type="checkbox"
                                checked={selectedSubcategories.includes(subcategory.id)}
                                onChange={() => toggleSubcategory(subcategory.id)}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                              />
                              <Layers className="w-4 h-4 text-gray-400" />
                              <div className="flex-1">
                                <div className="text-sm font-bold text-gray-900">{subcategory.name}</div>
                                <div className="text-xs text-gray-500">
                                  {subcategory.subcategory_id} • {parentCategory?.name || 'Unknown Category'}
                                </div>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {formData.restriction_type === 'special_discount' && (
                  <div className="border-2 border-blue-200 bg-blue-50 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-blue-900 mb-1">Special Discount Products - Daily Redeemable</p>
                        <p className="text-sm text-blue-700 mb-3">
                          This voucher will automatically apply to all products marked as "Special Discount" in the product catalog.
                        </p>
                        <div className="bg-green-100 border border-green-300 rounded-lg p-3 mb-3">
                          <p className="text-sm font-bold text-green-900 mb-1">🎯 Daily Redemption Feature</p>
                          <p className="text-xs text-green-800">
                            Users can redeem this voucher code <strong>once per day</strong>. Each redemption is valid until midnight of that day.
                            The same code can be redeemed again the next day!
                          </p>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-white border border-blue-200 rounded-lg">
                          <Package className="w-5 h-5 text-blue-600" />
                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              {specialDiscountCount} {specialDiscountCount === 1 ? 'product' : 'products'} available
                            </p>
                            <p className="text-xs text-gray-600">Currently marked as special discount</p>
                          </div>
                        </div>
                        {specialDiscountCount === 0 && (
                          <p className="text-xs text-orange-600 mt-2 font-medium">
                            Note: No products are currently marked as special discount. This voucher won't be applicable until products are marked.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                </div>
              </>
            )}

            <div className="md:col-span-2 border-t border-gray-200 pt-6">
              <label className="block text-sm font-bold text-gray-900 mb-3">
                <div className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-gray-700" />
                  Applicable Outlets *
                </div>
              </label>
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, outlet_restriction_type: 'all_outlets' });
                    setSelectedOutlets([]);
                  }}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    formData.outlet_restriction_type === 'all_outlets'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-bold text-sm mb-1">All Outlets</div>
                  <div className="text-xs text-gray-600">Voucher works at all locations</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, outlet_restriction_type: 'specific_outlets' })}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    formData.outlet_restriction_type === 'specific_outlets'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-bold text-sm mb-1">Specific Outlets Only</div>
                  <div className="text-xs text-gray-600">Limit to selected locations</div>
                </button>
              </div>

              {formData.outlet_restriction_type === 'specific_outlets' && (
                <div className="border-2 border-gray-200 rounded-xl p-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-gray-900">
                      Select Outlets ({selectedOutlets.length})
                    </span>
                    {selectedOutlets.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedOutlets([])}
                        className="text-xs text-blue-600 hover:text-blue-700 font-bold"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {outlets.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">No outlets found</p>
                    ) : (
                      outlets.map((outlet) => (
                        <label
                          key={outlet.id}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-100"
                        >
                          <input
                            type="checkbox"
                            checked={selectedOutlets.includes(outlet.id)}
                            onChange={() => toggleOutlet(outlet.id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-gray-900">{outlet.name}</div>
                            <div className="text-xs text-gray-500 truncate">{outlet.location}</div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 shadow-lg"
            >
              {loading ? 'Updating...' : 'Update Voucher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditVoucherModal;
