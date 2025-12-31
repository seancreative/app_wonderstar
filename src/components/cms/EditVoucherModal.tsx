import React, { useState, useEffect } from 'react';
import { X, Tag, Percent, DollarSign, Calendar, Hash, AlertCircle, Search, ShoppingBag, Package, Layers, Gift, Percent as PercentageIcon, Check, ArrowRight, Save, MapPin } from 'lucide-react';
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
  const [showProductSelector, setShowProductSelector] = useState(false);
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
    if (voucher.is_daily_redeemable) {
      // Assuming logic from Create modal where special_discount sets is_daily_redeemable to true
      // Or checking if product ids match special discount products.
      // The original file used checkIfSpecialDiscountVoucher helper. I will re-implement it below inside this function or as standalone.
      restrictionType = 'special_discount'; // Initial guess, verified by check below
    } else if (hasProducts) {
      restrictionType = 'products';
    } else if (hasCategories) {
      restrictionType = 'categories';
    } else if (hasSubcategories) {
      restrictionType = 'subcategories';
    }

    // Double check special discount logic
    if (hasProducts) {
      checkIfSpecialDiscountVoucher(voucher.eligible_product_ids).then(isSpecial => {
        if (isSpecial) {
          setFormData(prev => ({ ...prev, restriction_type: 'special_discount' }));
        } else {
          // If not special, and we have products, it stays 'products'
        }
      });
    }

    let discountType: 'percentage' | 'fixed' | 'free_gift' = 'percentage';
    if (voucher.voucher_type === 'percent') {
      discountType = 'percentage';
    } else if (voucher.voucher_type === 'free_gift') {
      discountType = 'free_gift';
    } else {
      discountType = 'fixed';
    }

    const appScope = voucher.application_scope || 'order_total';
    setShowProductSelector(appScope === 'product_level');

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
      application_scope: appScope,
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
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]
    );
  };

  const toggleSubcategory = (subcategoryId: string) => {
    setSelectedSubcategories(prev =>
      prev.includes(subcategoryId) ? prev.filter(id => id !== subcategoryId) : [...prev, subcategoryId]
    );
  };

  const toggleOutlet = (outletId: string) => {
    setSelectedOutlets(prev =>
      prev.includes(outletId) ? prev.filter(id => id !== outletId) : [...prev, outletId]
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

  const SectionHeader = ({ title, icon: Icon }: { title: string; icon: any }) => (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
      <Icon className="w-5 h-5 text-blue-600" />
      <h3 className="font-bold text-gray-800">{title}</h3>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex-none p-6 border-b border-gray-100 flex items-center justify-between bg-white rounded-t-2xl z-10 transition-colors">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Tag className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">Edit Voucher</h2>
              <p className="text-gray-500 text-sm font-medium">Update voucher details and settings</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <form id="edit-voucher-form" onSubmit={handleSubmit} className="p-6 lg:p-8">
            {error && (
              <div className="mb-8 bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-900">Action Required</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">

              {/* LEFT COLUMN: Core Info & Discount Logic */}
              <div className="lg:col-span-12 xl:col-span-7 space-y-10">

                {/* 1. Basic Information */}
                <section>
                  <SectionHeader title="Basic Information" icon={Tag} />
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Voucher Code</label>
                      <div className="relative group">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                          type="text"
                          required
                          value={formData.code}
                          onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                          className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-xl outline-none font-mono font-bold text-lg transition-all placeholder:text-gray-300 uppercase"
                          placeholder="SUMMER2024"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2 ml-1">Uppercase letters and numbers only</p>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                      <textarea
                        required
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-xl outline-none transition-all placeholder:text-gray-300 min-h-[100px]"
                        placeholder="e.g. Get 20% off on all Summer Collection items"
                      />
                    </div>
                  </div>
                </section>

                {/* 2. Discount Configuration */}
                <section>
                  <SectionHeader title="Discount Configuration" icon={PercentageIcon} />
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-3">Discount Type</label>
                      <div className="grid grid-cols-3 gap-3">
                        {['percentage', 'fixed', 'free_gift'].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setFormData({ ...formData, discount_type: type as any })}
                            className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${formData.discount_type === type
                                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-500'
                                : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50 text-gray-600'
                              }`}
                          >
                            {type === 'percentage' && <Percent className="w-5 h-5" />}
                            {type === 'fixed' && <DollarSign className="w-5 h-5" />}
                            {type === 'free_gift' && <Gift className="w-5 h-5" />}
                            <span className="text-xs font-bold uppercase tracking-wider">{type.replace('_', ' ')}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {formData.discount_type === 'free_gift' ? (
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-bold text-gray-700 mb-2">Gift Name</label>
                          <div className="relative group">
                            <Gift className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                              type="text"
                              required
                              value={formData.free_gift_name}
                              onChange={(e) => setFormData({ ...formData, free_gift_name: e.target.value })}
                              className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-xl outline-none font-bold transition-all"
                              placeholder="e.g. FREE MYSTERY GIFT"
                            />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">
                            {formData.discount_type === 'percentage' ? 'Percentage Value' : 'Discount Amount'}
                          </label>
                          <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 group-focus-within:text-blue-500 transition-colors pointer-events-none">
                              {formData.discount_type === 'percentage' ? <Percent className="w-4 h-4" /> : <span className="font-bold text-sm">RM</span>}
                            </div>
                            <input
                              type="number"
                              required
                              step="0.01"
                              min="0"
                              max={formData.discount_type === 'percentage' ? '100' : undefined}
                              value={formData.discount_value}
                              onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                              className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-xl outline-none font-bold text-lg transition-all"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Min. Purchase (Optional)</label>
                        <div className="relative group">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold group-focus-within:text-blue-500 transition-colors">RM</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.min_purchase_amount}
                            onChange={(e) => setFormData({ ...formData, min_purchase_amount: e.target.value })}
                            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-xl outline-none transition-all placeholder:text-gray-300"
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      {formData.discount_type === 'percentage' && (
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-bold text-gray-700 mb-2">Maximum Discount Cap (Optional)</label>
                          <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold group-focus-within:text-blue-500 transition-colors">RM</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.max_discount_amount}
                              onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value })}
                              className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-xl outline-none transition-all placeholder:text-gray-300"
                              placeholder="e.g. 50.00 (Max discount allowed)"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>

              {/* RIGHT COLUMN: Limits, Validity & Scope */}
              <div className="lg:col-span-12 xl:col-span-5 space-y-10">

                {/* 3. Validity */}
                <section>
                  <SectionHeader title="Validity Period" icon={Calendar} />
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-xl border-2 border-transparent focus-within:bg-white focus-within:border-blue-500 transition-all">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Expiration Date</label>
                      <input
                        type="date"
                        value={formData.expires_at}
                        onChange={(e) => {
                          setFormData({ ...formData, expires_at: e.target.value });
                          if (formData.valid_for_today_only && e.target.value) {
                            const today = new Date().toISOString().split('T')[0];
                            if (e.target.value !== today) {
                              setFormData(prev => ({ ...prev, expires_at: e.target.value, valid_for_today_only: false }));
                            }
                          }
                        }}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full bg-transparent outline-none font-bold text-gray-900"
                      />
                    </div>

                    <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 group transition-colors">
                      <div className="relative flex items-center">
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
                          className="peer sr-only"
                        />
                        <div className="w-5 h-5 border-2 border-gray-300 rounded peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-all"></div>
                        <Check className="absolute w-3.5 h-3.5 text-white left-0.5 opacity-0 peer-checked:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex-1">
                        <span className="font-bold text-gray-800 text-sm">Valid for Today Only</span>
                        <p className="text-xs text-gray-500 mt-0.5">Automatically sets expiry to end of today</p>
                      </div>
                    </label>
                  </div>
                </section>

                {/* 4. Application Scope */}
                <section>
                  <SectionHeader title="Scope & Limits" icon={Layers} />
                  <div className="space-y-6">
                    {formData.discount_type !== 'free_gift' && (
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">Application Scope</label>
                        <div className="flex rounded-xl bg-gray-100 p-1">
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, application_scope: 'order_total', restriction_type: 'none' });
                              setShowProductSelector(false);
                            }}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all ${formData.application_scope === 'order_total'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                              }`}
                          >
                            Order Total
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, application_scope: 'product_level' });
                              setShowProductSelector(true);
                            }}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all ${formData.application_scope === 'product_level'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                              }`}
                          >
                            Specific Products
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Outlet Restrictions */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Outlet Availability</label>
                      <div className="space-y-3">
                        <div className="flex rounded-xl bg-gray-100 p-1">
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, outlet_restriction_type: 'all_outlets' })}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all ${formData.outlet_restriction_type === 'all_outlets'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                              }`}
                          >
                            All Outlets
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, outlet_restriction_type: 'specific_outlets' })}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all ${formData.outlet_restriction_type === 'specific_outlets'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                              }`}
                          >
                            Specific Outlets
                          </button>
                        </div>

                        {formData.outlet_restriction_type === 'specific_outlets' && (
                          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 max-h-40 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 gap-2">
                              {outlets.map(outlet => (
                                <label key={outlet.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                                  <div className="relative flex items-center">
                                    <input
                                      type="checkbox"
                                      checked={selectedOutlets.includes(outlet.id)}
                                      onChange={() => toggleOutlet(outlet.id)}
                                      className="peer sr-only"
                                    />
                                    <div className="w-5 h-5 border-2 border-gray-300 rounded peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-all"></div>
                                    <Check className="absolute w-3.5 h-3.5 text-white left-0.5 opacity-0 peer-checked:opacity-100 transition-opacity" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-sm font-semibold text-gray-800">{outlet.name}</div>
                                    <div className="text-xs text-gray-500 flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {outlet.location}
                                    </div>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total Limit</label>
                        <input
                          type="number"
                          min="1"
                          value={formData.usage_limit}
                          onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 rounded-lg outline-none text-sm transition-all"
                          placeholder="Unlimited"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">User Limit</label>
                        <input
                          type="number"
                          min="1"
                          value={formData.usage_limit_per_user}
                          onChange={(e) => setFormData({ ...formData, usage_limit_per_user: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 rounded-lg outline-none text-sm transition-all"
                          placeholder="1"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* 5. Restrictions Preview */}
                {formData.application_scope === 'product_level' && (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <h4 className="font-bold text-gray-800 text-sm mb-2">Current Restrictions</h4>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>Type: <span className="font-semibold text-gray-900 capitalize">{formData.restriction_type.replace('_', ' ')}</span></p>
                      <p>Selected: <span className="font-semibold text-gray-900">
                        {formData.restriction_type === 'products' ? selectedProducts.length :
                          formData.restriction_type === 'categories' ? selectedCategories.length :
                            formData.restriction_type === 'subcategories' ? selectedSubcategories.length :
                              'All'} items
                      </span></p>
                    </div>
                  </div>
                )}

              </div>

              {/* FULL WIDTH: Product Selection Area */}
              {(formData.application_scope === 'product_level' || showProductSelector) && (
                <div className="col-span-12 pt-8 border-t border-gray-100">
                  <SectionHeader title="Product Rules & Restrictions" icon={ShoppingBag} />

                  <div className="space-y-6">
                    {/* Method Selector */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, product_application_method: 'total_once' })}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${formData.product_application_method === 'total_once'
                            ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                            : 'border-gray-100 hover:border-gray-300'
                          }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${formData.product_application_method === 'total_once' ? 'border-blue-500' : 'border-gray-400'
                            }`}>
                            {formData.product_application_method === 'total_once' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                          </div>
                          <span className="font-bold text-gray-900">Apply Once to Total</span>
                        </div>
                        <p className="text-xs text-gray-500 pl-6">Discount applies once to the sum of eligible items.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, product_application_method: 'per_product' })}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${formData.product_application_method === 'per_product'
                            ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                            : 'border-gray-100 hover:border-gray-300'
                          }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${formData.product_application_method === 'per_product' ? 'border-blue-500' : 'border-gray-400'
                            }`}>
                            {formData.product_application_method === 'per_product' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                          </div>
                          <span className="font-bold text-gray-900">Apply Per Product</span>
                        </div>
                        <p className="text-xs text-gray-500 pl-6">Discount applies to EACH eligible item individually.</p>
                      </button>
                    </div>

                    <div className="md:w-1/2">
                      <label className="block text-sm font-bold text-gray-700 mb-2">Max Quantity Per Order</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={formData.max_products_per_use}
                        onChange={(e) => setFormData({ ...formData, max_products_per_use: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 rounded-xl outline-none font-bold"
                      />
                      <p className="text-xs text-gray-400 mt-1">Limit how many eligible items get the discount</p>
                    </div>

                    {/* Restriction Type Tabs */}
                    <div className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-xl">
                      {['none', 'products', 'categories', 'subcategories', 'special_discount'].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, restriction_type: type as any });
                            if (type === 'none') {
                              setSelectedProducts([]); setSelectedCategories([]); setSelectedSubcategories([]);
                            }
                          }}
                          className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${formData.restriction_type === type
                              ? 'bg-white text-blue-600 shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                          {type.replace('_', ' ')}
                        </button>
                      ))}
                    </div>

                    {/* Selector Lists */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 max-h-[400px] overflow-y-auto custom-scrollbar">
                      {formData.restriction_type === 'none' && (
                        <div className="text-center py-8 text-gray-500">
                          <Layers className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                          <p>All products will be eligible for this voucher.</p>
                        </div>
                      )}

                      {formData.restriction_type === 'products' && (
                        <div className="space-y-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input type="text" placeholder="Search products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-blue-500 outline-none" />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {filteredProducts.map(product => (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => toggleProduct(product.product_id)}
                                className={`p-3 rounded-lg border text-left text-sm transition-all flex items-start gap-2 ${selectedProducts.includes(product.product_id)
                                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                  }`}
                              >
                                <div className={`mt-0.5 w-4 h-4 flex-shrink-0 border rounded flex items-center justify-center ${selectedProducts.includes(product.product_id) ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                                  }`}>
                                  {selectedProducts.includes(product.product_id) && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span className="line-clamp-2">{product.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {formData.restriction_type === 'categories' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {categories.map(cat => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => toggleCategory(cat.id)}
                              className={`p-3 rounded-lg border text-left text-sm transition-all flex items-center gap-2 ${selectedCategories.includes(cat.id)
                                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                            >
                              <div className={`w-4 h-4 flex-shrink-0 border rounded flex items-center justify-center ${selectedCategories.includes(cat.id) ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                                }`}>
                                {selectedCategories.includes(cat.id) && <Check className="w-3 h-3 text-white" />}
                              </div>
                              {cat.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {formData.restriction_type === 'subcategories' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {subcategories.map(sub => (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => toggleSubcategory(sub.id)}
                              className={`p-3 rounded-lg border text-left text-sm transition-all flex items-center gap-2 ${selectedSubcategories.includes(sub.id)
                                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                            >
                              <div className={`w-4 h-4 flex-shrink-0 border rounded flex items-center justify-center ${selectedSubcategories.includes(sub.id) ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                                }`}>
                                {selectedSubcategories.includes(sub.id) && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <span className="flex-1 truncate">
                                <span className="text-gray-500 text-xs block">{categories.find(c => c.id === sub.category_id)?.name} &rsaquo;</span>
                                {sub.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {formData.restriction_type === 'special_discount' && (
                        <div className="text-center py-8">
                          <div className="p-4 bg-purple-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                            <Gift className="w-8 h-8 text-purple-600" />
                          </div>
                          <p className="font-bold text-gray-900">Special Discount Products</p>
                          <p className="text-sm text-gray-500 max-w-md mx-auto mt-2">
                            This voucher will apply to {specialDiscountCount} products marked as "Special Discount" in the inventory.
                            New products with this flag will automatically be eligible.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="h-20"></div> {/* Spacer for fixed footer */}
          </form>
        </div>

        {/* Fixed Footer */}
        <div className="bg-white border-t border-gray-100 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-2xl z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <div className="text-sm text-gray-500 font-medium hidden sm:block">
            {formData.restriction_type === 'products' && selectedProducts.length > 0 && <span>{selectedProducts.length} products selected</span>}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 sm:flex-none px-6 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-bold hover:bg-gray-50 hover:border-gray-300 transition-all text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-voucher-form"
              disabled={loading}
              className="flex-1 sm:flex-none px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold hover:shadow-lg hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:scale-100"
            >
              {loading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EditVoucherModal;
