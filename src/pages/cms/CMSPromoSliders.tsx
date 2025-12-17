import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Image, Plus, Edit2, Trash2, Eye, EyeOff, Save, X, Upload, MoveUp, MoveDown } from 'lucide-react';
import CMSLayout from '../../components/cms/CMSLayout';
import { useToast } from '../../contexts/ToastContext';

interface PromoBanner {
  id: string;
  image_url: string;
  title: string;
  description: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CMSPromoSliders: React.FC = () => {
  const toast = useToast();
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<PromoBanner | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    is_active: true
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('promo_banners')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setBanners(data || []);
    } catch (error) {
      console.error('Error loading banners:', error);
      toast.error('Failed to load banners');
    } finally {
      setLoading(false);
    }
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

      setFormData(prev => ({ ...prev, image_url: publicUrl }));
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.warning('Please fill in all required fields');
      return;
    }

    try {
      if (editingBanner) {
        const { error } = await supabase
          .from('promo_banners')
          .update({
            title: formData.title,
            description: formData.description,
            image_url: formData.image_url,
            is_active: formData.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingBanner.id);

        if (error) throw error;
      } else {
        const maxOrder = banners.length > 0
          ? Math.max(...banners.map(b => b.display_order))
          : 0;

        const { error } = await supabase
          .from('promo_banners')
          .insert({
            title: formData.title,
            description: formData.description,
            image_url: formData.image_url,
            is_active: formData.is_active,
            display_order: maxOrder + 1
          });

        if (error) throw error;
      }

      setShowModal(false);
      setEditingBanner(null);
      setFormData({ title: '', description: '', image_url: '', is_active: true });
      loadBanners();
    } catch (error) {
      console.error('Error saving banner:', error);
      toast.error('Failed to save banner');
    }
  };

  const handleEdit = (banner: PromoBanner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      description: banner.description,
      image_url: banner.image_url,
      is_active: banner.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this banner?')) return;

    try {
      const { error } = await supabase
        .from('promo_banners')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadBanners();
    } catch (error) {
      console.error('Error deleting banner:', error);
      toast.error('Failed to delete banner');
    }
  };

  const handleToggleActive = async (banner: PromoBanner) => {
    try {
      const { error } = await supabase
        .from('promo_banners')
        .update({ is_active: !banner.is_active })
        .eq('id', banner.id);

      if (error) throw error;
      loadBanners();
    } catch (error) {
      console.error('Error toggling banner:', error);
      toast.error('Failed to update banner');
    }
  };

  const handleReorder = async (banner: PromoBanner, direction: 'up' | 'down') => {
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

      loadBanners();
    } catch (error) {
      console.error('Error reordering banners:', error);
      toast.error('Failed to reorder banners');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <CMSLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Promo Sliders</h1>
            <p className="text-gray-600 mt-1">Manage homepage promotional banners</p>
          </div>
          <button
            onClick={() => {
              setEditingBanner(null);
              setFormData({ title: '', description: '', image_url: '', is_active: true });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Banner
          </button>
        </div>

      <div className="grid gap-4">
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className="glass p-4 rounded-xl shadow-lg flex items-center gap-4"
          >
            <div className="flex flex-col gap-1">
              <button
                onClick={() => handleReorder(banner, 'up')}
                disabled={index === 0}
                className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <MoveUp className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={() => handleReorder(banner, 'down')}
                disabled={index === banners.length - 1}
                className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
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
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                  banner.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {banner.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-xs text-gray-500">Order: {banner.display_order}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleActive(banner)}
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
                onClick={() => handleEdit(banner)}
                className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Edit2 className="w-5 h-5 text-blue-600" />
              </button>
              <button
                onClick={() => handleDelete(banner.id)}
                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-5 h-5 text-red-600" />
              </button>
            </div>
          </div>
        ))}

        {banners.length === 0 && (
          <div className="text-center py-12 glass rounded-xl">
            <Image className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">No promo banners yet</p>
            <p className="text-sm text-gray-500 mt-1">Click "Add Banner" to create your first promotional banner</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass p-6 rounded-3xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-gray-900">
                {editingBanner ? 'Edit Banner' : 'Add New Banner'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
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
                  Banner Image (Square recommended)
                </label>
                <div className="space-y-3">
                  {formData.image_url && (
                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-200">
                      <img
                        src={formData.image_url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors">
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
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter banner title"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter banner description"
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Active (show on homepage)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSubmit}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors"
                >
                  <Save className="w-5 h-5" />
                  {editingBanner ? 'Update Banner' : 'Create Banner'}
                </button>
                <button
                  onClick={() => {
                    setShowModal(false);
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
      </div>
    </CMSLayout>
  );
};

export default CMSPromoSliders;
