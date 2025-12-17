import React, { useState, useEffect } from 'react';
import CMSLayout from '../../components/cms/CMSLayout';
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  Check,
  X,
  AlertCircle,
  List,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Info,
  Hash
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ModifierGroup, ModifierOption } from '../../types/database';

interface ModifierGroupWithOptions extends ModifierGroup {
  options?: ModifierOption[];
  usage_count?: number;
}

const CMSModifiers: React.FC = () => {
  const [templates, setTemplates] = useState<ModifierGroupWithOptions[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ModifierGroupWithOptions | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    modifier_type: 'single_choice' | 'multiple_choice';
    enable_quantity_selector: boolean;
    min_selections: number;
    max_selections: number | null;
    options: Array<{
      id?: string;
      option_name: string;
      addon_price: string;
      is_default: boolean;
      sort_order: number;
    }>;
  }>({
    name: '',
    description: '',
    modifier_type: 'single_choice',
    enable_quantity_selector: false,
    min_selections: 0,
    max_selections: null,
    options: [{ option_name: '', addon_price: '0', is_default: false, sort_order: 0 }]
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadTemplates();
    syncOrphanedTemplates();
  }, []);

  const syncOrphanedTemplates = async () => {
    console.log('[TEMPLATE SYNC] Checking for orphaned modifier groups...');
    try {
      // Get all modifier groups that are templates
      const { data: templateGroups, error: groupsError } = await supabase
        .from('modifier_groups')
        .select('id, name, description')
        .eq('is_template', true);

      if (groupsError) throw groupsError;

      if (!templateGroups || templateGroups.length === 0) {
        console.log('[TEMPLATE SYNC] No template groups found');
        return;
      }

      console.log('[TEMPLATE SYNC] Found', templateGroups.length, 'template groups');

      // Check each group to see if it has a template entry
      for (const group of templateGroups) {
        const { data: existingLink } = await supabase
          .from('modifier_template_groups')
          .select('template_id')
          .eq('modifier_group_id', group.id)
          .maybeSingle();

        if (!existingLink) {
          console.log('[TEMPLATE SYNC] Orphaned group found:', group.name, '- creating template');

          // Create template entry
          const { data: newTemplate, error: templateError } = await supabase
            .from('modifier_templates')
            .insert({
              name: group.name,
              description: group.description || `Auto-synced: ${group.name}`
            })
            .select()
            .single();

          if (templateError) {
            console.error('[TEMPLATE SYNC] Error creating template for', group.name, ':', templateError);
            continue;
          }

          // Link it
          const { error: linkError } = await supabase
            .from('modifier_template_groups')
            .insert({
              template_id: newTemplate.id,
              modifier_group_id: group.id,
              is_required: false,
              sort_order: 0
            });

          if (linkError) {
            console.error('[TEMPLATE SYNC] Error linking template for', group.name, ':', linkError);
          } else {
            console.log('[TEMPLATE SYNC] Successfully synced:', group.name);
          }
        } else {
          console.log('[TEMPLATE SYNC] Group already linked:', group.name);
        }
      }

      console.log('[TEMPLATE SYNC] Sync complete');
    } catch (error) {
      console.error('[TEMPLATE SYNC] Error during sync:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const { data: groups, error: groupsError } = await supabase
        .from('modifier_groups')
        .select('*')
        .eq('is_template', true)
        .order('name');

      if (groupsError) throw groupsError;

      const groupsWithOptions = await Promise.all(
        (groups || []).map(async (group) => {
          const { data: options } = await supabase
            .from('modifier_options')
            .select('*')
            .eq('modifier_group_id', group.id)
            .order('sort_order');

          const { count } = await supabase
            .from('product_modifiers')
            .select('*', { count: 'exact', head: true })
            .eq('modifier_group_id', group.id);

          return {
            ...group,
            options: options || [],
            usage_count: count || 0
          };
        })
      );

      setTemplates(groupsWithOptions);
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load modifier templates');
    } finally {
      setLoading(false);
    }
  };

  const handleAddOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [
        ...prev.options,
        {
          option_name: '',
          addon_price: '0',
          is_default: false,
          sort_order: prev.options.length
        }
      ]
    }));
  };

  const handleRemoveOption = (index: number) => {
    if (formData.options.length <= 1) {
      setError('Must have at least one option');
      return;
    }
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const handleOptionChange = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => {
        if (i === index) {
          if (field === 'is_default' && value && prev.modifier_type === 'single_choice') {
            return { ...opt, [field]: value };
          }
          return { ...opt, [field]: value };
        }
        if (field === 'is_default' && value && prev.modifier_type === 'single_choice') {
          return { ...opt, is_default: false };
        }
        return opt;
      })
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name) {
      setError('Please enter a template name');
      return;
    }

    if (formData.options.length === 0) {
      setError('Please add at least one option');
      return;
    }

    if (formData.options.some(opt => !opt.option_name)) {
      setError('All options must have a name');
      return;
    }

    if (formData.modifier_type === 'multiple_choice' && formData.max_selections) {
      if (formData.max_selections < formData.min_selections) {
        setError('Max selections cannot be less than min selections');
        return;
      }
    }

    try {
      const groupData = {
        name: formData.name,
        description: formData.description || null,
        modifier_type: formData.modifier_type,
        enable_quantity_selector: formData.modifier_type === 'multiple_choice' ? formData.enable_quantity_selector : false,
        min_selections: formData.modifier_type === 'multiple_choice' ? formData.min_selections : 0,
        max_selections: formData.modifier_type === 'multiple_choice' ? formData.max_selections : null,
        is_template: true
      };

      let groupId: string;

      if (editingTemplate) {
        const { error: updateError } = await supabase
          .from('modifier_groups')
          .update(groupData)
          .eq('id', editingTemplate.id);

        if (updateError) throw updateError;

        await supabase
          .from('modifier_options')
          .delete()
          .eq('modifier_group_id', editingTemplate.id);

        groupId = editingTemplate.id;
        setSuccess('Modifier template updated successfully');
      } else {
        const { data: newGroup, error: insertError } = await supabase
          .from('modifier_groups')
          .insert(groupData)
          .select()
          .single();

        if (insertError) throw insertError;
        groupId = newGroup.id;
        setSuccess('Modifier template created successfully');
      }

      const optionsData = formData.options.map((opt, index) => ({
        modifier_group_id: groupId,
        option_name: opt.option_name,
        addon_price: parseFloat(opt.addon_price),
        is_default: formData.modifier_type === 'single_choice' ? opt.is_default : false,
        sort_order: index
      }));

      const { error: optionsError } = await supabase
        .from('modifier_options')
        .insert(optionsData);

      if (optionsError) throw optionsError;

      // Create or update template entry so it appears in ModifierSelector dropdown
      console.log('[TEMPLATE SYNC] Creating template entry for modifier group:', groupId, formData.name);

      // Check if a template already exists for this modifier group
      const { data: existingTemplateLink } = await supabase
        .from('modifier_template_groups')
        .select('template_id, modifier_templates(id, name)')
        .eq('modifier_group_id', groupId)
        .maybeSingle();

      if (existingTemplateLink) {
        // Template exists, update its name if changed
        console.log('[TEMPLATE SYNC] Found existing template:', existingTemplateLink.template_id);
        const { error: updateTemplateError } = await supabase
          .from('modifier_templates')
          .update({
            name: formData.name,
            description: formData.description || `Single modifier group: ${formData.name}`
          })
          .eq('id', existingTemplateLink.template_id);

        if (updateTemplateError) {
          console.error('[TEMPLATE SYNC] Error updating template:', updateTemplateError);
        } else {
          console.log('[TEMPLATE SYNC] Template updated successfully');
        }
      } else {
        // No template exists, create new one
        console.log('[TEMPLATE SYNC] Creating new template for group');
        const { data: newTemplate, error: templateError } = await supabase
          .from('modifier_templates')
          .insert({
            name: formData.name,
            description: formData.description || `Single modifier group: ${formData.name}`
          })
          .select()
          .single();

        if (templateError) {
          console.error('[TEMPLATE SYNC] Error creating template:', templateError);
        } else {
          console.log('[TEMPLATE SYNC] Template created:', newTemplate.id);

          // Link the template to this modifier group
          const { error: linkError } = await supabase
            .from('modifier_template_groups')
            .insert({
              template_id: newTemplate.id,
              modifier_group_id: groupId,
              is_required: false,
              sort_order: 0
            });

          if (linkError) {
            console.error('[TEMPLATE SYNC] Error linking template to group:', linkError);
          } else {
            console.log('[TEMPLATE SYNC] Template linked successfully');
          }
        }
      }

      await loadTemplates();
      closeModal();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error saving template:', err);
      setError(err.message || 'Failed to save template');
    }
  };

  const handleEdit = (template: ModifierGroupWithOptions) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      modifier_type: template.modifier_type,
      enable_quantity_selector: template.enable_quantity_selector,
      min_selections: template.min_selections,
      max_selections: template.max_selections,
      options: (template.options || []).map(opt => ({
        id: opt.id,
        option_name: opt.option_name,
        addon_price: opt.addon_price.toString(),
        is_default: opt.is_default,
        sort_order: opt.sort_order
      }))
    });
    setShowModal(true);
  };

  const handleDuplicate = async (template: ModifierGroupWithOptions) => {
    setEditingTemplate(null);
    setFormData({
      name: `${template.name} (Copy)`,
      description: template.description || '',
      modifier_type: template.modifier_type,
      enable_quantity_selector: template.enable_quantity_selector,
      min_selections: template.min_selections,
      max_selections: template.max_selections,
      options: (template.options || []).map(opt => ({
        option_name: opt.option_name,
        addon_price: opt.addon_price.toString(),
        is_default: opt.is_default,
        sort_order: opt.sort_order
      }))
    });
    setShowModal(true);
  };

  const handleDelete = async (template: ModifierGroupWithOptions) => {
    if (template.usage_count && template.usage_count > 0) {
      if (!confirm(`This template is used by ${template.usage_count} product(s). Deleting it will remove modifiers from those products. Continue?`)) {
        return;
      }
    } else {
      if (!confirm(`Delete template "${template.name}"?`)) {
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('modifier_groups')
        .delete()
        .eq('id', template.id);

      if (error) throw error;

      setSuccess('Template deleted successfully');
      await loadTemplates();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error deleting template:', err);
      setError(err.message || 'Failed to delete template');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      modifier_type: 'single_choice',
      enable_quantity_selector: false,
      min_selections: 0,
      max_selections: null,
      options: [{ option_name: '', addon_price: '0', is_default: false, sort_order: 0 }]
    });
    setError('');
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
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-2">Quick Guide: When to Use Modifier Templates</h3>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="bg-white/80 rounded-lg p-3 border border-blue-100">
                  <p className="font-bold text-blue-900 mb-1">Single Choice</p>
                  <p className="text-gray-700 text-xs mb-2">Customer picks ONE option</p>
                  <p className="text-gray-600 text-xs italic">Example: Size (Small, Medium, Large)</p>
                </div>
                <div className="bg-white/80 rounded-lg p-3 border border-purple-100">
                  <p className="font-bold text-purple-900 mb-1">Multiple Choice</p>
                  <p className="text-gray-700 text-xs mb-2">Customer picks MANY options</p>
                  <p className="text-gray-600 text-xs italic">Example: Toppings (Cheese, Pepperoni, Olives)</p>
                </div>
                <div className="bg-white/80 rounded-lg p-3 border border-green-100">
                  <p className="font-bold text-green-900 mb-1">With Quantity Selector</p>
                  <p className="text-gray-700 text-xs mb-2">Each option can have quantity</p>
                  <p className="text-gray-600 text-xs italic">Example: Add-ons (2x Pearl, 3x Pudding)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900 mb-2">Modifier Templates</h1>
            <p className="text-gray-600 font-medium">Manage reusable product customization options</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:scale-105 transition-transform shadow-lg"
          >
            <Plus className="w-5 h-5" />
            New Template
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

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {templates.length === 0 ? (
            <div className="p-12 text-center">
              <List className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-2">No modifier templates yet</p>
              <p className="text-sm text-gray-500">Create your first template to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {templates.map((template) => (
                <div key={template.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-black text-gray-900">{template.name}</h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                          template.modifier_type === 'single_choice'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {template.modifier_type === 'single_choice' ? (
                            <><List className="w-3 h-3 mr-1" /> Single Choice</>
                          ) : (
                            <><CheckSquare className="w-3 h-3 mr-1" /> Multiple Choice</>
                          )}
                        </span>
                        {template.usage_count !== undefined && template.usage_count > 0 && (
                          <span className="text-xs text-gray-600 font-medium">
                            Used by {template.usage_count} product{template.usage_count > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-sm text-gray-600">{template.description}</p>
                      )}
                      {template.modifier_type === 'multiple_choice' && (
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
                          {template.enable_quantity_selector && (
                            <span className="font-medium">Qty Selector Enabled</span>
                          )}
                          <span>
                            Select: {template.min_selections} - {template.max_selections || 'unlimited'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandedTemplate(expandedTemplate === template.id ? null : template.id)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="View options"
                      >
                        {expandedTemplate === template.id ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDuplicate(template)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Duplicate"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleEdit(template)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(template)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {expandedTemplate === template.id && template.options && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                      <h4 className="text-sm font-bold text-gray-900 mb-3">Options ({template.options.length})</h4>
                      <div className="space-y-2">
                        {template.options.map((option) => (
                          <div key={option.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-gray-900">{option.option_name}</span>
                              {option.is_default && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold">
                                  Default
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-bold text-gray-900">
                              {option.addon_price > 0 ? `+RM ${option.addon_price.toFixed(2)}` : 'No charge'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-gray-900">
                {editingTemplate ? 'Edit Template' : 'Create New Template'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-4">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800 font-semibold">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Template Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                  placeholder="e.g., Size, Ice Level, Add-ons"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium resize-none"
                  rows={2}
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">Modifier Type *</label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    formData.modifier_type === 'single_choice'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="modifier_type"
                      value="single_choice"
                      checked={formData.modifier_type === 'single_choice'}
                      onChange={(e) => setFormData({ ...formData, modifier_type: e.target.value as any })}
                      className="w-5 h-5 text-blue-600 mt-0.5"
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <List className="w-4 h-4 text-blue-600" />
                        <p className="font-bold text-gray-900">Single Choice</p>
                      </div>
                      <p className="text-xs text-gray-600">Customer selects one option only</p>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    formData.modifier_type === 'multiple_choice'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="modifier_type"
                      value="multiple_choice"
                      checked={formData.modifier_type === 'multiple_choice'}
                      onChange={(e) => setFormData({ ...formData, modifier_type: e.target.value as any })}
                      className="w-5 h-5 text-purple-600 mt-0.5"
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CheckSquare className="w-4 h-4 text-purple-600" />
                        <p className="font-bold text-gray-900">Multiple Choice</p>
                      </div>
                      <p className="text-xs text-gray-600">Customer can select multiple options</p>
                    </div>
                  </label>
                </div>
              </div>

              {formData.modifier_type === 'multiple_choice' && (
                <div className="space-y-4 p-5 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-300 rounded-xl shadow-sm">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="checkbox"
                          id="enable_quantity"
                          checked={formData.enable_quantity_selector}
                          onChange={(e) => setFormData({ ...formData, enable_quantity_selector: e.target.checked })}
                          className="w-5 h-5 text-purple-600 border-2 border-gray-300 rounded focus:ring-purple-500 mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Hash className="w-4 h-4 text-purple-600" />
                            <label htmlFor="enable_quantity" className="text-sm font-bold text-gray-900 cursor-pointer">
                              Enable Quantity Selector
                            </label>
                          </div>
                          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                            Allow customers to select quantities for each option (e.g., 2x Pearl, 3x Pudding).
                            Each selected option will have +/- buttons to adjust quantity.
                          </p>
                        </div>
                      </div>
                      <div className="group relative">
                        <Info className="w-5 h-5 text-purple-600 cursor-help" />
                        <div className="hidden group-hover:block absolute right-0 top-6 z-10 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl">
                          <p className="font-bold mb-2">When to use:</p>
                          <ul className="space-y-1 list-disc list-inside">
                            <li>Bubble tea add-ons (2 pearls, 1 pudding)</li>
                            <li>Pizza toppings (extra cheese, pepperoni)</li>
                            <li>Coffee extras (2 shots espresso)</li>
                          </ul>
                          <p className="mt-2 text-gray-300">Customers can select different quantities for each option they choose.</p>
                        </div>
                      </div>
                    </div>

                    {formData.enable_quantity_selector && (
                      <div className="p-3 bg-white/80 rounded-lg border border-purple-200">
                        <div className="flex items-start gap-2 text-xs text-purple-800">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold mb-1">How it works for customers:</p>
                            <p>After selecting an option, +/- buttons appear to adjust quantity. Each option has independent quantity control starting at 1.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Min Selections</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.min_selections}
                        onChange={(e) => setFormData({ ...formData, min_selections: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Max Selections</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.max_selections || ''}
                        onChange={(e) => setFormData({ ...formData, max_selections: e.target.value ? parseInt(e.target.value) : null })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none font-medium"
                        placeholder="Unlimited"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">Options *</label>
                <div className="space-y-3">
                  {formData.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <input
                        type="text"
                        value={option.option_name}
                        onChange={(e) => handleOptionChange(index, 'option_name', e.target.value)}
                        className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-medium"
                        placeholder="Option name"
                        required
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={option.addon_price}
                        onChange={(e) => handleOptionChange(index, 'addon_price', e.target.value)}
                        className="w-28 px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-medium"
                        placeholder="0.00"
                        required
                      />
                      {formData.modifier_type === 'single_choice' && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="default_option"
                            checked={option.is_default}
                            onChange={(e) => handleOptionChange(index, 'is_default', e.target.checked)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-xs text-gray-600 font-medium whitespace-nowrap">Default</span>
                        </label>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        disabled={formData.options.length === 1}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="mt-3 flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg font-bold transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Option
                </button>
              </div>

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
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </CMSLayout>
  );
};

export default CMSModifiers;
