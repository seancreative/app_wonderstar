import React, { useState, useEffect } from 'react';
import CMSLayout from '../../components/cms/CMSLayout';
import { Briefcase, Calendar, Users, Plus, Edit2, Trash2, TrendingUp, AlertCircle, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDateTimeCMS } from '../../utils/dateFormatter';
import ImageUploadWithCrop from '../../components/cms/ImageUploadWithCrop';

interface Workshop {
  id: string;
  title: string;
  description: string;
  category: string;
  date: string;
  duration: number;
  capacity: number;
  enrolled: number;
  price: number;
  image_url?: string;
  workshop_images?: string[];
  created_at: string;
}

const CMSWorkshops: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    date: '',
    duration: '',
    capacity: '',
    price: '',
    image_url: ''
  });
  const [workshopImages, setWorkshopImages] = useState<string[]>([]);
  const [coverImageIndex, setCoverImageIndex] = useState<number>(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadWorkshops();
  }, []);

  const loadWorkshops = async () => {
    try {
      const { data, error } = await supabase
        .from('workshops')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;
      setWorkshops(data || []);
    } catch (error) {
      console.error('Error loading workshops:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWorkshop = () => {
    setFormData({
      title: '',
      description: '',
      category: 'STEM',
      date: '',
      duration: '60',
      capacity: '20',
      price: '0',
      image_url: ''
    });
    setWorkshopImages([]);
    setCoverImageIndex(0);
    setEditingWorkshop(null);
    setShowAddModal(true);
    setError('');
    setSuccess('');
  };

  const handleEditWorkshop = (workshop: Workshop) => {
    const allImages = workshop.workshop_images || [];
    const coverImage = workshop.image_url || '';
    const coverIndex = coverImage && allImages.includes(coverImage) ? allImages.indexOf(coverImage) : 0;

    setFormData({
      title: workshop.title,
      description: workshop.description,
      category: workshop.category,
      date: workshop.date,
      duration: workshop.duration.toString(),
      capacity: workshop.capacity.toString(),
      price: workshop.price.toString(),
      image_url: workshop.image_url || ''
    });
    setWorkshopImages(allImages);
    setCoverImageIndex(coverIndex);
    setEditingWorkshop(workshop);
    setShowAddModal(true);
    setError('');
    setSuccess('');
  };

  const handleSaveWorkshop = async () => {
    try {
      setError('');
      setSuccess('');

      if (!formData.title || !formData.description || !formData.category || !formData.date) {
        setError('Please fill in all required fields');
        return;
      }

      const workshopData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        date: formData.date,
        duration: parseInt(formData.duration) || 60,
        capacity: parseInt(formData.capacity) || 20,
        price: parseFloat(formData.price) || 0,
        image_url: workshopImages[coverImageIndex] || null,
        workshop_images: workshopImages,
        enrolled: 0
      };

      if (editingWorkshop) {
        const { error } = await supabase
          .from('workshops')
          .update(workshopData)
          .eq('id', editingWorkshop.id);

        if (error) throw error;
        setSuccess('Workshop updated successfully!');
      } else {
        const { error } = await supabase
          .from('workshops')
          .insert([workshopData]);

        if (error) throw error;
        setSuccess('Workshop created successfully!');
      }

      setShowAddModal(false);
      loadWorkshops();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to save workshop');
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

  const handleDeleteWorkshop = async (workshopId: string) => {
    if (!confirm('Are you sure you want to delete this workshop?')) return;

    try {
      const { error } = await supabase
        .from('workshops')
        .delete()
        .eq('id', workshopId);

      if (error) throw error;

      setSuccess('Workshop deleted successfully!');
      loadWorkshops();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to delete workshop');
    }
  };

  const totalEnrollments = workshops.reduce((sum, w) => sum + (w.enrolled || 0), 0);
  const upcomingWorkshops = workshops.filter(w => new Date(w.date) > new Date()).length;

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
            <h1 className="text-3xl font-black text-gray-900 mb-2">Workshops Management</h1>
            <p className="text-gray-600 font-medium">Create and manage educational workshops</p>
          </div>
          <button
            onClick={handleAddWorkshop}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:scale-105 transition-transform shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Add Workshop
          </button>
        </div>

        {success && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800 font-semibold">{success}</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-800 font-semibold">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border-2 border-blue-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Briefcase className="w-6 h-6 text-blue-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm font-bold text-blue-700 mb-1">Total Workshops</p>
            <p className="text-3xl font-black text-blue-900">{workshops.length}</p>
            <p className="text-xs text-blue-700 mt-2">All time created</p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl border-2 border-green-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-green-700 mb-1">Upcoming</p>
            <p className="text-3xl font-black text-green-900">{upcomingWorkshops}</p>
            <p className="text-xs text-green-700 mt-2">Future workshops</p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl border-2 border-orange-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-orange-700 mb-1">Total Enrollments</p>
            <p className="text-3xl font-black text-orange-900">{totalEnrollments}</p>
            <p className="text-xs text-orange-700 mt-2">All workshops</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl border-2 border-yellow-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <TrendingUp className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-yellow-700 mb-1">Avg. Capacity</p>
            <p className="text-3xl font-black text-yellow-900">
              {workshops.length > 0 ? Math.round(workshops.reduce((sum, w) => sum + (w.capacity || 0), 0) / workshops.length) : 0}
            </p>
            <p className="text-xs text-yellow-700 mt-2">Per workshop</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-black text-gray-900">Workshops List</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Title</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Category</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Date</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Duration</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Capacity</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Enrolled</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Price</th>
                  <th className="text-right px-6 py-4 text-sm font-bold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workshops.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 font-medium">No workshops yet</p>
                      <p className="text-sm text-gray-500 mt-1">Click "Add Workshop" to create a new workshop</p>
                    </td>
                  </tr>
                ) : (
                  workshops.map((workshop) => (
                    <tr key={workshop.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900">{workshop.title}</p>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{workshop.description}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                          {workshop.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-900">
                          {formatDateTimeCMS(workshop.date)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">
                        {workshop.duration} min
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">
                        {workshop.capacity}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{workshop.enrolled || 0}</span>
                          <span className="text-xs text-gray-500">
                            ({Math.round(((workshop.enrolled || 0) / workshop.capacity) * 100)}%)
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">
                        RM {workshop.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditWorkshop(workshop)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteWorkshop(workshop.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add/Edit Workshop Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-black text-gray-900 mb-6">
                {editingWorkshop ? 'Edit Workshop' : 'Add New Workshop'}
              </h2>

              {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-xl mb-4">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-800 font-semibold">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Workshop Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-medium focus:border-blue-500 focus:outline-none"
                    placeholder="e.g., Introduction to Robotics"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-medium focus:border-blue-500 focus:outline-none"
                    rows={3}
                    placeholder="Describe what participants will learn..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-medium focus:border-blue-500 focus:outline-none"
                  >
                    <option value="STEM">STEM</option>
                    <option value="Arts & Crafts">Arts & Crafts</option>
                    <option value="Cooking">Cooking</option>
                    <option value="Sports">Sports</option>
                    <option value="Music">Music</option>
                    <option value="Language">Language</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-medium focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-medium focus:border-blue-500 focus:outline-none"
                    placeholder="60"
                    min="15"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Capacity
                  </label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-medium focus:border-blue-500 focus:outline-none"
                    placeholder="20"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Price (RM)
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-medium focus:border-blue-500 focus:outline-none"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Workshop Images (Max 5)
                  </label>
                  <div className="space-y-3">
                    {workshopImages.length < 5 && (
                      <ImageUploadWithCrop currentImageUrl="" onImageUploaded={handleImageUpload} bucket="product-images" />
                    )}
                    {workshopImages.length > 0 && (
                      <div className="grid grid-cols-3 gap-3">
                        {workshopImages.map((img, index) => (
                          <div key={index} className="relative group">
                            <img src={img} alt={`Image ${index + 1}`} className={`w-full h-32 object-cover rounded-lg border-2 ${coverImageIndex === index ? 'border-blue-500' : 'border-gray-200'}`} />
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

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveWorkshop}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:scale-105 transition-transform"
                >
                  {editingWorkshop ? 'Update Workshop' : 'Create Workshop'}
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CMSLayout>
  );
};

export default CMSWorkshops;
