import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import CMSLayout from '../../components/cms/CMSLayout';
import CreateVoucherModal from '../../components/cms/CreateVoucherModal';
import EditVoucherModal from '../../components/cms/EditVoucherModal';
import {
  Megaphone, Tag, Gift, TrendingUp, Users, DollarSign, Plus, Trash2, Power,
  ArrowUpDown, ChevronDown, ChevronUp, ShoppingBag, Package, Edit,
  Image, Upload, X, Save, MoveUp, MoveDown, Eye, EyeOff, Link as LinkIcon, AlertCircle, Store, MapPin
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { formatDateTimeCMS } from '../../utils/dateFormatter';

interface MarketingStats {
  activeVouchers: number;
  totalRedemptions: number;
  discountGiven: number;
  conversionRate: number;
}

interface PromoBanner {
  id: string;
  image_url: string;
  title: string;
  description: string;
  link_url: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CMSMarketing: React.FC = () => {
  const navigate = useNavigate();
  const { admin, loading: adminLoading } = useAdminAuth();
  const { staff, loading: staffLoading } = useStaffAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'vouchers' | 'sliders'>('vouchers');
  const [stats, setStats] = useState<MarketingStats>({
    activeVouchers: 0,
    totalRedemptions: 0,
    discountGiven: 0,
    conversionRate: 0
  });
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [sortField, setSortField] = useState<string>('created_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);
  const [expandedVoucher, setExpandedVoucher] = useState<string | null>(null);
  const [productsMap, setProductsMap] = useState<Record<string, any>>({});
  const [categoriesMap, setCategoriesMap] = useState<Record<string, any>>({});
  const [outletsMap, setOutletsMap] = useState<Record<string, any>>({});

  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [showSliderModal, setShowSliderModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<PromoBanner | null>(null);
  const [sliderFormData, setSliderFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    link_url: '#',
    is_active: true
  });

  const toast = useToast();
  const authLoading = adminLoading || staffLoading;
  const currentUser = admin || staff;
  const isStaff = !admin && !!staff;

  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate('/cms/login');
      return;
    }

    // Check staff permissions
    if (isStaff && staff?.role === 'manager') {
      const permissions = (staff as any).assigned_permissions || {};
      if (!permissions.marketing) {
        navigate('/cms/unauthorized');
        return;
      }
    }

    if (currentUser) {
      loadMarketingData();
    }
  }, [admin, staff, authLoading, navigate]);

  const [uploading, setUploading] = useState(false);
  const MAX_SLIDERS = 10;

  const loadMarketingData = async () => {
    try {
      const [vouchersResult, userVouchersResult, allVouchersResult, productsResult, categoriesResult, ordersResult, bannersResult, outletsResult] = await Promise.all([
        supabase
          .from('vouchers')
          .select('*')
          .eq('is_active', true),
        supabase
          .from('user_vouchers')
          .select('*, voucher:vouchers(id, code, voucher_type, value)')
          .gt('usage_count', 0),
        supabase
          .from('vouchers')
          .select('*')
          .order('created_date', { ascending: false }),
        supabase
          .from('shop_products')
          .select('id, product_id, name'),
        supabase
          .from('categories')
          .select('id, category_id, name'),
        supabase
          .from('shop_orders')
          .select('id, voucher_id, discount_amount')
          .not('voucher_id', 'is', null),
        supabase
          .from('promo_banners')
          .select('*')
          .order('display_order', { ascending: true }),
        supabase
          .from('outlets')
          .select('id, name, location')
          .eq('is_active', true)
      ]);

      const activeVouchers = vouchersResult.data || [];
      const userVouchers = userVouchersResult.data || [];
      const allVouchers = allVouchersResult.data || [];
      const products = productsResult.data || [];
      const categories = categoriesResult.data || [];
      const orders = ordersResult.data || [];

      const prodMap: Record<string, any> = {};
      products.forEach(p => {
        prodMap[p.product_id] = p;
      });
      setProductsMap(prodMap);

      const catMap: Record<string, any> = {};
      categories.forEach(c => {
        catMap[c.id] = c;
      });
      setCategoriesMap(catMap);

      const outlets = outletsResult.data || [];
      const outMap: Record<string, any> = {};
      outlets.forEach(o => {
        outMap[o.id] = o;
      });
      setOutletsMap(outMap);

      const totalRedemptions = userVouchers.reduce((sum, uv) => sum + (uv.usage_count || 0), 0);
      const discountGiven = orders.reduce((sum, o) => sum + parseFloat(o.discount_amount || 0), 0);

      const voucherRedemptionMap: Record<string, number> = {};
      userVouchers.forEach(uv => {
        if (uv.voucher_id) {
          voucherRedemptionMap[uv.voucher_id] = (voucherRedemptionMap[uv.voucher_id] || 0) + (uv.usage_count || 0);
        }
      });

      const vouchersWithStats = allVouchers.map(v => ({
        ...v,
        redemption_count: voucherRedemptionMap[v.id] || 0
      }));

      setStats({
        activeVouchers: activeVouchers.length,
        totalRedemptions,
        discountGiven,
        conversionRate: 0
      });

      setVouchers(vouchersWithStats);
      setBanners(bannersResult.data || []);
    } catch (error) {
      console.error('Error loading marketing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getFieldValue = (voucher: any, field: string) => {
    if (field === 'discount_amount') return voucher.value || 0;
    if (field === 'redemption_count') return voucher.redemption_count || 0;
    return voucher[field];
  };

  const toggleVoucherStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('vouchers')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      await loadMarketingData();
    } catch (error) {
      console.error('Error toggling voucher status:', error);
    }
  };

  const deleteVoucher = async (id: string) => {
    if (!confirm('Are you sure you want to delete this voucher?')) return;

    try {
      const { error } = await supabase
        .from('vouchers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadMarketingData();
    } catch (error) {
      console.error('Error deleting voucher:', error);
    }
  };

  const handleEditVoucher = (voucher: any) => {
    setSelectedVoucher(voucher);
    setShowEditModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.warning('Please upload an image file');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `promo-banners/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      setSliderFormData(prev => ({ ...prev, image_url: publicUrl }));
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSliderSubmit = async () => {
    if (!sliderFormData.title.trim() || !sliderFormData.description.trim()) {
      toast.warning('Please fill in title and description');
      return;
    }

    try {
      if (editingBanner) {
        const { error } = await supabase
          .from('promo_banners')
          .update({
            title: sliderFormData.title,
            description: sliderFormData.description,
            image_url: sliderFormData.image_url,
            link_url: sliderFormData.link_url || '#',
            is_active: sliderFormData.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingBanner.id);

        if (error) throw error;
      } else {
        if (banners.length >= MAX_SLIDERS) {
          toast.warning(`Maximum of ${MAX_SLIDERS} sliders allowed`);
          return;
        }

        const maxOrder = banners.length > 0
          ? Math.max(...banners.map(b => b.display_order))
          : 0;

        const { error } = await supabase
          .from('promo_banners')
          .insert({
            title: sliderFormData.title,
            description: sliderFormData.description,
            image_url: sliderFormData.image_url,
            link_url: sliderFormData.link_url || '#',
            is_active: sliderFormData.is_active,
            display_order: maxOrder + 1
          });

        if (error) throw error;
      }

      setShowSliderModal(false);
      setEditingBanner(null);
      setSliderFormData({ title: '', description: '', image_url: '', link_url: '#', is_active: true });
      loadMarketingData();
    } catch (error) {
      console.error('Error saving slider:', error);
      toast.error('Failed to save slider');
    }
  };

  const handleEditSlider = (banner: PromoBanner) => {
    setEditingBanner(banner);
    setSliderFormData({
      title: banner.title,
      description: banner.description,
      image_url: banner.image_url,
      link_url: banner.link_url || '#',
      is_active: banner.is_active
    });
    setShowSliderModal(true);
  };

  const handleDeleteSlider = async (id: string) => {
    if (!confirm('Are you sure you want to delete this slider?')) return;

    try {
      const { error } = await supabase
        .from('promo_banners')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadMarketingData();
    } catch (error) {
      console.error('Error deleting slider:', error);
      toast.error('Failed to delete slider');
    }
  };

  const handleToggleSliderActive = async (banner: PromoBanner) => {
    try {
      const { error } = await supabase
        .from('promo_banners')
        .update({ is_active: !banner.is_active })
        .eq('id', banner.id);

      if (error) throw error;
      loadMarketingData();
    } catch (error) {
      console.error('Error toggling slider:', error);
      toast.error('Failed to update slider');
    }
  };

  const handleReorderSlider = async (banner: PromoBanner, direction: 'up' | 'down') => {
    const currentIndex = banners.findIndex(b => b.id === banner.id);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === banners.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const swapBanner = banners[newIndex];

    try {
      await supabase
        .from('promo_banners')
        .update({ display_order: swapBanner.display_order })
        .eq('id', banner.id);

      await supabase
        .from('promo_banners')
        .update({ display_order: banner.display_order })
        .eq('id', swapBanner.id);

      loadMarketingData();
    } catch (error) {
      console.error('Error reordering sliders:', error);
      toast.error('Failed to reorder sliders');
    }
  };

  const sortedVouchers = [...vouchers].sort((a, b) => {
    let aVal = getFieldValue(a, sortField);
    let bVal = getFieldValue(b, sortField);

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  if (loading) {
    return (
      <CMSLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </CMSLayout>
    );
  }

  return (
    <CMSLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900 mb-2">Marketing & Promotions</h1>
            <p className="text-gray-600 font-medium">Manage vouchers, sliders, campaigns, and promotional activities</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-2xl border-2 border-pink-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Tag className="w-6 h-6 text-pink-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-pink-600" />
            </div>
            <p className="text-sm font-bold text-pink-700 mb-1">Active Vouchers</p>
            <p className="text-3xl font-black text-pink-900">{stats.activeVouchers}</p>
            <p className="text-xs text-pink-700 mt-2">Currently available</p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border-2 border-blue-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Gift className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-blue-700 mb-1">Total Redemptions</p>
            <p className="text-3xl font-black text-blue-900">{stats.totalRedemptions}</p>
            <p className="text-xs text-blue-700 mt-2">All time</p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl border-2 border-green-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-green-700 mb-1">Discounts Given</p>
            <p className="text-3xl font-black text-green-900">RM {stats.discountGiven.toFixed(2)}</p>
            <p className="text-xs text-green-700 mt-2">Total savings to customers</p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl border-2 border-orange-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-orange-700 mb-1">Active Sliders</p>
            <p className="text-3xl font-black text-orange-900">{banners.filter(b => b.is_active).length}/{MAX_SLIDERS}</p>
            <p className="text-xs text-orange-700 mt-2">Homepage sliders</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('vouchers')}
                className={`flex-1 px-6 py-4 text-sm font-bold transition-colors ${
                  activeTab === 'vouchers'
                    ? 'text-pink-600 border-b-2 border-pink-600 bg-pink-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Tag className="w-5 h-5" />
                  Vouchers
                </div>
              </button>
              <button
                onClick={() => setActiveTab('sliders')}
                className={`flex-1 px-6 py-4 text-sm font-bold transition-colors ${
                  activeTab === 'sliders'
                    ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Image className="w-5 h-5" />
                  Homepage Sliders
                </div>
              </button>
            </div>
          </div>

          {activeTab === 'vouchers' ? (
            <div>
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-black text-gray-900">Active Vouchers</h2>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-xl font-bold hover:scale-105 transition-transform shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  Create Voucher
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">
                        <button onClick={() => handleSort('code')} className="flex items-center gap-1 hover:text-blue-600">
                          Code <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Description</th>
                      <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">
                        <button onClick={() => handleSort('discount_amount')} className="flex items-center gap-1 hover:text-blue-600">
                          Discount <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">
                        <button onClick={() => handleSort('redemption_count')} className="flex items-center gap-1 hover:text-blue-600">
                          Redemptions <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">
                        <button onClick={() => handleSort('created_date')} className="flex items-center gap-1 hover:text-blue-600">
                          Created <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">
                        <button onClick={() => handleSort('expiry_date')} className="flex items-center gap-1 hover:text-blue-600">
                          Expiry <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Applicable Outlets</th>
                      <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Status</th>
                      <th className="text-right px-6 py-4 text-sm font-bold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedVouchers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center">
                          <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-600 font-medium mb-2">No vouchers created yet</p>
                          <p className="text-sm text-gray-500 mb-6">Create promotional vouchers to boost sales</p>
                          <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-pink-600 text-white rounded-xl font-bold hover:bg-pink-700 transition-colors"
                          >
                            <Plus className="w-5 h-5" />
                            Create First Voucher
                          </button>
                        </td>
                      </tr>
                    ) : (
                      sortedVouchers.map((voucher) => (
                        <React.Fragment key={voucher.id}>
                          <tr className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-mono font-bold text-gray-900">{voucher.code}</span>
                                {(voucher.eligible_product_ids?.length > 0 || voucher.eligible_category_ids?.length > 0) && (
                                  <button
                                    onClick={() => setExpandedVoucher(expandedVoucher === voucher.id ? null : voucher.id)}
                                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                                    title="View restrictions"
                                  >
                                    {expandedVoucher === voucher.id ? (
                                      <ChevronUp className="w-4 h-4 text-gray-600" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-gray-600" />
                                    )}
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                  voucher.application_scope === 'product_level'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {voucher.application_scope === 'product_level' ? 'Product Level' : 'Order Total'}
                                </span>
                                {voucher.eligible_product_ids?.length > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-bold">
                                    <ShoppingBag className="w-3 h-3" />
                                    {voucher.eligible_product_ids.length}
                                  </span>
                                )}
                                {voucher.eligible_category_ids?.length > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-bold">
                                    <Package className="w-3 h-3" />
                                    {voucher.eligible_category_ids.length}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {voucher.description || 'No description'}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-gray-900">
                              {voucher.voucher_type === 'percent' || voucher.voucher_type === 'percentage'
                                ? `${voucher.value}%`
                                : `RM ${voucher.value}`}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                                {voucher.redemption_count || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {voucher.created_date
                                ? formatDateTimeCMS(voucher.created_date)
                                : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {voucher.expires_at
                                ? formatDateTimeCMS(voucher.expires_at)
                                : 'No expiry'}
                            </td>
                            <td className="px-6 py-4">
                              {voucher.outlet_restriction_type === 'all_outlets' || !voucher.outlet_restriction_type ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                                  <Store className="w-3 h-3" />
                                  All Outlets
                                </span>
                              ) : voucher.applicable_outlet_ids && voucher.applicable_outlet_ids.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold w-fit">
                                    <MapPin className="w-3 h-3" />
                                    {voucher.applicable_outlet_ids.length} {voucher.applicable_outlet_ids.length === 1 ? 'Outlet' : 'Outlets'}
                                  </span>
                                  <div className="text-xs text-gray-500">
                                    {voucher.applicable_outlet_ids.slice(0, 2).map((outletId: string) =>
                                      outletsMap[outletId]?.name || outletId
                                    ).join(', ')}
                                    {voucher.applicable_outlet_ids.length > 2 && ` +${voucher.applicable_outlet_ids.length - 2} more`}
                                  </div>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                                  <AlertCircle className="w-3 h-3" />
                                  No Outlets
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                                voucher.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {voucher.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleEditVoucher(voucher)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => toggleVoucherStatus(voucher.id, voucher.is_active)}
                                  className={`p-2 rounded-lg transition-colors ${
                                    voucher.is_active
                                      ? 'text-gray-600 hover:bg-gray-100'
                                      : 'text-green-600 hover:bg-green-50'
                                  }`}
                                  title={voucher.is_active ? 'Deactivate' : 'Activate'}
                                >
                                  <Power className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => deleteVoucher(voucher.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandedVoucher === voucher.id && (voucher.application_scope === 'product_level' || voucher.eligible_product_ids?.length > 0 || voucher.eligible_category_ids?.length > 0) && (
                            <tr className="bg-gray-50">
                              <td colSpan={9} className="px-6 py-4">
                                <div className="space-y-3">
                                  {voucher.application_scope === 'product_level' && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Tag className="w-4 h-4 text-blue-600" />
                                        <span className="text-sm font-bold text-blue-900">
                                          Product-Level Voucher: Maximum {voucher.max_products_per_use || 6} products per use
                                        </span>
                                      </div>
                                      <div className="ml-6 text-xs text-blue-800">
                                        <span className="font-bold">Application Method:</span>{' '}
                                        {voucher.product_application_method === 'per_product' ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-200 text-blue-900 rounded font-bold">
                                            Per Product (RM{voucher.value} × {voucher.max_products_per_use || 6} = RM{(voucher.value * (voucher.max_products_per_use || 6)).toFixed(2)} max)
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-200 text-blue-900 rounded font-bold">
                                            Overall Total Once (RM{voucher.value} off total)
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {voucher.eligible_product_ids?.length > 0 && (
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <ShoppingBag className="w-4 h-4 text-purple-600" />
                                        <span className="text-sm font-bold text-gray-900">Eligible Products ({voucher.eligible_product_ids.length})</span>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {voucher.eligible_product_ids.map((productId: string) => {
                                          const product = productsMap[productId];
                                          return (
                                            <span
                                              key={productId}
                                              className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold"
                                            >
                                              {product ? product.name : productId}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  {voucher.eligible_category_ids?.length > 0 && (
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <Package className="w-4 h-4 text-orange-600" />
                                        <span className="text-sm font-bold text-gray-900">Eligible Categories ({voucher.eligible_category_ids.length})</span>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {voucher.eligible_category_ids.map((categoryId: string) => {
                                          const category = categoriesMap[categoryId];
                                          return (
                                            <span
                                              key={categoryId}
                                              className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold"
                                            >
                                              {category ? category.name : categoryId}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div>
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-gray-900">Homepage Sliders</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {banners.length}/{MAX_SLIDERS} sliders created
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (banners.length >= MAX_SLIDERS) {
                      toast.warning(`Maximum of ${MAX_SLIDERS} sliders allowed`);
                      return;
                    }
                    setEditingBanner(null);
                    setSliderFormData({ title: '', description: '', image_url: '', link_url: '#', is_active: true });
                    setShowSliderModal(true);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all shadow-lg ${
                    banners.length >= MAX_SLIDERS
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:scale-105'
                  }`}
                  disabled={banners.length >= MAX_SLIDERS}
                >
                  <Plus className="w-5 h-5" />
                  Add Slider
                </button>
              </div>

              {banners.length >= MAX_SLIDERS && (
                <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    Maximum slider limit reached. Delete existing sliders to add new ones.
                  </p>
                </div>
              )}

              <div className="p-6">
                {banners.length === 0 ? (
                  <div className="text-center py-12">
                    <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium mb-2">No sliders created yet</p>
                    <p className="text-sm text-gray-500 mb-6">Create promotional sliders for the homepage</p>
                    <button
                      onClick={() => {
                        setEditingBanner(null);
                        setSliderFormData({ title: '', description: '', image_url: '', link_url: '#', is_active: true });
                        setShowSliderModal(true);
                      }}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      Create First Slider
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {banners.map((banner, index) => (
                      <div
                        key={banner.id}
                        className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow flex items-center gap-4"
                      >
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleReorderSlider(banner, 'up')}
                            disabled={index === 0}
                            className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <MoveUp className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleReorderSlider(banner, 'down')}
                            disabled={index === banners.length - 1}
                            className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <MoveDown className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>

                        <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                          {banner.image_url ? (
                            <img
                              src={banner.image_url}
                              alt={banner.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-400 to-red-500">
                              <Image className="w-8 h-8 text-white" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 truncate">{banner.title}</h3>
                          <p className="text-sm text-gray-600 line-clamp-2">{banner.description}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                              banner.is_active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {banner.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <span className="text-xs text-gray-500">Order: {banner.display_order}</span>
                            {banner.link_url && banner.link_url !== '#' && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-semibold">
                                <LinkIcon className="w-3 h-3" />
                                Has Link
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleSliderActive(banner)}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                            title={banner.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {banner.is_active ? (
                              <Eye className="w-5 h-5 text-green-600" />
                            ) : (
                              <EyeOff className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                          <button
                            onClick={() => handleEditSlider(banner)}
                            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-5 h-5 text-blue-600" />
                          </button>
                          <button
                            onClick={() => handleDeleteSlider(banner.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5 text-red-600" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-pink-50 to-orange-50 rounded-2xl border-2 border-pink-200 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm">
              <Megaphone className="w-6 h-6 text-pink-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-pink-900 mb-2">Marketing Tools</h3>
              <ul className="space-y-2 text-sm text-pink-800">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-pink-600"></div>
                  Create discount codes and promotional vouchers
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-pink-600"></div>
                  Manage homepage promotional sliders with custom links
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-pink-600"></div>
                  Track campaign performance and ROI
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-pink-600"></div>
                  Target specific customer segments
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <CreateVoucherModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadMarketingData}
      />

      {selectedVoucher && (
        <EditVoucherModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedVoucher(null);
          }}
          onSuccess={loadMarketingData}
          voucher={selectedVoucher}
        />
      )}

      {showSliderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-3xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-gray-900">
                {editingBanner ? 'Edit Slider' : 'Add New Slider'}
              </h2>
              <button
                onClick={() => {
                  setShowSliderModal(false);
                  setEditingBanner(null);
                }}
                className="p-2 hover:bg-gray-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Slider Image (Square recommended)
                </label>
                <div className="space-y-3">
                  {sliderFormData.image_url && (
                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-200">
                      <img
                        src={sliderFormData.image_url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-colors">
                    <Upload className="w-5 h-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">
                      {uploading ? 'Uploading...' : 'Upload Image'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-500">
                    Recommended: Square image (1:1 ratio), JPG or PNG
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={sliderFormData.title}
                  onChange={(e) => setSliderFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter slider title"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={sliderFormData.description}
                  onChange={(e) => setSliderFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter slider description"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Click Link URL
                </label>
                <input
                  type="text"
                  value={sliderFormData.link_url}
                  onChange={(e) => setSliderFormData(prev => ({ ...prev, link_url: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter link (default: #)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use '#' for no action, or enter a URL for clickable sliders
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active_slider"
                  checked={sliderFormData.is_active}
                  onChange={(e) => setSliderFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <label htmlFor="is_active_slider" className="text-sm font-medium text-gray-700">
                  Active (show on homepage)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSliderSubmit}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors"
                >
                  <Save className="w-5 h-5" />
                  {editingBanner ? 'Update Slider' : 'Create Slider'}
                </button>
                <button
                  onClick={() => {
                    setShowSliderModal(false);
                    setEditingBanner(null);
                  }}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </CMSLayout>
  );
};

export default CMSMarketing;
