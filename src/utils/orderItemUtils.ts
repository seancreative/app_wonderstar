// Utility functions for displaying order items with detailed discount breakdown

export interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  item_discount_amount?: number;
  item_discount_type?: 'voucher' | 'tier' | 'bonus' | 'none';
  voucher_discount_amount?: number;
  tier_discount_amount?: number;
  total_price?: number;
  total?: number; // legacy field
  metadata?: {
    category?: string;
    category_id?: string;
    subcategory?: string;
    subcategory_id?: string;
    selected_modifiers?: SelectedModifier[];
    original_subtotal?: number;
    discount_breakdown?: {
      voucher: number;
      tier: number;
      total: number;
    };
  };
}

export interface SelectedModifier {
  modifier_group_id: string;
  group_name: string;
  modifier_type: 'single_choice' | 'multiple_choice';
  selected_options: {
    option_id: string;
    option_name: string;
    addon_price: number;
    quantity: number;
  }[];
}

/**
 * Calculate item's original subtotal (before any discounts)
 */
export const getItemOriginalSubtotal = (item: OrderItem): number => {
  return item.metadata?.original_subtotal || (item.unit_price * item.quantity);
};

/**
 * Get item's final price after discounts
 */
export const getItemFinalPrice = (item: OrderItem): number => {
  // Use total_price if available (new format)
  if (item.total_price !== undefined) {
    return item.total_price;
  }

  // Fall back to calculating from discount
  const originalSubtotal = getItemOriginalSubtotal(item);
  const discount = item.item_discount_amount || 0;
  return Math.max(0, originalSubtotal - discount);
};

/**
 * Get item's voucher discount amount
 */
export const getItemVoucherDiscount = (item: OrderItem): number => {
  return item.voucher_discount_amount ||
         item.metadata?.discount_breakdown?.voucher ||
         (item.item_discount_type === 'voucher' ? (item.item_discount_amount || 0) : 0);
};

/**
 * Get item's tier discount amount
 */
export const getItemTierDiscount = (item: OrderItem): number => {
  return item.tier_discount_amount ||
         item.metadata?.discount_breakdown?.tier ||
         (item.item_discount_type === 'tier' ? (item.item_discount_amount || 0) : 0);
};

/**
 * Get total discount for an item
 */
export const getItemTotalDiscount = (item: OrderItem): number => {
  return item.item_discount_amount ||
         item.metadata?.discount_breakdown?.total ||
         0;
};

/**
 * Check if item has any discount applied
 */
export const hasItemDiscount = (item: OrderItem): boolean => {
  return getItemTotalDiscount(item) > 0;
};

/**
 * Format modifier options for display
 */
export const formatModifierOptions = (modifier: SelectedModifier): string => {
  return modifier.selected_options
    .map(opt => {
      const price = opt.addon_price > 0 ? ` (+RM ${opt.addon_price.toFixed(2)})` : '';
      const qty = opt.quantity > 1 ? ` x${opt.quantity}` : '';
      return `${opt.option_name}${price}${qty}`;
    })
    .join(', ');
};

/**
 * Get all modifiers formatted for display
 */
export const getFormattedModifiers = (item: OrderItem): string[] => {
  if (!item.metadata?.selected_modifiers || item.metadata.selected_modifiers.length === 0) {
    return [];
  }

  return item.metadata.selected_modifiers.map(modifier => {
    return `${modifier.group_name}: ${formatModifierOptions(modifier)}`;
  });
};

/**
 * Calculate total addon price from modifiers
 */
export const calculateModifierAddons = (item: OrderItem): number => {
  if (!item.metadata?.selected_modifiers) {
    return 0;
  }

  return item.metadata.selected_modifiers.reduce((total, modifier) => {
    const modifierTotal = modifier.selected_options.reduce((sum, opt) => {
      return sum + (opt.addon_price * opt.quantity);
    }, 0);
    return total + modifierTotal;
  }, 0);
};

/**
 * Get base unit price (without modifiers)
 */
export const getBaseUnitPrice = (item: OrderItem): number => {
  const modifierAddons = calculateModifierAddons(item);
  return item.unit_price - modifierAddons;
};
