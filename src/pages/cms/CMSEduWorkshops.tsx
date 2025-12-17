import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { useToast } from '../../contexts/ToastContext';
import CMSLayout from '../../components/cms/CMSLayout';
import {
  GraduationCap, Plus, Search, Edit2, Trash2, Eye, EyeOff,
  AlertCircle, Check, X, Tag, Calendar, ArrowUpCircle, ArrowDownCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { EduWorkshop } from '../../types/database';
import ImageUploadWithCrop from '../../components/cms/ImageUploadWithCrop';
import { formatDateTimeCMS } from '../../utils/dateFormatter';

interface Stats {
  totalWorkshops: number;
  activeWorkshops: number;
  inactiveWorkshops: number;
  forAll: number;
  forMembers: number;
  forSchools: number;
}

const CMSEduWorkshops: React.FC = () => {
  const navigate = useNavigate();
  const { admin, loading: adminLoading } = useAdminAuth();
  const { staff, loading: staffLoading } = useStaffAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [workshops, setWorkshops] = useState<EduWorkshop[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalWorkshops: 0,
    activeWorkshops: 0,
    inactiveWorkshops: 0,
    forAll: 0,
    forMembers: 0,
    forSchools: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<EduWorkshop | null>(null);
  const [showInactiveSection, setShowInactiveSection] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    overview: '',
    description: '',
    learning_points: [] as string[],
    event_type: 'For All' as 'For All' | 'For Members' | 'For Schools',
    event_price: '',
    special_price: '',
    has_special_price: false,
    age_group: '',
    estimated_time: '',
    image_url: '',
    workshop_images: [] as string[],
    schedule_info: '',
    availability: 'Available Now',
    is_active: true,
    display_order: '0',
    linked_product_id: ''
  });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingWorkshop, setDeletingWorkshop] = useState<EduWorkshop | null>(null);
  const [workshopImages, setWorkshopImages] = useState<string[]>([]);
  const [coverImageIndex, setCoverImageIndex] = useState<number>(0);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [productSearchTerm, setProductSearchTerm] = useState<string>('');

  const authLoading = adminLoading || staffLoading;
  const currentUser = admin || staff;
  const isStaff = !admin && !!staff;

  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate('/cms/login');
      return;
    }

    if (isStaff && staff?.role === 'manager') {
      const permissions = (staff as any).assigned_permissions || {};
      if (!permissions.eduworkshops && !permissions.marketing) {
        navigate('/cms/unauthorized');
        return;
      }
    }

    if (currentUser) {
      loadWorkshops();
      loadProducts();
      loadCategories();
    }
  }, [admin, staff, authLoading, navigate]);

  const loadWorkshops = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('edu_workshops')
        .select('*')
        .order('is_active', { ascending: false })
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setWorkshops(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Error loading workshops:', error);
      setError('Failed to load workshops');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('shop_products')
        .select('id, name, base_price, is_active, category_id')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error loading products:', error);
        toast.error('Failed to load products: ' + error.message);
        return;
      }
      setProducts(data || []);
    } catch (error: any) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, category_id')
        .order('sort_order');

      if (error) {
        console.error('Error loading categories:', error);
        return;
      }
      setCategories(data || []);
    } catch (error: any) {
      console.error('Error loading categories:', error);
    }
  };

  const calculateStats = (workshopData: EduWorkshop[]) => {
    setStats({
      totalWorkshops: workshopData.length,
      activeWorkshops: workshopData.filter(w => w.is_active).length,
      inactiveWorkshops: workshopData.filter(w => !w.is_active).length,
      forAll: workshopData.filter(w => w.event_type === 'For All').length,
      forMembers: workshopData.filter(w => w.event_type === 'For Members').length,
      forSchools: workshopData.filter(w => w.event_type === 'For Schools').length
    });
  };

  const activeWorkshops = workshops.filter(w => {
    if (!w.is_active) return false;
    const matchesSearch = w.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEventType = eventTypeFilter === 'all' || w.event_type === eventTypeFilter;
    return matchesSearch && matchesEventType;
  });

  const inactiveWorkshops = workshops.filter(w => {
    if (w.is_active) return false;
    const matchesSearch = w.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEventType = eventTypeFilter === 'all' || w.event_type === eventTypeFilter;
    return matchesSearch && matchesEventType;
  });

  const handleOpenModal = (workshop?: EduWorkshop) => {
    if (workshop) {
      setEditingWorkshop(workshop);
      const allImages = workshop.workshop_images || [];
      const coverImage = workshop.image_url || '';
      const coverIndex = coverImage && allImages.includes(coverImage) ? allImages.indexOf(coverImage) : 0;

      setFormData({
        title: workshop.title,
        overview: workshop.overview || '',
        description: workshop.description || '',
        learning_points: workshop.learning_points || [],
        event_type: workshop.event_type,
        event_price: workshop.event_price.toString(),
        special_price: workshop.special_price?.toString() || '',
        has_special_price: workshop.has_special_price || false,
        age_group: workshop.age_group,
        estimated_time: workshop.estimated_time.toString(),
        image_url: workshop.image_url || '',
        workshop_images: workshop.workshop_images || [],
        schedule_info: workshop.schedule_info || '',
        availability: workshop.availability,
        is_active: workshop.is_active,
        display_order: workshop.display_order.toString(),
        linked_product_id: workshop.linked_product_id || ''
      });
      setWorkshopImages(allImages);
      setCoverImageIndex(coverIndex);
    } else {
      setEditingWorkshop(null);
      const maxOrder = workshops.length > 0 ? Math.max(...workshops.map(w => w.display_order)) : 0;
      setFormData({
        title: '',
        overview: '',
        description: '',
        learning_points: [],
        event_type: 'For All',
        event_price: '',
        special_price: '',
        has_special_price: false,
        age_group: '',
        estimated_time: '',
        image_url: '',
        workshop_images: [],
        schedule_info: '',
        availability: 'Available Now',
        is_active: true,
        display_order: (maxOrder + 1).toString(),
        linked_product_id: ''
      });
      setWorkshopImages([]);
      setCoverImageIndex(0);
    }
    setError('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingWorkshop(null);
    setError('');
    setSelectedCategoryId('');
    setProductSearchTerm('');
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setProductSearchTerm('');
    if (!categoryId) {
      setFormData({ ...formData, linked_product_id: '' });
    }
  };

  const handleSave = async () => {
    try {
      setError('');
      setIsSaving(true);

      if (!formData.title || !formData.event_price || !formData.age_group || !formData.estimated_time) {
        setError('Please fill in all required fields');
        toast.error('Please fill in all required fields');
        setIsSaving(false);
        return;
      }

      const price = parseFloat(formData.event_price);
      const specialPrice = formData.special_price ? parseFloat(formData.special_price) : null;
      const time = parseInt(formData.estimated_time);
      const order = parseInt(formData.display_order);

      if (isNaN(price) || price < 0) {
        setError('Please enter a valid normal price');
        toast.error('Please enter a valid normal price');
        setIsSaving(false);
        return;
      }

      if (specialPrice !== null && (isNaN(specialPrice) || specialPrice < 0)) {
        setError('Please enter a valid special price');
        toast.error('Please enter a valid special price');
        setIsSaving(false);
        return;
      }

      if (specialPrice !== null && specialPrice >= price) {
        setError('Special price must be less than normal price');
        toast.error('Special price must be less than normal price');
        setIsSaving(false);
        return;
      }

      if (isNaN(time) || time <= 0) {
        setError('Please enter a valid estimated time');
        toast.error('Please enter a valid estimated time');
        setIsSaving(false);
        return;
      }

      const workshopData = {
        title: formData.title,
        overview: formData.overview || null,
        description: formData.description,
        learning_points: formData.learning_points,
        event_type: formData.event_type,
        event_price: price,
        special_price: specialPrice,
        has_special_price: formData.has_special_price && specialPrice !== null,
        age_group: formData.age_group,
        estimated_time: time,
        image_url: workshopImages[coverImageIndex] || '',
        workshop_images: workshopImages,
        schedule_info: formData.schedule_info,
        availability: formData.availability,
        is_active: formData.is_active,
        display_order: order,
        linked_product_id: formData.linked_product_id || null,
        updated_at: new Date().toISOString()
      };

      if (editingWorkshop) {
        const { error } = await supabase
          .from('edu_workshops')
          .update(workshopData)
          .eq('id', editingWorkshop.id);

        if (error) throw error;
        toast.success('Workshop updated successfully!');
      } else {
        const { error } = await supabase
          .from('edu_workshops')
          .insert([workshopData]);

        if (error) throw error;
        toast.success('Workshop created successfully!');
      }

      handleCloseModal();
      await loadWorkshops();
    } catch (error: any) {
      console.error('Error saving workshop:', error);
      setError(error.message || 'Failed to save workshop');
      toast.error(error.message || 'Failed to save workshop');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingWorkshop) return;

    try {
      const { error } = await supabase
        .from('edu_workshops')
        .delete()
        .eq('id', deletingWorkshop.id);

      if (error) throw error;

      toast.success('Workshop deleted successfully!');
      setShowDeleteConfirm(false);
      setDeletingWorkshop(null);
      loadWorkshops();
    } catch (error: any) {
      console.error('Error deleting workshop:', error);
      setError(error.message || 'Failed to delete workshop');
      toast.error(error.message || 'Failed to delete workshop');
    }
  };

  const handleToggleActive = async (workshop: EduWorkshop, makeActive: boolean) => {
    try {
      const { error } = await supabase
        .from('edu_workshops')
        .update({ is_active: makeActive })
        .eq('id', workshop.id);

      if (error) throw error;
      toast.success(`Workshop ${makeActive ? 'activated' : 'deactivated'} successfully!`);
      loadWorkshops();
    } catch (error: any) {
      console.error('Error toggling workshop status:', error);
      setError(error.message || 'Failed to update workshop status');
    }
  };

  const handleImageUpload = (url: string) => {
    if (workshopImages.length < 5) {
      setWorkshopImages([...workshopImages, url]);
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = workshopImages.filter((_, i) => i !== index);
    setWorkshopImages(newImages);
    if (coverImageIndex === index) {
      setCoverImageIndex(0);
    } else if (coverImageIndex > index) {
      setCoverImageIndex(coverImageIndex - 1);
    }
  };

  const handleSetCover = (index: number) => {
    setCoverImageIndex(index);
  };

  const formatTimestamp = (dateString: string) => {
    return formatDateTimeCMS(dateString);
  };

  if (authLoading || loading) {
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-blue-600" />
              EduStars Workshops
            </h1>
            <p className="text-gray-600 mt-1">Manage educational workshops and activities</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            <Plus className="w-5 h-5" />
            Add Workshop
          </button>
        </div>

        {/* Success/Error Messages */}
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
            <button onClick={() => setError('')} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalWorkshops}</p>
              </div>
              <GraduationCap className="w-10 h-10 text-gray-400 opacity-50" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.activeWorkshops}</p>
              </div>
              <Eye className="w-10 h-10 text-green-600 opacity-50" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Inactive</p>
                <p className="text-2xl font-bold text-gray-600 mt-1">{stats.inactiveWorkshops}</p>
              </div>
              <EyeOff className="w-10 h-10 text-gray-600 opacity-50" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">For All</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{stats.forAll}</p>
              </div>
              <Tag className="w-10 h-10 text-blue-600 opacity-50" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Members</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">{stats.forMembers}</p>
              </div>
              <Tag className="w-10 h-10 text-purple-600 opacity-50" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Schools</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{stats.forSchools}</p>
              </div>
              <Tag className="w-10 h-10 text-orange-600 opacity-50" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search workshops..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="For All">For All</option>
              <option value="For Members">For Members</option>
              <option value="For Schools">For Schools</option>
            </select>
          </div>
        </div>

        {/* Active Workshops Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 bg-green-50">
            <h2 className="text-lg font-bold text-green-900 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Active Workshops ({activeWorkshops.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Workshop</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Normal Price</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Special Price</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase text-center">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeWorkshops.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <GraduationCap className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                      <p>No active workshops found</p>
                    </td>
                  </tr>
                ) : (
                  activeWorkshops.map((workshop) => (
                    <tr key={workshop.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {workshop.image_url ? (
                            <img src={workshop.image_url} alt={workshop.title} className="w-12 h-12 rounded-lg object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                              <GraduationCap className="w-6 h-6 text-blue-600" />
                            </div>
                          )}
                          <div className="max-w-xs">
                            <p className="font-semibold text-gray-900">{workshop.title}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          workshop.event_type === 'For All' ? 'bg-blue-100 text-blue-700' :
                          workshop.event_type === 'For Members' ? 'bg-purple-100 text-purple-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {workshop.event_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`font-bold ${workshop.has_special_price ? 'text-gray-400 line-through' : 'text-green-600'}`}>
                          RM{workshop.event_price.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {workshop.has_special_price && workshop.special_price ? (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">SPECIAL</span>
                            <span className="font-bold text-green-600">RM{workshop.special_price.toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded">
                          #{workshop.display_order}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleOpenModal(workshop)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleToggleActive(workshop, false)} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors flex items-center gap-1" title="Deactivate">
                              <ArrowDownCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setDeletingWorkshop(workshop); setShowDeleteConfirm(true); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Added: {formatTimestamp(workshop.created_at)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inactive Workshops Section */}
        {inactiveWorkshops.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-300">
            <button onClick={() => setShowInactiveSection(!showInactiveSection)} className="w-full p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors">
              <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                <EyeOff className="w-5 h-5" />
                Inactive Workshops ({inactiveWorkshops.length})
              </h2>
              <span className="text-gray-500">{showInactiveSection ? '▼' : '▶'}</span>
            </button>
            {showInactiveSection && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Workshop</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Normal Price</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Special Price</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase text-center">Order</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {inactiveWorkshops.map((workshop) => (
                      <tr key={workshop.id} className="hover:bg-gray-50 opacity-60">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {workshop.image_url ? (
                              <img src={workshop.image_url} alt={workshop.title} className="w-12 h-12 rounded-lg object-cover grayscale" />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                                <GraduationCap className="w-6 h-6 text-gray-500" />
                              </div>
                            )}
                            <div className="max-w-xs">
                              <p className="font-semibold text-gray-700">{workshop.title}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-600">
                            {workshop.event_type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`font-bold ${workshop.has_special_price ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                            RM{workshop.event_price.toFixed(2)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {workshop.has_special_price && workshop.special_price ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs font-bold rounded">SPECIAL</span>
                              <span className="font-bold text-gray-600">RM{workshop.special_price.toFixed(2)}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded">
                            #{workshop.display_order}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleOpenModal(workshop)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Edit">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleToggleActive(workshop, true)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center gap-1" title="Activate">
                                <ArrowUpCircle className="w-4 h-4" />
                              </button>
                              <button onClick={() => { setDeletingWorkshop(workshop); setShowDeleteConfirm(true); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Added: {formatTimestamp(workshop.created_at)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Workshop Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="gradient-primary p-6 text-white" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <GraduationCap className="w-7 h-7" />
                  {editingWorkshop ? 'Edit Workshop' : 'Add New Workshop'}
                </h2>
                <button onClick={handleCloseModal} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-xl transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {error && (
                <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Workshop Title <span className="text-red-500">*</span></label>
                    <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g., Robotics Adventure" />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Overview (Short Summary)</label>
                    <textarea value={formData.overview} onChange={(e) => setFormData({ ...formData, overview: e.target.value })} rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Brief summary shown prominently in workshop detail..." />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Description (Full Details)</label>
                    <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Full workshop description..." />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Learning Points (What You'll Learn)</label>
                    <div className="space-y-2">
                      {formData.learning_points.map((point, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={point}
                            onChange={(e) => {
                              const newPoints = [...formData.learning_points];
                              newPoints[index] = e.target.value;
                              setFormData({ ...formData, learning_points: newPoints });
                            }}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder={`Learning point ${index + 1}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newPoints = formData.learning_points.filter((_, i) => i !== index);
                              setFormData({ ...formData, learning_points: newPoints });
                            }}
                            className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, learning_points: [...formData.learning_points, ''] })}
                        className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-5 h-5" />
                        Add Learning Point
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Event Type <span className="text-red-500">*</span></label>
                    <select value={formData.event_type} onChange={(e) => setFormData({ ...formData, event_type: e.target.value as any })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="For All">For All</option>
                      <option value="For Members">For Members</option>
                      <option value="For Schools">For Schools</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Normal Price (RM) <span className="text-red-500">*</span></label>
                      <input type="number" step="0.01" min="0" value={formData.event_price} onChange={(e) => setFormData({ ...formData, event_price: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        Special Price (RM)
                        <input type="checkbox" checked={formData.has_special_price} onChange={(e) => setFormData({ ...formData, has_special_price: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
                      </label>
                      <input type="number" step="0.01" min="0" value={formData.special_price} onChange={(e) => setFormData({ ...formData, special_price: e.target.value })} disabled={!formData.has_special_price} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500" placeholder="0.00" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Duration (mins) <span className="text-red-500">*</span></label>
                      <input type="number" min="1" value={formData.estimated_time} onChange={(e) => setFormData({ ...formData, estimated_time: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="60" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Age Group <span className="text-red-500">*</span></label>
                      <input type="text" value={formData.age_group} onChange={(e) => setFormData({ ...formData, age_group: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g., 7-12 years" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Availability</label>
                    <select value={formData.availability} onChange={(e) => setFormData({ ...formData, availability: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="Available Now">Available Now</option>
                      <option value="Coming Soon">Coming Soon</option>
                      <option value="Full">Full</option>
                      <option value="Seasonal">Seasonal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Schedule Information</label>
                    <textarea value={formData.schedule_info} onChange={(e) => setFormData({ ...formData, schedule_info: e.target.value })} rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g., Every Saturday, 2:00 PM - 4:00 PM" />
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-bold text-gray-700">Link to Product (Shop)</label>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">1. Select Category</label>
                        <select
                          value={selectedCategoryId}
                          onChange={(e) => handleCategoryChange(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="">All Categories</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.category_id} - {category.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">2. Search Product</label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={productSearchTerm}
                            onChange={(e) => setProductSearchTerm(e.target.value)}
                            placeholder="Search by name..."
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">3. Select Product</label>
                      <select
                        value={formData.linked_product_id}
                        onChange={(e) => setFormData({ ...formData, linked_product_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="">No product linked (manual cart)</option>
                        {products
                          .filter(product => {
                            const matchesCategory = !selectedCategoryId || product.category_id === selectedCategoryId;
                            const matchesSearch = !productSearchTerm ||
                              product.name.toLowerCase().includes(productSearchTerm.toLowerCase());
                            return matchesCategory && matchesSearch;
                          })
                          .map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} - RM{product.base_price.toFixed(2)}
                            </option>
                          ))}
                      </select>
                    </div>

                    <p className="text-xs text-gray-500">
                      Link this workshop to a shop product. When users click Reserve, the linked product will be added to their cart.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Display Order</label>
                      <input type="number" min="0" value={formData.display_order} onChange={(e) => setFormData({ ...formData, display_order: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="w-5 h-5 text-blue-600 rounded" />
                        <span className="text-sm font-bold text-gray-700">Active</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Workshop Images (Max 5)</label>
                    <div className="space-y-3">
                      {workshopImages.length < 5 && (
                        <ImageUploadWithCrop currentImageUrl="" onImageUploaded={handleImageUpload} bucket="product-images" />
                      )}
                      {workshopImages.length > 0 && (
                        <div className="grid grid-cols-3 gap-3">
                          {workshopImages.map((img, index) => (
                            <div key={index} className="relative group">
                              <img src={img} alt={`Image ${index + 1}`} className="w-full h-32 object-cover rounded-lg border-2 ${coverImageIndex === index ? 'border-blue-500' : 'border-gray-200'}" />
                              <button
                                onClick={() => handleRemoveImage(index)}
                                className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              {coverImageIndex === index ? (
                                <div className="absolute top-2 left-2 px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                                  COVER
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleSetCover(index)}
                                  className="absolute top-2 left-2 px-2 py-1 bg-gray-800 bg-opacity-70 text-white text-xs font-semibold rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  Set as Cover
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {workshopImages.length === 0 && (
                        <p className="text-sm text-gray-500 italic">Upload at least one image. Click on any image to set it as the cover.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <button onClick={handleCloseModal} disabled={isSaving} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-semibold disabled:opacity-50">Cancel</button>
              <button onClick={handleSave} disabled={isSaving} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <Check className="w-5 h-5" />
                {isSaving ? 'Saving...' : editingWorkshop ? 'Update Workshop' : 'Create Workshop'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Workshop</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete <strong>{deletingWorkshop?.title}</strong>?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeletingWorkshop(null); }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-semibold">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold">Delete</button>
            </div>
          </div>
        </div>
      )}
    </CMSLayout>
  );
};

export default CMSEduWorkshops;
