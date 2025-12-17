import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Star, ShoppingCart, Tag, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useShop } from '../contexts/ShopContext';
import ImageSlider from './ImageSlider';
import type { ModifierGroup, ModifierOption, SelectedModifier, SelectedModifierOption } from '../types/database';

interface Product {
  id: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  category_id?: string;
  subcategory_id?: string;
  base_price: number;
  weekend_price?: number;
  pricing_type?: string;
  variants?: any;
  addons?: any;
  image_url?: string;
  images?: string[];
  stock?: number;
  workshop_date?: string;
  duration_minutes?: number;
  age_min?: number;
  age_max?: number;
  max_capacity?: number;
  bonus_stars?: number;
  special_discount?: boolean;
}

interface ProductModifierGroup extends ModifierGroup {
  options: ModifierOption[];
  is_required: boolean;
}

interface ProductDetailModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onAddedToCart?: () => void;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  isOpen,
  onClose,
  onAddedToCart,
}) => {
  const { user } = useAuth();
  const { selectedOutlet, refreshCartCount } = useShop();
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null);
  const [loadingVoucher, setLoadingVoucher] = useState(true);
  const [modifierGroups, setModifierGroups] = useState<ProductModifierGroup[]>([]);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, SelectedModifierOption[]>>({});
  const [modifierErrors, setModifierErrors] = useState<string[]>([]);
  const [loadingModifiers, setLoadingModifiers] = useState(true);
  const [showQuantityHint, setShowQuantityHint] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && product) {
      loadProductModifiers();
      if (user) {
        loadAppliedVoucher();
      } else {
        setLoadingVoucher(false);
      }
    }
  }, [isOpen, product, user]);

  const loadProductModifiers = async () => {
    setLoadingModifiers(true);
    try {
      const { data: productModifiers, error } = await supabase
        .from('product_modifiers')
        .select(`
          *,
          modifier_groups (
            *,
            modifier_options (*)
          )
        `)
        .eq('product_id', product.id)
        .order('sort_order');

      if (error) throw error;

      const groups: ProductModifierGroup[] = (productModifiers || []).map((pm: any) => ({
        ...pm.modifier_groups,
        options: pm.modifier_groups.modifier_options || [],
        is_required: pm.is_required
      }));

      setModifierGroups(groups);

      const initialSelections: Record<string, SelectedModifierOption[]> = {};
      groups.forEach(group => {
        if (group.modifier_type === 'single_choice') {
          const defaultOption = group.options.find(opt => opt.is_default);
          if (defaultOption) {
            initialSelections[group.id] = [{
              option_id: defaultOption.id,
              option_name: defaultOption.option_name,
              addon_price: defaultOption.addon_price,
              quantity: 1
            }];
          }
        }
      });

      setSelectedModifiers(initialSelections);
    } catch (error) {
      console.error('Error loading modifiers:', error);
    } finally {
      setLoadingModifiers(false);
    }
  };

  const loadAppliedVoucher = async () => {
    if (!user) {
      setLoadingVoucher(false);
      return;
    }

    try {
      const { data: preferences, error: prefError } = await supabase
        .from('user_preferences')
        .select('selected_voucher_code')
        .eq('user_id', user.id)
        .maybeSingle();

      if (prefError || !preferences?.selected_voucher_code) {
        setAppliedVoucher(null);
        setLoadingVoucher(false);
        return;
      }

      const { data: userVoucher, error: voucherError } = await supabase
        .from('user_vouchers')
        .select('*, vouchers(*)')
        .eq('user_id', user.id)
        .eq('code', preferences.selected_voucher_code)
        .eq('is_active', true)
        .maybeSingle();

      if (voucherError || !userVoucher) {
        setAppliedVoucher(null);
        setLoadingVoucher(false);
        return;
      }

      const now = new Date();
      const expiresAt = userVoucher.expires_at ? new Date(userVoucher.expires_at) : null;

      if (expiresAt && expiresAt < now) {
        setAppliedVoucher(null);
        setLoadingVoucher(false);
        return;
      }

      if (userVoucher.usage_count >= userVoucher.max_usage_count) {
        setAppliedVoucher(null);
        setLoadingVoucher(false);
        return;
      }

      setAppliedVoucher(userVoucher);
    } catch (error) {
      console.error('Error loading voucher:', error);
      setAppliedVoucher(null);
    } finally {
      setLoadingVoucher(false);
    }
  };

  const handleSingleChoiceSelect = (groupId: string, option: ModifierOption) => {
    setSelectedModifiers(prev => {
      const current = prev[groupId] || [];
      const isCurrentlySelected = current.some(s => s.option_id === option.id);

      // If clicking the already selected option, deselect it (untick)
      if (isCurrentlySelected) {
        return {
          ...prev,
          [groupId]: []
        };
      }

      // Otherwise, select this option (replacing any previous selection)
      return {
        ...prev,
        [groupId]: [{
          option_id: option.id,
          option_name: option.option_name,
          addon_price: option.addon_price,
          quantity: 1
        }]
      };
    });
  };

  const handleMultipleChoiceToggle = async (groupId: string, option: ModifierOption, group: ProductModifierGroup) => {
    // Check hint status first (outside setState)
    let shouldShowHint = false;
    if (group.enable_quantity_selector && user) {
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('ui_hints')
        .eq('user_id', user.id)
        .maybeSingle();

      const quantityHintSeen = prefs?.ui_hints?.quantity_hint_seen;

      if (!quantityHintSeen) {
        shouldShowHint = true;
        // Mark as seen in database
        await supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            ui_hints: { ...(prefs?.ui_hints || {}), quantity_hint_seen: true },
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });
      }
    }

    setSelectedModifiers(prev => {
      const current = prev[groupId] || [];
      const existingIndex = current.findIndex(s => s.option_id === option.id);

      if (existingIndex >= 0) {
        return {
          ...prev,
          [groupId]: current.filter((_, i) => i !== existingIndex)
        };
      } else {
        const maxReached = group.max_selections && current.length >= group.max_selections;
        if (maxReached) {
          return prev;
        }

        // Show hint if needed
        if (shouldShowHint) {
          setShowQuantityHint(groupId);
          setTimeout(() => setShowQuantityHint(null), 3000);
        }

        return {
          ...prev,
          [groupId]: [...current, {
            option_id: option.id,
            option_name: option.option_name,
            addon_price: option.addon_price,
            quantity: 1
          }]
        };
      }
    });
  };

  const handleQuantityChange = (groupId: string, optionId: string, delta: number) => {
    setSelectedModifiers(prev => {
      const current = prev[groupId] || [];
      return {
        ...prev,
        [groupId]: current.map(item => {
          if (item.option_id === optionId) {
            const newQty = Math.max(1, item.quantity + delta);
            return { ...item, quantity: newQty };
          }
          return item;
        })
      };
    });
  };

  const validateModifiers = (): boolean => {
    const errors: string[] = [];

    modifierGroups.forEach(group => {
      const selections = selectedModifiers[group.id] || [];

      if (group.is_required && selections.length === 0) {
        errors.push(`Please select an option for ${group.name}`);
      }

      if (group.modifier_type === 'multiple_choice') {
        if (selections.length < group.min_selections) {
          errors.push(`${group.name}: Select at least ${group.min_selections} option${group.min_selections > 1 ? 's' : ''}`);
        }
        if (group.max_selections && selections.length > group.max_selections) {
          errors.push(`${group.name}: Select up to ${group.max_selections} option${group.max_selections > 1 ? 's' : ''}`);
        }
      }
    });

    setModifierErrors(errors);
    return errors.length === 0;
  };

  const getCurrentPrice = () => {
    const today = new Date().getDay();
    const isWeekend = today === 0 || today === 6;

    if (isWeekend && product.weekend_price) {
      return product.weekend_price;
    }
    return product.base_price;
  };

  const getModifiersTotal = () => {
    let total = 0;
    Object.values(selectedModifiers).forEach(options => {
      options.forEach(opt => {
        total += opt.addon_price * opt.quantity;
      });
    });
    return total;
  };

  const getDiscountedPrice = () => {
    if (!appliedVoucher?.vouchers) return null;

    const voucher = appliedVoucher.vouchers;
    const currentPrice = getCurrentPrice();

    if (voucher.discount_type === 'percentage') {
      const discount = currentPrice * (voucher.discount_value / 100);
      return currentPrice - discount;
    } else if (voucher.discount_type === 'fixed_amount') {
      return Math.max(0, currentPrice - voucher.discount_value);
    }

    return null;
  };

  const getTotalPrice = () => {
    const discountedPrice = getDiscountedPrice();
    const basePrice = discountedPrice !== null ? discountedPrice : getCurrentPrice();
    const modifiersTotal = getModifiersTotal();
    return (basePrice + modifiersTotal) * quantity;
  };

  const handleAddToCart = async () => {
    if (!product || !selectedOutlet || !user) return;

    if (!validateModifiers()) {
      return;
    }

    setAddingToCart(true);
    try {
      const selectedModifiersArray: SelectedModifier[] = modifierGroups
        .filter(group => selectedModifiers[group.id]?.length > 0)
        .map(group => ({
          modifier_group_id: group.id,
          group_name: group.name,
          modifier_type: group.modifier_type,
          selected_options: selectedModifiers[group.id]
        }));

      const basePrice = getCurrentPrice();
      const modifiersTotal = getModifiersTotal();
      const finalUnitPrice = basePrice + modifiersTotal;

      const { error: insertError } = await supabase
        .from('shop_cart_items')
        .insert({
          user_id: user.id,
          outlet_id: selectedOutlet.id,
          product_id: product.id,
          quantity: quantity,
          unit_price: finalUnitPrice,
          metadata: {
            product_name: product.name,
            category: product.category,
            category_name: product.category, // Store both for compatibility
            category_id: product.category_id,
            subcategory: product.subcategory,
            subcategory_id: product.subcategory_id,
            selected_modifiers: selectedModifiersArray
          },
        });

      if (insertError) throw insertError;

      await refreshCartCount();
      onAddedToCart?.();
      onClose();
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Failed to add to cart. Please try again.');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const images =
    product.images && product.images.length > 0
      ? product.images
      : product.image_url
      ? [product.image_url]
      : [];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up overflow-hidden flex flex-col max-h-[85vh]">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all hover:scale-110 active:scale-95"
        >
          <X className="w-5 h-5 text-gray-700" />
        </button>

        <div className="flex-1 overflow-y-auto">
          <div className="flex gap-3 p-4">
            <div className="w-32 h-32 flex-shrink-0">
              {images.length > 0 ? (
                images.length === 1 ? (
                  <div className="w-full h-full rounded-xl overflow-hidden bg-gradient-to-br from-primary-100 to-primary-200">
                    <img
                      src={images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full">
                    <ImageSlider images={images} altText={product.name} isCompact={true} />
                  </div>
                )
              ) : (
                <div className="w-full h-full rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                  <span className="text-4xl">🎁</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-base font-black text-gray-900 mb-1 leading-tight line-clamp-2">
                {product.name}
              </h2>

              <div className="space-y-1 mb-2">
                {appliedVoucher && getDiscountedPrice() !== null ? (
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-gray-400 line-through">
                        RM {getCurrentPrice().toFixed(2)}
                      </span>
                      <div className="flex items-center gap-0.5 bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                        <Tag className="w-2.5 h-2.5" />
                        <span className="text-[10px] font-bold">{appliedVoucher.code}</span>
                      </div>
                    </div>
                    <div className="text-xl font-black text-green-600">
                      RM {getDiscountedPrice()!.toFixed(2)}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-xl font-black text-primary-600">
                      RM {getCurrentPrice().toFixed(2)}
                    </span>
                    {product.weekend_price && product.weekend_price !== product.base_price && (
                      <span className="text-[10px] text-gray-500">
                        (Weekday: RM {product.base_price.toFixed(2)})
                      </span>
                    )}
                  </div>
                )}
              </div>

              {product.bonus_stars && product.bonus_stars > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-500" fill="currentColor" />
                  <span className="text-xs font-bold text-gray-700">
                    +{product.bonus_stars} stars
                  </span>
                </div>
              )}

              {product.stock !== undefined && product.stock !== null && product.stock <= 0 && (
                <div className="mt-1.5 inline-block px-2 py-0.5 rounded-full bg-red-100">
                  <p className="text-xs font-bold text-red-700">Out of stock</p>
                </div>
              )}
            </div>
          </div>

          {product.description && (
            <div className="px-4 pb-3">
              <div className="bg-gray-50 p-2.5 rounded-xl">
                <p className="text-xs text-gray-600 leading-relaxed">{product.description}</p>
              </div>
            </div>
          )}

          {product.category === 'Workshops' && (
            <div className="px-4 pb-3">
              <div className="bg-blue-50 p-2.5 rounded-xl space-y-1">
                <h3 className="font-bold text-gray-900 text-xs">Workshop Details</h3>
                {product.workshop_date && (
                  <p className="text-xs text-gray-700">
                    <span className="font-semibold">Date:</span>{' '}
                    {new Date(product.workshop_date).toLocaleDateString()}
                  </p>
                )}
                {product.duration_minutes && (
                  <p className="text-xs text-gray-700">
                    <span className="font-semibold">Duration:</span> {product.duration_minutes} min
                  </p>
                )}
                {product.age_min && product.age_max && (
                  <p className="text-xs text-gray-700">
                    <span className="font-semibold">Age:</span> {product.age_min}-{product.age_max} yrs
                  </p>
                )}
                {product.max_capacity && (
                  <p className="text-xs text-gray-700">
                    <span className="font-semibold">Capacity:</span> {product.max_capacity} pax
                  </p>
                )}
              </div>
            </div>
          )}

          {!loadingModifiers && modifierGroups.length > 0 && (
            <div className="px-4 pb-3 space-y-3">
              {modifierGroups.map(group => (
                <div key={group.id} className="bg-gray-50 p-3 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-gray-900 text-sm">{group.name}</h3>
                    {group.is_required && (
                      <span className="text-xs text-red-600 font-bold">*</span>
                    )}
                  </div>
                  {group.description && (
                    <p className="text-xs text-gray-600 mb-2">{group.description}</p>
                  )}
                  {group.modifier_type === 'multiple_choice' && (
                    <p className="text-xs text-gray-500 mb-2">
                      Select {group.min_selections > 0 ? `at least ${group.min_selections}` : 'options'}
                      {group.max_selections ? ` up to ${group.max_selections}` : ''}
                    </p>
                  )}

                  <div className="space-y-2">
                    {group.options.map(option => {
                      const isSelected = selectedModifiers[group.id]?.some(s => s.option_id === option.id);
                      const selectedOption = selectedModifiers[group.id]?.find(s => s.option_id === option.id);

                      return (
                        <label
                          key={option.id}
                          className={`flex items-center justify-between p-2 rounded-lg border-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (group.modifier_type === 'single_choice') {
                                  handleSingleChoiceSelect(group.id, option);
                                } else {
                                  handleMultipleChoiceToggle(group.id, option, group);
                                }
                              }}
                              className="w-4 h-4"
                            />
                            <span className="text-sm font-medium text-gray-900">{option.option_name}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {group.enable_quantity_selector && isSelected && selectedOption && (
                              <div className="flex items-center gap-1.5 relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleQuantityChange(group.id, option.id, -1);
                                  }}
                                  className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 active:scale-95 flex items-center justify-center transition-all shadow-sm"
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="w-3.5 h-3.5 text-gray-700" />
                                </button>
                                <span className="text-sm font-bold text-gray-900 w-8 text-center bg-gray-50 py-1 rounded">
                                  {selectedOption.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleQuantityChange(group.id, option.id, 1);
                                  }}
                                  className="w-7 h-7 rounded-lg bg-primary-500 hover:bg-primary-600 active:scale-95 text-white flex items-center justify-center transition-all shadow-sm"
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                                {showQuantityHint === group.id && (
                                  <div className="absolute -top-10 left-0 bg-primary-600 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap animate-bounce z-10">
                                    Use +/- to adjust quantity
                                    <div className="absolute bottom-0 left-8 transform translate-y-1/2 rotate-45 w-2 h-2 bg-primary-600"></div>
                                  </div>
                                )}
                              </div>
                            )}
                            <span className="text-sm font-bold text-gray-900">
                              {option.addon_price > 0 ? `+RM ${option.addon_price.toFixed(2)}` : 'Free'}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {modifierErrors.length > 0 && (
            <div className="px-4 pb-3">
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3">
                {modifierErrors.map((error, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-800 font-medium">{error}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 bg-white p-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2 flex-1">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="w-9 h-9 rounded-lg bg-white disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 font-bold hover:bg-gray-100 transition-colors flex items-center justify-center shadow-sm"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="flex-1 text-center">
                <div className="text-[10px] text-gray-500 font-medium">Quantity</div>
                <div className="text-lg font-black text-gray-900">{quantity}</div>
              </div>
              <button
                onClick={() => setQuantity(quantity + 1)}
                disabled={product.stock !== undefined && quantity >= product.stock}
                className="w-9 h-9 rounded-lg bg-primary-500 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold hover:bg-primary-600 transition-colors flex items-center justify-center shadow-sm"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl p-2 min-w-[100px]">
              <div className="text-[10px] text-white/80 font-medium text-center">Total</div>
              <div className="text-lg font-black text-white text-center">
                RM {getTotalPrice().toFixed(2)}
              </div>
            </div>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={addingToCart || (product.stock !== undefined && product.stock <= 0)}
            className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
          >
            {addingToCart ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Adding...
              </>
            ) : product.stock !== undefined && product.stock <= 0 ? (
              'Out of Stock'
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                Add to Cart
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;
