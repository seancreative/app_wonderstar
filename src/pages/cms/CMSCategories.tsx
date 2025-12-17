import React, { useState, useEffect } from 'react';
import CMSLayout from '../../components/cms/CMSLayout';
import {
  Tag,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Category, Subcategory } from '../../types/database';

interface CategoryWithCount extends Category {
  product_count?: number;
  subcategory_count?: number;
  subcategory_names?: string[];
}

interface SubcategoryWithCategory extends Subcategory {
  category?: Category;
}

const CMSCategories: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'categories' | 'subcategories'>('categories');
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [subcategories, setSubcategories] = useState<Record<string, Subcategory[]>>({});
  const [allSubcategories, setAllSubcategories] = useState<SubcategoryWithCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [subcategorySearchTerm, setSubcategorySearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [subcategoryStatusFilter, setSubcategoryStatusFilter] = useState('all');
  const [subcategoryCategoryFilter, setSubcategoryCategoryFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [selectedCategoryForSubcategory, setSelectedCategoryForSubcategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    is_active: true,
    sort_order: 0
  });
  const [subcategoryFormData, setSubcategoryFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    sort_order: 0
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingCategorySubcategories, setEditingCategorySubcategories] = useState<Subcategory[]>([]);

  useEffect(() => {
    loadCategories();
    loadAllSubcategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const categoriesData = data || [];

      const categoriesWithCounts = await Promise.all(
        categoriesData.map(async (category) => {
          const { count: productCount } = await supabase
            .from('shop_products')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', category.id);

          const { data: subcategoriesData } = await supabase
            .from('subcategories')
            .select('name')
            .eq('category_id', category.id)
            .order('sort_order', { ascending: true });

          const subcategoryNames = subcategoriesData?.map(sub => sub.name) || [];

          return {
            ...category,
            product_count: productCount || 0,
            subcategory_count: subcategoryNames.length,
            subcategory_names: subcategoryNames
          };
        })
      );

      setCategories(categoriesWithCounts);
    } catch (err) {
      console.error('Error loading categories:', err);
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const loadSubcategories = async (categoryId: string) => {
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .select('*')
        .eq('category_id', categoryId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setSubcategories(prev => ({
        ...prev,
        [categoryId]: data || []
      }));
    } catch (err) {
      console.error('Error loading subcategories:', err);
      setError('Failed to load subcategories');
    }
  };

  const loadAllSubcategories = async () => {
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .select(`
          *,
          category:categories(*)
        `)
        .order('subcategory_id', { ascending: true });

      if (error) throw error;

      setAllSubcategories(data || []);
    } catch (err) {
      console.error('Error loading all subcategories:', err);
      setError('Failed to load subcategories');
    }
  };

  const toggleCategoryExpanded = async (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
      if (!subcategories[categoryId]) {
        await loadSubcategories(categoryId);
      }
    }
    setExpandedCategories(newExpanded);
  };

  const filteredCategories = categories.filter(category => {
    const matchesSearch = searchTerm === '' ||
      category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.category_id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' ? category.is_active : !category.is_active);

    return matchesSearch && matchesStatus;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name) {
      setError('Please enter a category name');
      return;
    }

    try {
      const categoryData = {
        name: formData.name,
        description: formData.description || null,
        icon: formData.icon || null,
        is_active: formData.is_active,
        sort_order: formData.sort_order
      };

      if (editingCategory) {
        const { error: updateError } = await supabase
          .from('categories')
          .update(categoryData)
          .eq('id', editingCategory.id);

        if (updateError) throw updateError;
        setSuccess('Category updated successfully');
      } else {
        const { error: insertError } = await supabase
          .from('categories')
          .insert(categoryData);

        if (insertError) throw insertError;
        setSuccess('Category created successfully');
      }

      await loadCategories();
      closeModal();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error saving category:', err);
      if (err.message?.includes('duplicate') || err.code === '23505') {
        setError('A category with this name already exists');
      } else {
        setError('Failed to save category');
      }
    }
  };

  const toggleCategoryStatus = async (category: Category) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: !category.is_active })
        .eq('id', category.id);

      if (error) throw error;

      await loadCategories();
      setSuccess(`Category ${!category.is_active ? 'activated' : 'deactivated'} successfully`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error toggling category status:', err);
      setError('Failed to update category status');
      setTimeout(() => setError(''), 3000);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? Products using this category will have their category unset.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadCategories();
      setSuccess('Category deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting category:', err);
      setError('Failed to delete category');
    }
  };

  const moveCategoryUp = async (category: Category, index: number) => {
    if (index === 0) return;

    const prevCategory = filteredCategories[index - 1];
    const tempOrder = category.sort_order;

    try {
      await supabase
        .from('categories')
        .update({ sort_order: prevCategory.sort_order })
        .eq('id', category.id);

      await supabase
        .from('categories')
        .update({ sort_order: tempOrder })
        .eq('id', prevCategory.id);

      await loadCategories();
    } catch (err) {
      console.error('Error reordering categories:', err);
      setError('Failed to reorder categories');
    }
  };

  const moveCategoryDown = async (category: Category, index: number) => {
    if (index === filteredCategories.length - 1) return;

    const nextCategory = filteredCategories[index + 1];
    const tempOrder = category.sort_order;

    try {
      await supabase
        .from('categories')
        .update({ sort_order: nextCategory.sort_order })
        .eq('id', category.id);

      await supabase
        .from('categories')
        .update({ sort_order: tempOrder })
        .eq('id', nextCategory.id);

      await loadCategories();
    } catch (err) {
      console.error('Error reordering categories:', err);
      setError('Failed to reorder categories');
    }
  };

  const openEditModal = async (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      icon: category.icon || '',
      is_active: category.is_active,
      sort_order: category.sort_order
    });

    // Load subcategories for this category
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .select('*')
        .eq('category_id', category.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setEditingCategorySubcategories(data || []);
    } catch (err) {
      console.error('Error loading subcategories:', err);
      setEditingCategorySubcategories([]);
    }

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      icon: '',
      is_active: true,
      sort_order: categories.length
    });
    setEditingCategorySubcategories([]);
    setError('');
  };

  const openSubcategoryModal = (category: Category) => {
    setSelectedCategoryForSubcategory(category);
    setEditingSubcategory(null);
    setSubcategoryFormData({
      name: '',
      description: '',
      is_active: true,
      sort_order: 0
    });
    setShowSubcategoryModal(true);
  };

  const openEditSubcategoryModal = (subcategory: Subcategory, category: Category) => {
    setSelectedCategoryForSubcategory(category);
    setEditingSubcategory(subcategory);
    setSubcategoryFormData({
      name: subcategory.name,
      description: subcategory.description || '',
      is_active: subcategory.is_active,
      sort_order: subcategory.sort_order
    });
    setShowSubcategoryModal(true);
  };

  const closeSubcategoryModal = () => {
    setShowSubcategoryModal(false);
    setSelectedCategoryForSubcategory(null);
    setEditingSubcategory(null);
    setSubcategoryFormData({
      name: '',
      description: '',
      is_active: true,
      sort_order: 0
    });
    setError('');
  };

  const handleSubcategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!subcategoryFormData.name || !selectedCategoryForSubcategory) {
      setError('Please enter a subcategory name');
      return;
    }

    try {
      const subcategoryData = {
        category_id: selectedCategoryForSubcategory.id,
        name: subcategoryFormData.name,
        description: subcategoryFormData.description || null,
        is_active: subcategoryFormData.is_active,
        sort_order: subcategoryFormData.sort_order
      };

      if (editingSubcategory) {
        const { error: updateError } = await supabase
          .from('subcategories')
          .update(subcategoryData)
          .eq('id', editingSubcategory.id);

        if (updateError) throw updateError;
        setSuccess('Subcategory updated successfully');
      } else {
        const { error: insertError } = await supabase
          .from('subcategories')
          .insert(subcategoryData);

        if (insertError) throw insertError;
        setSuccess('Subcategory created successfully');
      }

      await loadCategories();
      await loadSubcategories(selectedCategoryForSubcategory.id);
      await loadAllSubcategories();
      closeSubcategoryModal();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error saving subcategory:', err);
      if (err.message?.includes('duplicate') || err.code === '23505') {
        setError('A subcategory with this name already exists in this category');
      } else {
        setError('Failed to save subcategory');
      }
    }
  };

  const toggleSubcategoryStatus = async (subcategory: Subcategory) => {
    try {
      const { error } = await supabase
        .from('subcategories')
        .update({ is_active: !subcategory.is_active })
        .eq('id', subcategory.id);

      if (error) throw error;

      await loadSubcategories(subcategory.category_id);
      await loadAllSubcategories();
      setSuccess(`Subcategory ${!subcategory.is_active ? 'activated' : 'deactivated'} successfully`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error toggling subcategory status:', err);
      setError('Failed to update subcategory status');
      setTimeout(() => setError(''), 3000);
    }
  };

  const deleteSubcategory = async (subcategory: Subcategory) => {
    if (!confirm('Are you sure you want to delete this subcategory? Products using this subcategory will have their subcategory unset.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('subcategories')
        .delete()
        .eq('id', subcategory.id);

      if (error) throw error;
      await loadCategories();
      await loadSubcategories(subcategory.category_id);
      await loadAllSubcategories();
      setSuccess('Subcategory deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting subcategory:', err);
      setError('Failed to delete subcategory');
    }
  };

  const updateSubcategorySortOrder = async (subcategoryId: string, newSortOrder: number) => {
    try {
      const { error } = await supabase
        .from('subcategories')
        .update({ sort_order: newSortOrder, updated_at: new Date().toISOString() })
        .eq('id', subcategoryId);

      if (error) throw error;

      // Update local state
      setEditingCategorySubcategories(prev =>
        prev.map(sub =>
          sub.id === subcategoryId ? { ...sub, sort_order: newSortOrder } : sub
        ).sort((a, b) => a.sort_order - b.sort_order)
      );

      // Reload categories to update subcategory names order
      await loadCategories();
    } catch (err) {
      console.error('Error updating subcategory sort order:', err);
      setError('Failed to update sort order');
    }
  };

  const stats = {
    total: categories.length,
    active: categories.filter(c => c.is_active).length,
    inactive: categories.filter(c => !c.is_active).length
  };

  const subcategoryStats = {
    total: allSubcategories.length,
    active: allSubcategories.filter(s => s.is_active).length,
    inactive: allSubcategories.filter(s => !s.is_active).length
  };

  const filteredSubcategories = allSubcategories.filter(subcategory => {
    const matchesSearch = subcategorySearchTerm === '' ||
      subcategory.name.toLowerCase().includes(subcategorySearchTerm.toLowerCase()) ||
      subcategory.subcategory_id.toLowerCase().includes(subcategorySearchTerm.toLowerCase()) ||
      subcategory.category?.name.toLowerCase().includes(subcategorySearchTerm.toLowerCase());

    const matchesStatus = subcategoryStatusFilter === 'all' ||
      (subcategoryStatusFilter === 'active' ? subcategory.is_active : !subcategory.is_active);

    const matchesCategory = subcategoryCategoryFilter === 'all' ||
      subcategory.category_id === subcategoryCategoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
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
            <h1 className="text-3xl font-black text-gray-900 mb-2">Categories Management</h1>
            <p className="text-gray-600 font-medium">Manage product categories and subcategories</p>
          </div>
          <button
            onClick={() => {
              if (activeTab === 'categories') {
                setShowModal(true);
              } else {
                setShowSubcategoryModal(true);
                setSelectedCategoryForSubcategory(categories[0] || null);
              }
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:scale-105 transition-transform shadow-lg"
          >
            <Plus className="w-5 h-5" />
            {activeTab === 'categories' ? 'Add Category' : 'Add Subcategory'}
          </button>
        </div>

        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-6 py-3 font-bold text-sm transition-colors relative ${
              activeTab === 'categories'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Categories
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">
              {stats.total}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('subcategories')}
            className={`px-6 py-3 font-bold text-sm transition-colors relative ${
              activeTab === 'subcategories'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Subcategories
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">
              {subcategoryStats.total}
            </span>
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

        {activeTab === 'categories' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-600 mb-1">Total Categories</p>
                  <p className="text-3xl font-black text-gray-900">{stats.total}</p>
                </div>
                <Tag className="w-12 h-12 text-gray-300" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-green-700 mb-1">Active</p>
                  <p className="text-3xl font-black text-green-900">{stats.active}</p>
                </div>
                <Eye className="w-12 h-12 text-green-500" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-1">Inactive</p>
                  <p className="text-3xl font-black text-gray-900">{stats.inactive}</p>
                </div>
                <EyeOff className="w-12 h-12 text-gray-500" />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-600 mb-1">Total Subcategories</p>
                  <p className="text-3xl font-black text-gray-900">{subcategoryStats.total}</p>
                </div>
                <Tag className="w-12 h-12 text-purple-300" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-green-700 mb-1">Active</p>
                  <p className="text-3xl font-black text-green-900">{subcategoryStats.active}</p>
                </div>
                <Eye className="w-12 h-12 text-green-500" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-1">Inactive</p>
                  <p className="text-3xl font-black text-gray-900">{subcategoryStats.inactive}</p>
                </div>
                <EyeOff className="w-12 h-12 text-gray-500" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'categories' ? (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[300px] relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search categories by name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-bold"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-2 py-4 text-sm font-bold text-gray-900 w-8"></th>
                <th className="text-left px-4 py-4 text-sm font-bold text-gray-900 w-20">Order</th>
                <th className="text-left px-4 py-4 text-sm font-bold text-gray-900">Category ID</th>
                <th className="text-left px-4 py-4 text-sm font-bold text-gray-900">Name</th>
                <th className="text-left px-4 py-4 text-sm font-bold text-gray-900">Description</th>
                <th className="text-left px-4 py-4 text-sm font-bold text-gray-900">Status</th>
                <th className="text-center px-4 py-4 text-sm font-bold text-gray-900">Subs</th>
                <th className="text-center px-4 py-4 text-sm font-bold text-gray-900">Products</th>
                <th className="text-center px-4 py-4 text-sm font-bold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">No categories found</p>
                  </td>
                </tr>
              ) : (
                filteredCategories.map((category, index) => (
                  <React.Fragment key={category.id}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-2 py-4">
                        <button
                          onClick={() => toggleCategoryExpanded(category.id)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                          title={expandedCategories.has(category.id) ? 'Collapse' : 'Expand'}
                        >
                          {expandedCategories.has(category.id) ? (
                            <ChevronDown className="w-4 h-4 text-gray-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-600" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveCategoryUp(category, index)}
                            disabled={index === 0}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                              index === 0 ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                            title="Move up"
                          >
                            <ArrowUp className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => moveCategoryDown(category, index)}
                            disabled={index === filteredCategories.length - 1}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                              index === filteredCategories.length - 1 ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                            title="Move down"
                          >
                            <ArrowDown className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm font-mono font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                          {category.category_id}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {category.icon && (
                            <span className="text-2xl">{category.icon}</span>
                          )}
                          <p className="font-bold text-gray-900">{category.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-gray-600">{category.description || '-'}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                          category.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {category.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-700">
                          {category.subcategory_names && category.subcategory_names.length > 0 ? (
                            <span className="text-purple-700 font-medium">
                              {category.subcategory_names.join(', ')}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">No subcategories</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                            (category.product_count || 0) > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {category.product_count || 0}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openSubcategoryModal(category)}
                            className="p-2 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Add subcategory"
                          >
                            <Plus className="w-4 h-4 text-purple-600" />
                          </button>
                          <button
                            onClick={() => openEditModal(category)}
                            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit category"
                          >
                            <Edit2 className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => toggleCategoryStatus(category)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title={category.is_active ? 'Deactivate category' : 'Activate category'}
                          >
                            {category.is_active ? (
                              <EyeOff className="w-4 h-4 text-gray-600" />
                            ) : (
                              <Eye className="w-4 h-4 text-green-600" />
                            )}
                          </button>
                          <button
                            onClick={() => deleteCategory(category.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete category"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedCategories.has(category.id) && (
                      <tr>
                        <td colSpan={9} className="bg-gray-50 px-8 py-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-bold text-gray-700">Subcategories for {category.name}</h4>
                              <button
                                onClick={() => openSubcategoryModal(category)}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white text-sm rounded-lg font-bold hover:bg-purple-600 transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                                Add Subcategory
                              </button>
                            </div>

                            {!subcategories[category.id] || subcategories[category.id].length === 0 ? (
                              <p className="text-sm text-gray-500 italic py-4">No subcategories yet. Click "Add Subcategory" to create one.</p>
                            ) : (
                              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                <table className="w-full">
                                  <thead>
                                    <tr className="bg-gray-100 border-b border-gray-200">
                                      <th className="text-left px-4 py-2 text-xs font-bold text-gray-700">Subcategory ID</th>
                                      <th className="text-left px-4 py-2 text-xs font-bold text-gray-700">Name</th>
                                      <th className="text-left px-4 py-2 text-xs font-bold text-gray-700">Description</th>
                                      <th className="text-center px-4 py-2 text-xs font-bold text-gray-700">Status</th>
                                      <th className="text-center px-4 py-2 text-xs font-bold text-gray-700">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {subcategories[category.id].map((subcategory) => (
                                      <tr key={subcategory.id} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                          <span className="text-xs font-mono font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">
                                            {subcategory.subcategory_id}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3">
                                          <p className="text-sm font-semibold text-gray-900">{subcategory.name}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                          <p className="text-xs text-gray-600">{subcategory.description || '-'}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="flex items-center justify-center">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                                              subcategory.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                              {subcategory.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="flex items-center justify-center gap-1">
                                            <button
                                              onClick={() => openEditSubcategoryModal(subcategory, category)}
                                              className="p-1.5 hover:bg-purple-50 rounded transition-colors"
                                              title="Edit subcategory"
                                            >
                                              <Edit2 className="w-3.5 h-3.5 text-purple-600" />
                                            </button>
                                            <button
                                              onClick={() => toggleSubcategoryStatus(subcategory)}
                                              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                                              title={subcategory.is_active ? 'Deactivate' : 'Activate'}
                                            >
                                              {subcategory.is_active ? (
                                                <EyeOff className="w-3.5 h-3.5 text-gray-600" />
                                              ) : (
                                                <Eye className="w-3.5 h-3.5 text-green-600" />
                                              )}
                                            </button>
                                            <button
                                              onClick={() => deleteSubcategory(subcategory)}
                                              className="p-1.5 hover:bg-red-50 rounded transition-colors"
                                              title="Delete subcategory"
                                            >
                                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
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
          </>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[300px] relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search subcategories by name, ID, or category..."
                    value={subcategorySearchTerm}
                    onChange={(e) => setSubcategorySearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none font-medium"
                  />
                </div>

                <select
                  value={subcategoryCategoryFilter}
                  onChange={(e) => setSubcategoryCategoryFilter(e.target.value)}
                  className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none font-bold"
                >
                  <option value="all">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.category_id})
                    </option>
                  ))}
                </select>

                <select
                  value={subcategoryStatusFilter}
                  onChange={(e) => setSubcategoryStatusFilter(e.target.value)}
                  className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none font-bold"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Subcategory ID</th>
                    <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Name</th>
                    <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Parent Category</th>
                    <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Description</th>
                    <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Status</th>
                    <th className="text-center px-6 py-4 text-sm font-bold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubcategories.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <Tag className="w-16 h-16 text-purple-300 mx-auto mb-4" />
                        <p className="text-gray-600 font-medium">No subcategories found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredSubcategories.map((subcategory) => (
                      <tr key={subcategory.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <span className="text-sm font-mono font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
                            {subcategory.subcategory_id}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-900">{subcategory.name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-900">{subcategory.category?.name || 'N/A'}</span>
                            <span className="text-xs font-mono text-gray-500">{subcategory.category?.category_id}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600">{subcategory.description || '-'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                            subcategory.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {subcategory.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditSubcategoryModal(subcategory, subcategory.category!)}
                              className="p-2 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Edit subcategory"
                            >
                              <Edit2 className="w-4 h-4 text-purple-600" />
                            </button>
                            <button
                              onClick={() => toggleSubcategoryStatus(subcategory)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                              title={subcategory.is_active ? 'Deactivate subcategory' : 'Activate subcategory'}
                            >
                              {subcategory.is_active ? (
                                <EyeOff className="w-4 h-4 text-gray-600" />
                              ) : (
                                <Eye className="w-4 h-4 text-green-600" />
                              )}
                            </button>
                            <button
                              onClick={() => deleteSubcategory(subcategory)}
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete subcategory"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-gray-900">
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {editingCategory && (
                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                  <p className="text-sm font-bold text-blue-900 mb-1">Category ID</p>
                  <p className="text-2xl font-mono font-black text-blue-600">{editingCategory.category_id}</p>
                  <p className="text-xs text-blue-700 mt-1">Auto-generated and cannot be changed</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Category Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                  placeholder="e.g., Food & Beverages"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Icon</label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                    placeholder="Enter emoji (e.g., 🎫 🎨 🍔 🎁)"
                    maxLength={10}
                  />
                  {formData.icon && (
                    <div className="w-16 h-16 flex items-center justify-center text-3xl bg-gray-100 rounded-xl border-2 border-gray-300">
                      {formData.icon}
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">Copy and paste an emoji to use as the category icon</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium resize-none"
                  rows={3}
                  placeholder="Optional description for this category"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Sort Order</label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                  min="0"
                />
                <p className="mt-1 text-xs text-gray-500">Lower numbers appear first in lists</p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-bold text-gray-700">
                  Category is active and visible in product forms
                </label>
              </div>

              {editingCategory && editingCategorySubcategories.length > 0 && (
                <div className="border-2 border-purple-200 rounded-xl p-4 bg-purple-50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-black text-purple-900">Subcategories ({editingCategorySubcategories.length})</h3>
                    <p className="text-xs text-purple-700">Adjust sort order to change display order</p>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {editingCategorySubcategories.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-purple-200">
                        <div className="flex-shrink-0">
                          <span className="text-xs font-mono font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded">
                            {sub.subcategory_id}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{sub.name}</p>
                          {sub.description && (
                            <p className="text-xs text-gray-600 truncate">{sub.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-gray-600 whitespace-nowrap">Sort:</label>
                          <input
                            type="number"
                            value={sub.sort_order}
                            onChange={(e) => updateSubcategorySortOrder(sub.id, parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 text-sm border-2 border-gray-300 rounded focus:border-purple-500 focus:outline-none font-medium"
                            min="0"
                          />
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          sub.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {sub.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-800 font-semibold">{error}</p>
                </div>
              )}

              {!editingCategory && (
                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                  <p className="text-sm font-bold text-blue-900 mb-1">Auto-Generated ID</p>
                  <p className="text-xs text-blue-700">
                    A unique Category ID (e.g., C001, C002) will be automatically generated when you create this category
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:scale-105 transition-transform shadow-lg"
                >
                  {editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSubcategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-gray-900">
                {editingSubcategory ? 'Edit Subcategory' : 'Add New Subcategory'}
              </h2>
              <button onClick={closeSubcategoryModal} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {selectedCategoryForSubcategory ? (
              <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-xl mb-4">
                <p className="text-sm font-bold text-purple-900 mb-1">Parent Category</p>
                <p className="text-lg font-black text-purple-600">
                  {selectedCategoryForSubcategory.category_id} - {selectedCategoryForSubcategory.name}
                </p>
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">Parent Category *</label>
                <select
                  value={selectedCategoryForSubcategory?.id || ''}
                  onChange={(e) => {
                    const category = categories.find(c => c.id === e.target.value);
                    setSelectedCategoryForSubcategory(category || null);
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none font-medium"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.category_id} - {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <form onSubmit={handleSubcategorySubmit} className="space-y-4">
              {editingSubcategory && (
                <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-xl">
                  <p className="text-sm font-bold text-purple-900 mb-1">Subcategory ID</p>
                  <p className="text-2xl font-mono font-black text-purple-600">{editingSubcategory.subcategory_id}</p>
                  <p className="text-xs text-purple-700 mt-1">Auto-generated and cannot be changed</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Subcategory Name *</label>
                <input
                  type="text"
                  value={subcategoryFormData.name}
                  onChange={(e) => setSubcategoryFormData({ ...subcategoryFormData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none font-medium"
                  placeholder="e.g., Hot Beverages"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                <textarea
                  value={subcategoryFormData.description}
                  onChange={(e) => setSubcategoryFormData({ ...subcategoryFormData, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none font-medium resize-none"
                  rows={3}
                  placeholder="Optional description for this subcategory"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Sort Order</label>
                <input
                  type="number"
                  value={subcategoryFormData.sort_order}
                  onChange={(e) => setSubcategoryFormData({ ...subcategoryFormData, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none font-medium"
                  min="0"
                />
                <p className="mt-1 text-xs text-gray-500">Lower numbers appear first in lists</p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="subcategory_is_active"
                  checked={subcategoryFormData.is_active}
                  onChange={(e) => setSubcategoryFormData({ ...subcategoryFormData, is_active: e.target.checked })}
                  className="w-5 h-5 text-purple-600 border-2 border-gray-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="subcategory_is_active" className="text-sm font-bold text-gray-700">
                  Subcategory is active and visible in product forms
                </label>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-800 font-semibold">{error}</p>
                </div>
              )}

              {!editingSubcategory && (
                <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-xl">
                  <p className="text-sm font-bold text-purple-900 mb-1">Auto-Generated ID</p>
                  <p className="text-xs text-purple-700">
                    A unique Subcategory ID (e.g., {selectedCategoryForSubcategory.category_id}a, {selectedCategoryForSubcategory.category_id}b) will be automatically generated
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeSubcategoryModal}
                  className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-bold hover:scale-105 transition-transform shadow-lg"
                >
                  {editingSubcategory ? 'Update Subcategory' : 'Create Subcategory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </CMSLayout>
  );
};

export default CMSCategories;
