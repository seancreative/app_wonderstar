import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CMSLayout from '../../components/cms/CMSLayout';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
  X,
  DollarSign,
  Grid3x3,
  List,
  Upload,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  CheckSquare,
  Star,
  Tag,
  Settings
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ShopProduct, Outlet, Category, Subcategory, ModifierGroup, ModifierOption } from '../../types/database';
import ImageUploadWithCrop from '../../components/cms/ImageUploadWithCrop';
import ModifierSelector from '../../components/cms/ModifierSelector';

interface ProductWithRelations extends ShopProduct {
  outlets?: Outlet;
  categories?: Category;
  product_outlets?: Array<{ outlet_id: string; is_available: boolean }>;
}

type SortColumn = 'name' | 'category' | 'base_price' | 'stock' | 'is_active' | 'product_id';
type SortDirection = 'asc' | 'desc';

const CMSProducts: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductWithRelations[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [outletFilter, setOutletFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [recommendedFilter, setRecommendedFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithRelations | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    base_price: '',
    weekend_price: '',
    stock: '999',
    outlet_assignment: 'all',
    selected_outlets: [] as string[],
    is_active: true,
    image_url: '',
    subcategory_id: '',
    bonus_stars: '0',
    special_discount: false,
    is_recommended: false,
    recommended_sort_order: '0'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showMassActionConfirm, setShowMassActionConfirm] = useState(false);
  const [massAction, setMassAction] = useState<'activate' | 'deactivate' | 'delete' | null>(null);
  const [assignedModifiers, setAssignedModifiers] = useState<Array<ModifierGroup & { is_required: boolean; sort_order: number; options?: ModifierOption[]; product_modifier_id?: string }>>([]);

  useEffect(() => {
    loadData();
  }, []);

  const getOutletDisplay = (product: ProductWithRelations): string => {
    const productOutletCount = product.product_outlets?.length || 0;
    const totalOutlets = outlets.length;

    if (productOutletCount === totalOutlets && totalOutlets > 0) {
      return 'All Outlets';
    } else if (productOutletCount === 1) {
      return product.outlets?.name || 'Unknown Outlet';
    } else if (productOutletCount > 1) {
      return `${productOutletCount} Outlets`;
    }
    return product.outlets?.name || 'No Outlet';
  };

  const loadData = async () => {
    try {
      const [productsResult, outletsResult, categoriesResult, subcategoriesResult] = await Promise.all([
        supabase
          .from('shop_products')
          .select(`
            *,
            outlets(id, name, location),
            categories(id, category_id, name),
            product_outlets(outlet_id, is_available)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('outlets')
          .select('*')
          .in('status', ['active', 'open'])
          .order('name'),
        supabase
          .from('categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('subcategories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order')
      ]);

      if (productsResult.error) throw productsResult.error;
      if (outletsResult.error) throw outletsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      if (subcategoriesResult.error) throw subcategoriesResult.error;

      const loadedOutlets = outletsResult.data || [];
      const loadedCategories = categoriesResult.data || [];
      const loadedSubcategories = subcategoriesResult.data || [];

      console.log('Loaded outlets:', loadedOutlets.length, loadedOutlets.map(o => ({ name: o.name, status: o.status })));
      console.log('Loaded categories:', loadedCategories.length);
      console.log('Loaded subcategories:', loadedSubcategories.length);

      setProducts(productsResult.data || []);
      setOutlets(loadedOutlets);
      setCategories(loadedCategories);
      setSubcategories(loadedSubcategories);

      if (loadedOutlets.length === 0) {
        setError('No outlets found. Please create outlets first in the Outlets management section.');
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load products data. Please check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-4 h-4 text-blue-600" />
    ) : (
      <ArrowDown className="w-4 h-4 text-blue-600" />
    );
  };

  const filteredProducts = products
    .filter(product => {
      const matchesSearch = searchTerm === '' ||
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.product_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.categories?.name || product.category || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = categoryFilter === 'all' || product.category_id === categoryFilter;

      const matchesOutlet = outletFilter === 'all' ||
        (product.product_outlets && product.product_outlets.some(po => po.outlet_id === outletFilter));

      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' ? product.is_active : !product.is_active);

      const matchesRecommended = recommendedFilter === 'all' ||
        (recommendedFilter === 'recommended' ? product.is_recommended : !product.is_recommended);

      return matchesSearch && matchesCategory && matchesOutlet && matchesStatus && matchesRecommended;
    })
    .sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'category':
          aValue = (a.categories?.name || a.category || '').toLowerCase();
          bValue = (b.categories?.name || b.category || '').toLowerCase();
          break;
        case 'base_price':
          aValue = a.base_price || 0;
          bValue = b.base_price || 0;
          break;
        case 'stock':
          aValue = a.stock || 0;
          bValue = b.stock || 0;
          break;
        case 'is_active':
          aValue = a.is_active ? 1 : 0;
          bValue = b.is_active ? 1 : 0;
          break;
        case 'product_id':
          aValue = a.product_id || '';
          bValue = b.product_id || '';
          break;
        default:
          aValue = a.created_at;
          bValue = b.created_at;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name || !formData.category_id || !formData.base_price) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.outlet_assignment === 'specific' && formData.selected_outlets.length === 0) {
      setError('Please select at least one outlet');
      return;
    }

    try {
      const selectedCategory = categories.find(c => c.id === formData.category_id);

      const productData = {
        name: formData.name,
        description: formData.description || null,
        category: selectedCategory?.name || 'Uncategorized',
        category_id: formData.category_id,
        base_price: parseFloat(formData.base_price),
        weekend_price: formData.weekend_price ? parseFloat(formData.weekend_price) : null,
        stock: parseInt(formData.stock) || 0,
        outlet_id: formData.outlet_assignment === 'all' ? outlets[0]?.id : formData.selected_outlets[0],
        is_active: formData.is_active,
        image_url: formData.image_url || null,
        subcategory_id: formData.subcategory_id || null,
        bonus_stars: parseInt(formData.bonus_stars) || 0,
        special_discount: formData.special_discount,
        is_recommended: formData.is_recommended,
        recommended_sort_order: formData.is_recommended ? parseInt(formData.recommended_sort_order) || 0 : 0
      };

      if (editingProduct) {
        const { error: updateError } = await supabase
          .from('shop_products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (updateError) throw updateError;

        await supabase
          .from('product_outlets')
          .delete()
          .eq('product_id', editingProduct.id);

        const outletIds = formData.outlet_assignment === 'all'
          ? outlets.map(o => o.id)
          : formData.selected_outlets;

        const productOutletData = outletIds.map(outletId => ({
          product_id: editingProduct.id,
          outlet_id: outletId,
          is_available: true
        }));

        await supabase.from('product_outlets').insert(productOutletData);

        await supabase
          .from('product_modifiers')
          .delete()
          .eq('product_id', editingProduct.id);

        if (assignedModifiers.length > 0) {
          console.log('[MODIFIER SAVE] Saving', assignedModifiers.length, 'modifiers');
          for (const mod of assignedModifiers) {
            console.log('[MODIFIER SAVE] Processing modifier:', mod.name, 'with', mod.options?.length || 0, 'options');
            let groupId = mod.id;

            const { data: existingGroup } = await supabase
              .from('modifier_groups')
              .select('id')
              .eq('id', mod.id)
              .maybeSingle();

            if (!existingGroup) {
              console.log('[MODIFIER SAVE] Creating new group:', mod.name);
              const { data: newGroup, error: groupError } = await supabase
                .from('modifier_groups')
                .insert({
                  name: mod.name,
                  description: mod.description,
                  modifier_type: mod.modifier_type,
                  enable_quantity_selector: mod.modifier_type === 'multiple_choice' ? (mod.enable_quantity_selector || false) : false,
                  min_selections: mod.modifier_type === 'multiple_choice' ? (mod.min_selections || 0) : 0,
                  max_selections: mod.modifier_type === 'multiple_choice' ? (mod.max_selections || null) : null,
                  is_template: false
                })
                .select()
                .single();

              if (groupError) {
                console.error('[MODIFIER SAVE] Error creating group:', groupError);
                throw groupError;
              }
              groupId = newGroup.id;
              console.log('[MODIFIER SAVE] New group created with ID:', groupId);

              if (mod.options && mod.options.length > 0) {
                const optionsData = mod.options.map((opt, idx) => ({
                  modifier_group_id: groupId,
                  option_name: opt.option_name,
                  addon_price: opt.addon_price,
                  is_available: true,
                  sort_order: idx
                }));

                console.log('[MODIFIER SAVE] Inserting', optionsData.length, 'options for new group:', optionsData);
                const { error: optionsError } = await supabase.from('modifier_options').insert(optionsData);
                if (optionsError) {
                  console.error('[MODIFIER SAVE] Error inserting options:', optionsError);
                  throw optionsError;
                }
                console.log('[MODIFIER SAVE] Options inserted successfully');
              } else {
                console.warn('[MODIFIER SAVE] No options to save for group:', mod.name);
              }
            } else {
              console.log('[MODIFIER SAVE] Updating existing group:', mod.name);

              // Update the modifier group settings
              await supabase
                .from('modifier_groups')
                .update({
                  name: mod.name,
                  description: mod.description,
                  enable_quantity_selector: mod.modifier_type === 'multiple_choice' ? (mod.enable_quantity_selector || false) : false,
                  min_selections: mod.modifier_type === 'multiple_choice' ? (mod.min_selections || 0) : 0,
                  max_selections: mod.modifier_type === 'multiple_choice' ? (mod.max_selections || null) : null
                })
                .eq('id', groupId);

              await supabase
                .from('modifier_options')
                .delete()
                .eq('modifier_group_id', groupId);

              if (mod.options && mod.options.length > 0) {
                const optionsData = mod.options.map((opt, idx) => ({
                  modifier_group_id: groupId,
                  option_name: opt.option_name,
                  addon_price: opt.addon_price,
                  is_available: true,
                  sort_order: idx
                }));

                console.log('[MODIFIER SAVE] Inserting', optionsData.length, 'options for existing group:', optionsData);
                const { error: optionsError } = await supabase.from('modifier_options').insert(optionsData);
                if (optionsError) {
                  console.error('[MODIFIER SAVE] Error inserting options:', optionsError);
                  throw optionsError;
                }
                console.log('[MODIFIER SAVE] Options updated successfully');
              } else {
                console.warn('[MODIFIER SAVE] No options to save for group:', mod.name);
              }
            }

            await supabase.from('product_modifiers').insert({
              product_id: editingProduct.id,
              modifier_group_id: groupId,
              is_required: mod.is_required,
              sort_order: mod.sort_order
            });
          }
        }

        setSuccess('Product updated successfully');
      } else {
        const { data: newProduct, error: insertError } = await supabase
          .from('shop_products')
          .insert(productData)
          .select()
          .single();

        if (insertError) throw insertError;

        const outletIds = formData.outlet_assignment === 'all'
          ? outlets.map(o => o.id)
          : formData.selected_outlets;

        const productOutletData = outletIds.map(outletId => ({
          product_id: newProduct.id,
          outlet_id: outletId,
          is_available: true
        }));

        await supabase.from('product_outlets').insert(productOutletData);

        if (assignedModifiers.length > 0) {
          for (const mod of assignedModifiers) {
            const { data: newGroup, error: groupError } = await supabase
              .from('modifier_groups')
              .insert({
                name: mod.name,
                description: mod.description,
                modifier_type: mod.modifier_type,
                enable_quantity_selector: mod.modifier_type === 'multiple_choice' ? (mod.enable_quantity_selector || false) : false,
                min_selections: mod.modifier_type === 'multiple_choice' ? (mod.min_selections || 0) : 0,
                max_selections: mod.modifier_type === 'multiple_choice' ? (mod.max_selections || null) : null,
                is_template: false
              })
              .select()
              .single();

            if (groupError) throw groupError;

            if (mod.options && mod.options.length > 0) {
              const optionsData = mod.options.map((opt, idx) => ({
                modifier_group_id: newGroup.id,
                option_name: opt.option_name,
                addon_price: opt.addon_price,
                is_available: true,
                sort_order: idx
              }));

              await supabase.from('modifier_options').insert(optionsData);
            }

            await supabase.from('product_modifiers').insert({
              product_id: newProduct.id,
              modifier_group_id: newGroup.id,
              is_required: mod.is_required,
              sort_order: mod.sort_order
            });
          }
        }

        setSuccess('Product created successfully');
      }

      await loadData();
      closeModal();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving product:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorDetails = (err as any)?.details || (err as any)?.hint || '';
      setError(`Failed to save product: ${errorMessage}${errorDetails ? ' - ' + errorDetails : ''}`);
    }
  };

  const toggleProductStatus = async (product: ProductWithRelations) => {
    try {
      const { error: updateError } = await supabase
        .from('shop_products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id);

      if (updateError) throw updateError;

      await loadData();
      setSuccess(`Product ${!product.is_active ? 'activated' : 'deactivated'} successfully`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error toggling product status:', err);
      setError('Failed to update product status');
      setTimeout(() => setError(''), 3000);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('shop_products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadData();
      setSuccess('Product deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting product:', err);
      setError('Failed to delete product');
    }
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  const handleSelectProduct = (id: string) => {
    setSelectedProducts(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const handleMassAction = (action: 'activate' | 'deactivate' | 'delete') => {
    setMassAction(action);
    setShowMassActionConfirm(true);
  };

  const executeMassAction = async () => {
    if (!massAction || selectedProducts.length === 0) return;

    try {
      if (massAction === 'delete') {
        const { error } = await supabase
          .from('shop_products')
          .delete()
          .in('id', selectedProducts);

        if (error) throw error;
        setSuccess(`${selectedProducts.length} product(s) deleted successfully`);
      } else {
        const isActive = massAction === 'activate';
        const { error } = await supabase
          .from('shop_products')
          .update({ is_active: isActive })
          .in('id', selectedProducts);

        if (error) throw error;
        setSuccess(`${selectedProducts.length} product(s) ${isActive ? 'activated' : 'deactivated'} successfully`);
      }

      await loadData();
      setSelectedProducts([]);
      setShowMassActionConfirm(false);
      setMassAction(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error executing mass action:', err);
      setError(`Failed to ${massAction} products`);
      setShowMassActionConfirm(false);
      setMassAction(null);
    }
  };

  const openEditModal = async (product: ProductWithRelations) => {
    setEditingProduct(product);

    const { data: productOutlets } = await supabase
      .from('product_outlets')
      .select('outlet_id')
      .eq('product_id', product.id);

    const outletIds = productOutlets?.map(po => po.outlet_id) || [];
    const allOutlets = outlets.map(o => o.id);
    const isAllOutlets = outletIds.length === allOutlets.length;

    setFormData({
      name: product.name,
      description: product.description || '',
      category_id: product.category_id || '',
      base_price: product.base_price.toString(),
      weekend_price: product.weekend_price?.toString() || '',
      stock: product.stock.toString(),
      outlet_assignment: isAllOutlets ? 'all' : 'specific',
      selected_outlets: isAllOutlets ? [] : outletIds,
      is_active: product.is_active,
      image_url: product.image_url || '',
      subcategory_id: product.subcategory_id || '',
      bonus_stars: product.bonus_stars?.toString() || '0',
      special_discount: product.special_discount || false,
      is_recommended: product.is_recommended || false,
      recommended_sort_order: product.recommended_sort_order?.toString() || '0'
    });
    setImagePreview(product.image_url || '');

    const { data: productModifiers, error: modError } = await supabase
      .from('product_modifiers')
      .select('*, modifier_groups(*, modifier_options(*))')
      .eq('product_id', product.id)
      .order('sort_order');

    if (modError) {
      console.error('[MODIFIER LOAD] Error loading modifiers:', modError);
    }
    console.log('[MODIFIER LOAD] Raw product modifiers:', productModifiers);

    const modifiersWithOptions = (productModifiers || []).map((pm: any) => ({
      ...pm.modifier_groups,
      is_required: pm.is_required,
      sort_order: pm.sort_order,
      product_modifier_id: pm.id,
      options: pm.modifier_groups.modifier_options || []
    }));

    console.log('[MODIFIER LOAD] Processed modifiers with options:', modifiersWithOptions);
    setAssignedModifiers(modifiersWithOptions);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      category_id: '',
      base_price: '',
      weekend_price: '',
      stock: '999',
      outlet_assignment: 'all',
      selected_outlets: [],
      is_active: true,
      image_url: '',
      subcategory_id: '',
      bonus_stars: '0',
      special_discount: false,
      is_recommended: false,
      recommended_sort_order: '0'
    });
    setImagePreview('');
    setError('');
    setAssignedModifiers([]);
  };

  const handleOutletToggle = (outletId: string) => {
    setFormData(prev => ({
      ...prev,
      selected_outlets: prev.selected_outlets.includes(outletId)
        ? prev.selected_outlets.filter(id => id !== outletId)
        : [...prev.selected_outlets, outletId]
    }));
  };

  const stats = {
    total: filteredProducts.length,
    active: filteredProducts.filter(p => p.is_active).length,
    inactive: filteredProducts.filter(p => !p.is_active).length,
    lowStock: filteredProducts.filter(p => (p.stock || 0) < 10).length
  };

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
            <h1 className="text-3xl font-black text-gray-900 mb-2">Products Management</h1>
            <p className="text-gray-600 font-medium">Manage your product catalog</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:scale-105 transition-transform shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Add Product
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/cms/categories')}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-blue-200 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
          >
            <Tag className="w-4 h-4" />
            Categories
          </button>
          <button
            onClick={() => navigate('/cms/modifiers')}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-purple-200 text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Modifiers
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-600 mb-1">Total Products</p>
                <p className="text-3xl font-black text-gray-900">{stats.total}</p>
              </div>
              <Package className="w-12 h-12 text-gray-300" />
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

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border-2 border-orange-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-orange-700 mb-1">Low Stock</p>
                <p className="text-3xl font-black text-orange-900">{stats.lowStock}</p>
              </div>
              <AlertCircle className="w-12 h-12 text-orange-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[300px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products by name, ID, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-bold"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <select
              value={outletFilter}
              onChange={(e) => setOutletFilter(e.target.value)}
              className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-bold"
            >
              <option value="all">All Outlets</option>
              {outlets.map(outlet => (
                <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-bold"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <select
              value={recommendedFilter}
              onChange={(e) => setRecommendedFilter(e.target.value)}
              className="px-4 py-3 border-2 border-amber-300 rounded-xl focus:border-amber-500 focus:outline-none font-bold"
            >
              <option value="all">All Products</option>
              <option value="recommended">⭐ Recommended Only</option>
              <option value="not_recommended">Not Recommended</option>
            </select>

            <div className="flex items-center gap-2 border-2 border-gray-300 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <Grid3x3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {selectedProducts.length > 0 && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <p className="text-sm font-bold text-blue-900">
                {selectedProducts.length} product(s) selected
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleMassAction('activate')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Activate Selected
                </button>
                <button
                  onClick={() => handleMassAction('deactivate')}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <EyeOff className="w-4 h-4" />
                  Deactivate Selected
                </button>
                <button
                  onClick={() => handleMassAction('delete')}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Selected
                </button>
                <button
                  onClick={() => setSelectedProducts([])}
                  className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No products found</p>
              </div>
            ) : (
              filteredProducts.map((product) => (
                <div key={product.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-square bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-16 h-16 text-blue-300" />
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-gray-900 text-lg line-clamp-2">{product.name}</h3>
                            {product.is_recommended && (
                              <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-full text-[10px] font-bold">
                                <Star className="w-3 h-3" fill="currentColor" />
                                REC
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 font-mono">{product.product_id}</p>
                        </div>
                        {!product.is_active && (
                          <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 font-medium">{product.categories?.name || product.category}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <span className="text-xl font-black text-gray-900">RM {(product.base_price || 0).toFixed(2)}</span>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                        (product.stock || 0) < 10 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                      }`}>
                        Stock: {product.stock || 0}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 font-medium">{product.outlets?.name}</p>
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                      <button
                        onClick={() => openEditModal(product)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-600 rounded-lg font-bold hover:bg-blue-100 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => toggleProductStatus(product)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold transition-colors ${
                          product.is_active
                            ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            : 'bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                      >
                        {product.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {product.is_active ? 'Hide' : 'Show'}
                      </button>
                      <button
                        onClick={() => deleteProduct(product.id)}
                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-center px-4 py-4 w-12">
                    <input
                      type="checkbox"
                      checked={filteredProducts.length > 0 && selectedProducts.length === filteredProducts.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th
                    className="text-left px-6 py-4 text-sm font-bold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('product_id')}
                  >
                    <div className="flex items-center gap-2">
                      Product ID
                      {getSortIcon('product_id')}
                    </div>
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Image</th>
                  <th
                    className="text-left px-6 py-4 text-sm font-bold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      Product
                      {getSortIcon('name')}
                    </div>
                  </th>
                  <th
                    className="text-left px-6 py-4 text-sm font-bold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center gap-2">
                      Category
                      {getSortIcon('category')}
                    </div>
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Outlet</th>
                  <th
                    className="text-left px-6 py-4 text-sm font-bold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('base_price')}
                  >
                    <div className="flex items-center gap-2">
                      Price
                      {getSortIcon('base_price')}
                    </div>
                  </th>
                  <th
                    className="text-left px-6 py-4 text-sm font-bold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('stock')}
                  >
                    <div className="flex items-center gap-2">
                      Stock
                      {getSortIcon('stock')}
                    </div>
                  </th>
                  <th
                    className="text-left px-6 py-4 text-sm font-bold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('is_active')}
                  >
                    <div className="flex items-center gap-2">
                      Status
                      {getSortIcon('is_active')}
                    </div>
                  </th>
                  <th className="text-center px-6 py-4 text-sm font-bold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center">
                      <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 font-medium">No products found</p>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="text-center px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => handleSelectProduct(product.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono text-gray-900">{product.product_id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-6 h-6 text-blue-300" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-bold text-gray-900">{product.name}</p>
                            {product.description && (
                              <p className="text-sm text-gray-600 line-clamp-1">{product.description}</p>
                            )}
                          </div>
                          {product.is_recommended && (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-full text-[10px] font-bold whitespace-nowrap">
                              <Star className="w-3 h-3" fill="currentColor" />
                              REC
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-gray-900">{product.categories?.name || product.category}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-600">{getOutletDisplay(product)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-gray-900">RM {(product.base_price || 0).toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                          (product.stock || 0) < 10 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {product.stock || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                          product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(product)}
                            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit product"
                          >
                            <Edit2 className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => toggleProductStatus(product)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title={product.is_active ? 'Deactivate product' : 'Activate product'}
                          >
                            {product.is_active ? (
                              <EyeOff className="w-4 h-4 text-gray-600" />
                            ) : (
                              <Eye className="w-4 h-4 text-green-600" />
                            )}
                          </button>
                          <button
                            onClick={() => deleteProduct(product.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete product"
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
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-gray-900">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Product Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Category *</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name} ({cat.category_id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Outlet Assignment *</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border-2 border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="outlet_assignment"
                      value="all"
                      checked={formData.outlet_assignment === 'all'}
                      onChange={(e) => setFormData({ ...formData, outlet_assignment: e.target.value, selected_outlets: [] })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <p className="font-bold text-gray-900">All Outlets</p>
                      <p className="text-sm text-gray-600">Product will be available in all outlets</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border-2 border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="outlet_assignment"
                      value="specific"
                      checked={formData.outlet_assignment === 'specific'}
                      onChange={(e) => setFormData({ ...formData, outlet_assignment: e.target.value })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <p className="font-bold text-gray-900">Specific Outlets</p>
                      <p className="text-sm text-gray-600">Choose which outlets to assign</p>
                    </div>
                  </label>

                  {formData.outlet_assignment === 'specific' && (
                    <div className="space-y-2 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                      <p className="text-sm font-bold text-blue-900 mb-3">Select Outlets ({outlets.length} available):</p>
                      {outlets.length === 0 ? (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-800 font-medium">No outlets available. Please add outlets first in the Outlets management section.</p>
                        </div>
                      ) : (
                        outlets.map(outlet => (
                        <label key={outlet.id} className="flex items-center gap-3 p-2 hover:bg-blue-100 rounded-lg cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={formData.selected_outlets.includes(outlet.id)}
                            onChange={() => handleOutletToggle(outlet.id)}
                            className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="font-bold text-gray-900">{outlet.name}</span>
                        </label>
                      )))}
                      {formData.selected_outlets.length > 0 && (
                        <div className="mt-3 pt-3 border-t-2 border-blue-200">
                          <p className="text-sm font-bold text-blue-900">
                            Selected: {formData.selected_outlets.length} outlet{formData.selected_outlets.length > 1 ? 's' : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Weekday Price (RM) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.base_price}
                    onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Weekend Price (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.weekend_price}
                    onChange={(e) => setFormData({ ...formData, weekend_price: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                    placeholder="Leave empty if same as weekday"
                  />
                  <p className="mt-1 text-xs text-gray-500">Optional. Leave empty to use weekday price</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Stock</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Bonus Stars</label>
                  <input
                    type="number"
                    value={formData.bonus_stars}
                    onChange={(e) => setFormData({ ...formData, bonus_stars: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                    placeholder="0"
                  />
                  <p className="mt-1 text-xs text-gray-500">Extra stars earned with purchase</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Subcategory</label>
                <select
                  value={formData.subcategory_id}
                  onChange={(e) => setFormData({ ...formData, subcategory_id: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                  disabled={!formData.category_id}
                >
                  <option value="">None</option>
                  {subcategories
                    .filter(sub => sub.category_id === formData.category_id)
                    .map(sub => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} ({sub.subcategory_id})
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {formData.category_id
                    ? 'Select a subcategory for this product'
                    : 'Please select a category first'}
                </p>
              </div>

              <div className="border-t-4 border-blue-500 pt-6 mt-6">
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-black text-blue-900 flex items-center gap-2">
                        <List className="w-5 h-5" />
                        Product Customization Options
                      </h3>
                      <p className="text-sm text-blue-700 mt-1">
                        Add modifier groups to allow customers to customize this product (e.g., size, add-ons, toppings)
                      </p>
                    </div>
                    {assignedModifiers.length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-full">
                        <CheckSquare className="w-4 h-4" />
                        <span className="text-sm font-bold">{assignedModifiers.length} Active</span>
                      </div>
                    )}
                  </div>
                </div>

                <ModifierSelector
                  productId={editingProduct?.id}
                  assignedModifiers={assignedModifiers}
                  onChange={setAssignedModifiers}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Product Image</label>
                <ImageUploadWithCrop
                  onImageUploaded={(url) => {
                    setFormData({ ...formData, image_url: url });
                    setImagePreview(url);
                  }}
                  currentImageUrl={imagePreview}
                  bucket="product-images"
                  folder="products"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Images will be automatically cropped to square format (800x800px)
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="text-sm font-bold text-gray-700">
                    Product is active and visible to customers
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="special_discount"
                    checked={formData.special_discount}
                    onChange={(e) => setFormData({ ...formData, special_discount: e.target.checked })}
                    className="w-5 h-5 text-red-600 border-2 border-gray-300 rounded focus:ring-red-500"
                  />
                  <label htmlFor="special_discount" className="text-sm font-bold text-gray-700">
                    Special Discount - Can apply special discount voucher redemption
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_recommended"
                    checked={formData.is_recommended}
                    onChange={(e) => setFormData({ ...formData, is_recommended: e.target.checked })}
                    className="w-5 h-5 text-amber-600 border-2 border-gray-300 rounded focus:ring-amber-500"
                  />
                  <label htmlFor="is_recommended" className="text-sm font-bold text-gray-700">
                    Recommended - Pin this product to the top of its category
                  </label>
                </div>

                {formData.is_recommended && (
                  <div>
                    <label htmlFor="recommended_sort_order" className="block text-sm font-bold text-gray-700 mb-2">
                      Recommendation Sort Order
                    </label>
                    <input
                      type="number"
                      id="recommended_sort_order"
                      value={formData.recommended_sort_order}
                      onChange={(e) => setFormData({ ...formData, recommended_sort_order: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder="0"
                      min="0"
                    />
                    <p className="mt-1 text-xs text-gray-500">Lower numbers appear first (0 = highest priority)</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-800 font-semibold">{error}</p>
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
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMassActionConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                massAction === 'delete' ? 'bg-red-100' : 'bg-blue-100'
              }`}>
                {massAction === 'delete' ? (
                  <Trash2 className="w-6 h-6 text-red-600" />
                ) : massAction === 'activate' ? (
                  <Eye className="w-6 h-6 text-green-600" />
                ) : (
                  <EyeOff className="w-6 h-6 text-gray-600" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900">
                  {massAction === 'delete' ? 'Delete Products' :
                   massAction === 'activate' ? 'Activate Products' : 'Deactivate Products'}
                </h3>
                <p className="text-sm text-gray-600 font-medium">
                  {selectedProducts.length} product(s) selected
                </p>
              </div>
            </div>

            <p className="text-gray-700 font-medium mb-6">
              {massAction === 'delete' ? (
                <>
                  Are you sure you want to <span className="font-bold text-red-600">permanently delete</span> these {selectedProducts.length} product(s)? This action cannot be undone.
                </>
              ) : massAction === 'activate' ? (
                <>
                  Are you sure you want to <span className="font-bold text-green-600">activate</span> these {selectedProducts.length} product(s)? They will become visible to customers.
                </>
              ) : (
                <>
                  Are you sure you want to <span className="font-bold text-gray-600">deactivate</span> these {selectedProducts.length} product(s)? They will be hidden from customers.
                </>
              )}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowMassActionConfirm(false);
                  setMassAction(null);
                }}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeMassAction}
                className={`flex-1 py-3 rounded-xl font-bold transition-all shadow-lg ${
                  massAction === 'delete'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : massAction === 'activate'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                {massAction === 'delete' ? 'Yes, Delete' : massAction === 'activate' ? 'Yes, Activate' : 'Yes, Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </CMSLayout>
  );
};

export default CMSProducts;
