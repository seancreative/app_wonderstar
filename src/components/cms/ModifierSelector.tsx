import React, { useState, useEffect } from 'react';
import { X, Plus, List, CheckSquare, ChevronDown, ChevronUp, Trash2, Edit2, Save, Download, Hash, Info, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ModifierGroup, ModifierOption } from '../../types/database';

interface ModifierGroupWithOptions extends ModifierGroup {
  options?: ModifierOption[];
}

interface AssignedModifier extends ModifierGroupWithOptions {
  is_required: boolean;
  sort_order: number;
  product_modifier_id?: string;
}

interface ModifierSelectorProps {
  productId?: string;
  assignedModifiers: AssignedModifier[];
  onChange: (modifiers: AssignedModifier[]) => void;
}

interface ModifierOptionForm {
  option_name: string;
  addon_price: number;
  temp_id?: string;
}

const ModifierSelector: React.FC<ModifierSelectorProps> = ({
  productId,
  assignedModifiers,
  onChange
}) => {
  const [showCreateForm, setShowCreateForm] = useState<'single' | 'multiple' | null>(null);
  const [expandedModifier, setExpandedModifier] = useState<string | null>(null);
  const [editingModifier, setEditingModifier] = useState<number | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    enable_quantity_selector: false,
    min_selections: 0,
    max_selections: null as number | null,
    options: [
      { option_name: '', addon_price: 0, temp_id: crypto.randomUUID() }
    ] as ModifierOptionForm[]
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      enable_quantity_selector: false,
      min_selections: 0,
      max_selections: null,
      options: [{ option_name: '', addon_price: 0, temp_id: crypto.randomUUID() }]
    });
    setShowCreateForm(null);
    setEditingModifier(null);
  };

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      console.log('[TEMPLATE LOAD] Loading templates from modifier_templates table...');
      const { data: templateData, error } = await supabase
        .from('modifier_templates')
        .select('*')
        .order('name');

      if (error) {
        console.error('[TEMPLATE LOAD] Error loading templates:', error);
        throw error;
      }

      console.log('[TEMPLATE LOAD] Found', templateData?.length || 0, 'templates:', templateData);

      // Get group count for each template
      if (templateData && templateData.length > 0) {
        const templatesWithCounts = await Promise.all(
          templateData.map(async (template) => {
            const { count } = await supabase
              .from('modifier_template_groups')
              .select('*', { count: 'exact', head: true })
              .eq('template_id', template.id);

            console.log('[TEMPLATE LOAD] Template', template.name, 'has', count, 'groups');
            return {
              ...template,
              group_count: count || 0
            };
          })
        );
        setTemplates(templatesWithCounts);
      } else {
        setTemplates([]);
      }

      console.log('[TEMPLATE LOAD] Templates loaded successfully');
    } catch (error) {
      console.error('[TEMPLATE LOAD] Error loading templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    if (!templateId) return;

    console.log('[TEMPLATE APPLY] Applying template:', templateId);
    try {
      const { data: templateData, error: templateError } = await supabase
        .from('modifier_template_groups')
        .select(`
          *,
          modifier_groups (
            *,
            modifier_options (*)
          )
        `)
        .eq('template_id', templateId)
        .order('sort_order');

      if (templateError) {
        console.error('[TEMPLATE APPLY] Error loading template data:', templateError);
        throw templateError;
      }

      console.log('[TEMPLATE APPLY] Template data loaded:', templateData);
      console.log('[TEMPLATE APPLY] Found', templateData?.length || 0, 'modifier groups in template');

      const newModifiers: AssignedModifier[] = (templateData || []).map((tg: any) => {
        const modifier = {
          ...tg.modifier_groups,
          options: tg.modifier_groups.modifier_options || [],
          is_required: tg.is_required,
          sort_order: assignedModifiers.length + tg.sort_order
        };
        console.log('[TEMPLATE APPLY] Processing group:', modifier.name, 'with', modifier.options.length, 'options');
        return modifier;
      });

      console.log('[TEMPLATE APPLY] Adding', newModifiers.length, 'modifiers to product');
      onChange([...assignedModifiers, ...newModifiers]);
      console.log('[TEMPLATE APPLY] Template applied successfully');
    } catch (error) {
      console.error('[TEMPLATE APPLY] Error applying template:', error);
      alert('Failed to apply template');
    }
  };

  const handleSaveAsTemplate = () => {
    if (assignedModifiers.length === 0) {
      alert('Please add some modifiers before saving as template');
      return;
    }
    setShowSaveTemplateModal(true);
  };

  const handleConfirmSaveTemplate = async () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    setSavingTemplate(true);
    try {
      const { data: newTemplate, error: templateError } = await supabase
        .from('modifier_templates')
        .insert({
          name: templateName,
          description: `Template with ${assignedModifiers.length} modifier groups`
        })
        .select()
        .single();

      if (templateError) throw templateError;

      for (let i = 0; i < assignedModifiers.length; i++) {
        const mod = assignedModifiers[i];
        let groupId = mod.id;

        const { data: existingGroup } = await supabase
          .from('modifier_groups')
          .select('id')
          .eq('id', mod.id)
          .maybeSingle();

        if (!existingGroup) {
          const { data: newGroup, error: groupError } = await supabase
            .from('modifier_groups')
            .insert({
              name: mod.name,
              description: mod.description,
              modifier_type: mod.modifier_type,
              enable_quantity_selector: mod.modifier_type === 'multiple_choice' ? (mod.enable_quantity_selector || false) : false,
              min_selections: mod.modifier_type === 'multiple_choice' ? (mod.min_selections || 0) : 0,
              max_selections: mod.modifier_type === 'multiple_choice' ? (mod.max_selections || null) : null,
              is_template: true
            })
            .select()
            .single();

          if (groupError) throw groupError;
          groupId = newGroup.id;

          if (mod.options && mod.options.length > 0) {
            const optionsData = mod.options.map((opt, idx) => ({
              modifier_group_id: groupId,
              option_name: opt.option_name,
              addon_price: opt.addon_price,
              is_available: true,
              sort_order: idx
            }));

            await supabase.from('modifier_options').insert(optionsData);
          }
        }

        await supabase.from('modifier_template_groups').insert({
          template_id: newTemplate.id,
          modifier_group_id: groupId,
          is_required: mod.is_required,
          sort_order: i
        });
      }

      await loadTemplates();
      setShowSaveTemplateModal(false);
      setTemplateName('');
      alert('Template saved successfully!');
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleAddOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, { option_name: '', addon_price: 0, temp_id: crypto.randomUUID() }]
    });
  };

  const handleRemoveOption = (index: number) => {
    if (formData.options.length > 1) {
      setFormData({
        ...formData,
        options: formData.options.filter((_, i) => i !== index)
      });
    }
  };

  const handleOptionChange = (index: number, field: 'option_name' | 'addon_price', value: string | number) => {
    const updated = [...formData.options];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, options: updated });
  };

  const handleCreateGroup = () => {
    if (!formData.name.trim()) {
      alert('Please enter a group name');
      return;
    }

    const validOptions = formData.options.filter(opt => opt.option_name.trim() !== '');
    console.log('[MODIFIER CREATE] Valid options:', validOptions);
    if (validOptions.length === 0) {
      alert('Please add at least one option');
      return;
    }

    const newModifier: AssignedModifier = {
      id: crypto.randomUUID(),
      name: formData.name,
      description: formData.description || null,
      modifier_type: showCreateForm === 'single' ? 'single_choice' : 'multiple_choice',
      enable_quantity_selector: showCreateForm === 'multiple' ? formData.enable_quantity_selector : false,
      min_selections: showCreateForm === 'multiple' ? formData.min_selections : 0,
      max_selections: showCreateForm === 'multiple' ? formData.max_selections : null,
      is_required: false,
      sort_order: assignedModifiers.length,
      is_template: false,
      created_at: new Date().toISOString(),
      options: validOptions.map((opt, idx) => ({
        id: opt.temp_id || crypto.randomUUID(),
        modifier_group_id: '',
        option_name: opt.option_name,
        addon_price: Number(opt.addon_price) || 0,
        is_available: true,
        sort_order: idx,
        created_at: new Date().toISOString()
      }))
    };

    console.log('[MODIFIER CREATE] New modifier created:', newModifier);
    onChange([...assignedModifiers, newModifier]);
    resetForm();
  };

  const handleUpdateGroup = () => {
    if (editingModifier === null) return;

    if (!formData.name.trim()) {
      alert('Please enter a group name');
      return;
    }

    const validOptions = formData.options.filter(opt => opt.option_name.trim() !== '');
    console.log('[MODIFIER UPDATE] Valid options:', validOptions);
    if (validOptions.length === 0) {
      alert('Please add at least one option');
      return;
    }

    const updated = [...assignedModifiers];
    const isMultipleChoice = updated[editingModifier].modifier_type === 'multiple_choice';
    updated[editingModifier] = {
      ...updated[editingModifier],
      name: formData.name,
      description: formData.description || null,
      enable_quantity_selector: isMultipleChoice ? formData.enable_quantity_selector : false,
      min_selections: isMultipleChoice ? formData.min_selections : 0,
      max_selections: isMultipleChoice ? formData.max_selections : null,
      options: validOptions.map((opt, idx) => ({
        id: opt.temp_id || crypto.randomUUID(),
        modifier_group_id: updated[editingModifier].id,
        option_name: opt.option_name,
        addon_price: Number(opt.addon_price) || 0,
        is_available: true,
        sort_order: idx,
        created_at: new Date().toISOString()
      }))
    };

    console.log('[MODIFIER UPDATE] Updated modifier:', updated[editingModifier]);
    onChange(updated);
    resetForm();
  };

  const handleEditGroup = (index: number) => {
    const modifier = assignedModifiers[index];
    setFormData({
      name: modifier.name,
      description: modifier.description || '',
      enable_quantity_selector: modifier.enable_quantity_selector || false,
      min_selections: modifier.min_selections || 0,
      max_selections: modifier.max_selections || null,
      options: modifier.options?.map(opt => ({
        option_name: opt.option_name,
        addon_price: opt.addon_price,
        temp_id: opt.id
      })) || [{ option_name: '', addon_price: 0, temp_id: crypto.randomUUID() }]
    });
    setEditingModifier(index);
    setShowCreateForm(modifier.modifier_type === 'single_choice' ? 'single' : 'multiple');
  };

  const handleRemoveModifier = (index: number) => {
    const updated = assignedModifiers.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleToggleRequired = (index: number) => {
    const updated = [...assignedModifiers];
    updated[index] = {
      ...updated[index],
      is_required: !updated[index].is_required
    };
    onChange(updated);
  };

  const moveModifier = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= assignedModifiers.length) return;

    const updated = [...assignedModifiers];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    updated.forEach((mod, i) => {
      mod.sort_order = i;
    });
    onChange(updated);
  };

  const getSingleChoiceModifiers = () => assignedModifiers.filter(m => m.modifier_type === 'single_choice');
  const getMultipleChoiceModifiers = () => assignedModifiers.filter(m => m.modifier_type === 'multiple_choice');

  const renderModifierCard = (modifier: AssignedModifier, index: number) => (
    <div key={modifier.id} className="p-4 bg-white border-2 border-gray-200 rounded-xl">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-gray-900">{modifier.name}</h4>
            {modifier.is_required && (
              <span className="inline-flex items-center px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                Required
              </span>
            )}
            {modifier.enable_quantity_selector && (
              <span className="inline-flex items-center px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                <Hash className="w-3 h-3 mr-1" />
                Qty Selector
              </span>
            )}
          </div>
          {modifier.description && (
            <p className="text-xs text-gray-600">{modifier.description}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {modifier.options?.length || 0} option{(modifier.options?.length || 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpandedModifier(expandedModifier === modifier.id ? null : modifier.id)}
            className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors"
            title="View options"
          >
            {expandedModifier === modifier.id ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => handleEditGroup(index)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => moveModifier(index, 'up')}
            disabled={index === 0}
            className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors disabled:opacity-30"
            title="Move up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => moveModifier(index, 'down')}
            disabled={index === assignedModifiers.length - 1}
            className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors disabled:opacity-30"
            title="Move down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleToggleRequired(index)}
            className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
              modifier.is_required
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title={modifier.is_required ? 'Make optional' : 'Make required'}
          >
            {modifier.is_required ? 'Required' : 'Optional'}
          </button>
          <button
            type="button"
            onClick={() => handleRemoveModifier(index)}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expandedModifier === modifier.id && modifier.options && (
        <div className="pt-3 border-t border-gray-300">
          <div className="space-y-1.5">
            {modifier.options.map((option) => (
              <div key={option.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-900">{option.option_name}</span>
                <span className="text-sm font-bold text-gray-900">
                  {option.addon_price > 0 ? `+RM ${option.addon_price.toFixed(2)}` : 'No charge'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderCreateForm = () => {
    if (!showCreateForm) return null;

    const isSingleChoice = showCreateForm === 'single';
    const title = editingModifier !== null
      ? `Edit ${isSingleChoice ? 'Single' : 'Multiple'} Choice Group`
      : `Add ${isSingleChoice ? 'Single' : 'Multiple'} Choice Group`;

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
        <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-gray-900">{title}</h3>
            <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Group Name * <span className="text-xs font-normal text-gray-500">(e.g., Size, Flavours, Ice Level)</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                placeholder="Enter group name"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Description <span className="text-xs font-normal text-gray-500">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                placeholder="Brief description"
              />
            </div>

            {showCreateForm === 'multiple' && (
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
                    <label className="block text-xs font-bold text-gray-700 mb-2">
                      Min Selections <span className="text-gray-500">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.min_selections}
                      onChange={(e) => setFormData({ ...formData, min_selections: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none font-medium"
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">Minimum options customer must select</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">
                      Max Selections <span className="text-gray-500">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.max_selections || ''}
                      onChange={(e) => setFormData({ ...formData, max_selections: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none font-medium"
                      placeholder="Unlimited"
                    />
                    <p className="text-xs text-gray-500 mt-1">Leave empty for unlimited</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-bold text-gray-700">
                  Options * <span className="text-xs font-normal text-gray-500">(Add at least one option)</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Option
                </button>
              </div>

              <div className="space-y-2">
                {formData.options.map((option, index) => (
                  <div key={option.temp_id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={option.option_name}
                      onChange={(e) => handleOptionChange(index, 'option_name', e.target.value)}
                      className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-medium"
                      placeholder="Option name (e.g., Small, Medium, Large)"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-gray-600">+RM</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={option.addon_price}
                        onChange={(e) => handleOptionChange(index, 'addon_price', parseFloat(e.target.value) || 0)}
                        className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-medium"
                        placeholder="0.00"
                      />
                    </div>
                    {formData.options.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={editingModifier !== null ? handleUpdateGroup : handleCreateGroup}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              {editingModifier !== null ? 'Update Group' : 'Add Group'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b-2 border-gray-200">
        <div className="flex-1">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Apply Modifier Template
          </label>
          <select
            onChange={(e) => handleApplyTemplate(e.target.value)}
            disabled={loadingTemplates}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-medium bg-white"
          >
            <option value="">Select a template to apply...</option>
            {templates.map((template: any) => (
              <option key={template.id} value={template.id}>
                {template.name} {template.group_count ? `(${template.group_count} ${template.group_count === 1 ? 'group' : 'groups'})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="pt-6">
          <button
            type="button"
            onClick={handleSaveAsTemplate}
            disabled={assignedModifiers.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Save className="w-4 h-4" />
            Save as Template
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <List className="w-5 h-5 text-blue-600" />
                Single Choice Modifier
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Only allows for one modifier option to be selected
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateForm('single')}
            className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Group
          </button>

          {getSingleChoiceModifiers().length > 0 && (
            <div className="mt-4 space-y-2">
              {assignedModifiers.map((modifier, index) =>
                modifier.modifier_type === 'single_choice' && renderModifierCard(modifier, index)
              )}
            </div>
          )}
        </div>

        <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-purple-600" />
                Multiple Choice Modifier
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Allows for multiple modifier options to be selected
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateForm('multiple')}
            className="mt-3 flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Group
          </button>

          {getMultipleChoiceModifiers().length > 0 && (
            <div className="mt-4 space-y-2">
              {assignedModifiers.map((modifier, index) =>
                modifier.modifier_type === 'multiple_choice' && renderModifierCard(modifier, index)
              )}
            </div>
          )}
        </div>
      </div>

      {assignedModifiers.length === 0 && (
        <div className="p-8 bg-gradient-to-br from-gray-50 to-blue-50 border-2 border-dashed border-gray-300 rounded-xl text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <List className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-base text-gray-900 font-bold mb-2">No Customization Options Yet</p>
          <p className="text-sm text-gray-600">
            Click "Add Group" above to create your first modifier group.<br />
            <span className="font-semibold">Examples:</span> Size options, flavours, toppings, add-ons
          </p>
        </div>
      )}

      {renderCreateForm()}

      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-gray-900">Save as Template</h3>
              <button
                onClick={() => {
                  setShowSaveTemplateModal(false);
                  setTemplateName('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Coffee Modifiers, Pizza Options"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none font-medium"
                  autoFocus
                />
              </div>

              <div className="bg-gray-50 p-3 rounded-xl">
                <p className="text-sm text-gray-700 font-medium mb-2">
                  This template will include:
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• {assignedModifiers.filter(m => m.modifier_type === 'single_choice').length} Single Choice modifier groups</li>
                  <li>• {assignedModifiers.filter(m => m.modifier_type === 'multiple_choice').length} Multiple Choice modifier groups</li>
                  <li>• Total: {assignedModifiers.length} groups with all their options</li>
                </ul>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowSaveTemplateModal(false);
                    setTemplateName('');
                  }}
                  disabled={savingTemplate}
                  className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSaveTemplate}
                  disabled={savingTemplate || !templateName.trim()}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingTemplate ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModifierSelector;
