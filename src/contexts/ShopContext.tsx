import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface Outlet {
  id: string;
  name: string;
  location: string;
  status: string;
  address: string;
  image_url: string;
  cover_image_url?: string;
  slug?: string;
}

interface SelectedVoucher {
  id: string;
  code: string;
  title: string;
  voucher: any;
  usage_count: number;
  max_usage_count: number;
}

interface ShopContextType {
  selectedOutlet: Outlet | null;
  setSelectedOutlet: (outlet: Outlet | null) => void;
  cartCount: number;
  refreshCartCount: () => Promise<void>;
  clearOutlet: () => void;
  addToCart: (productId: string, productName: string, price: number, metadata?: any) => Promise<boolean>;
  selectedVoucher: SelectedVoucher | null;
  setSelectedVoucher: (voucher: SelectedVoucher | null) => void;
  clearVoucher: () => void;
  appliedBonusAmount: number;
  setAppliedBonusAmount: (amount: number) => void;
  clearBonus: () => void;
  getCartOutlet: () => Promise<Outlet | null>;
  clearCart: () => Promise<boolean>;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const ShopProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [selectedOutlet, setSelectedOutletState] = useState<Outlet | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [selectedVoucher, setSelectedVoucherState] = useState<SelectedVoucher | null>(null);
  const [appliedBonusAmount, setAppliedBonusAmount] = useState(0);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    if (user) {
      // Defer preferences loading to reduce initial API calls
      const loadDeferred = () => loadUserPreferences();
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(loadDeferred, { timeout: 2000 });
      } else {
        setTimeout(loadDeferred, 100);
      }
    } else {
      setPreferencesLoaded(true);
    }
  }, [user]);

  const loadUserPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('selected_outlet_id, outlets(id, name, location, status, address, image_url, cover_image_url, slug)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading preferences:', error);
        return;
      }

      if (data?.selected_outlet_id && data.outlets) {
        const outlet = data.outlets as any;
        setSelectedOutletState({
          id: outlet.id,
          name: outlet.name,
          location: outlet.location,
          status: outlet.status,
          address: outlet.address,
          image_url: outlet.image_url,
          cover_image_url: outlet.cover_image_url,
          slug: outlet.slug
        });
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    } finally {
      setPreferencesLoaded(true);
    }
  };

  useEffect(() => {
    if (user) {
      refreshCartCount();
    } else {
      setCartCount(0);
    }
  }, [user]);

  const setSelectedOutlet = async (outlet: Outlet | null) => {
    setSelectedOutletState(outlet);

    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          selected_outlet_id: outlet?.id || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error saving outlet preference:', error);
      }
    } catch (error) {
      console.error('Error updating outlet preference:', error);
    }
  };

  const clearOutlet = async () => {
    setSelectedOutletState(null);

    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({ selected_outlet_id: null, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error clearing outlet preference:', error);
      }
    } catch (error) {
      console.error('Error clearing outlet preference:', error);
    }
  };

  const setSelectedVoucher = async (voucher: SelectedVoucher | null) => {
    setSelectedVoucherState(voucher);

    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          selected_voucher_code: voucher?.code || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error saving voucher preference:', error);
      }
    } catch (error) {
      console.error('Error updating voucher preference:', error);
    }
  };

  const clearVoucher = async () => {
    setSelectedVoucherState(null);

    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({ selected_voucher_code: null, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error clearing voucher preference:', error);
      }
    } catch (error) {
      console.error('Error clearing voucher preference:', error);
    }
  };

  const clearBonus = () => {
    setAppliedBonusAmount(0);
  };

  const refreshCartCount = async () => {
    if (!user) {
      setCartCount(0);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('shop_cart_items')
        .select('quantity')
        .eq('user_id', user.id);

      if (error) throw error;
      const total = data?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      setCartCount(total);
    } catch (error) {
      console.error('Error loading cart count:', error);
      setCartCount(0);
    }
  };

  const getCartOutlet = async (): Promise<Outlet | null> => {
    if (!user) {
      return null;
    }

    try {
      const { data: cartItem, error: cartError } = await supabase
        .from('shop_cart_items')
        .select('outlet_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (cartError) throw cartError;
      if (!cartItem) return null;

      const { data: outlet, error: outletError } = await supabase
        .from('outlets')
        .select('*')
        .eq('id', cartItem.outlet_id)
        .maybeSingle();

      if (outletError) throw outletError;
      if (!outlet) return null;

      const outletWithSlug = {
        ...outlet,
        slug: outlet.location.toLowerCase().replace(/\s+/g, '-')
      };

      return outletWithSlug;
    } catch (error) {
      console.error('Error getting cart outlet:', error);
      return null;
    }
  };

  const clearCart = async (): Promise<boolean> => {
    if (!user) {
      return false;
    }

    try {
      const { error } = await supabase
        .from('shop_cart_items')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      await refreshCartCount();

      const { data: verifyData, error: verifyError } = await supabase
        .from('shop_cart_items')
        .select('id')
        .eq('user_id', user.id);

      if (verifyError) throw verifyError;

      if (verifyData && verifyData.length > 0) {
        console.error('Cart not fully cleared:', verifyData.length, 'items remaining');
        return false;
      }

      console.log('Cart cleared successfully and verified');
      return true;
    } catch (error) {
      console.error('Error clearing cart:', error);
      return false;
    }
  };

  const addToCart = async (productId: string, productName: string, price: number, metadata: any = {}) => {
    if (!user) {
      return false;
    }

    if (!selectedOutlet) {
      return false;
    }

    try {
      // Fetch product details to ensure we have category_id and subcategory_id
      const { data: product, error: productError } = await supabase
        .from('shop_products')
        .select('category_id, subcategory_id, category, subcategory')
        .eq('id', productId)
        .single();

      if (productError) {
        console.error('Error fetching product details:', productError);
      }

      const { data: existingItem, error: fetchError } = await supabase
        .from('shop_cart_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingItem) {
        const { error: updateError } = await supabase
          .from('shop_cart_items')
          .update({ quantity: existingItem.quantity + 1 })
          .eq('id', existingItem.id);

        if (updateError) throw updateError;
      } else {
        // Merge fetched product data with provided metadata
        const categoryValue = product?.category || metadata.category;
        const completeMetadata = {
          product_name: productName,
          category_id: product?.category_id || metadata.category_id,
          subcategory_id: product?.subcategory_id || metadata.subcategory_id,
          category: categoryValue,
          category_name: categoryValue, // Store both for compatibility
          subcategory: product?.subcategory || metadata.subcategory,
          ...metadata
        };

        const { error: insertError } = await supabase
          .from('shop_cart_items')
          .insert({
            user_id: user.id,
            outlet_id: selectedOutlet.id,
            product_id: productId,
            quantity: 1,
            unit_price: price,
            metadata: completeMetadata
          });

        if (insertError) throw insertError;
      }

      await refreshCartCount();
      return true;
    } catch (error) {
      console.error('Error adding to cart:', error);
      return false;
    }
  };

  return (
    <ShopContext.Provider value={{
      selectedOutlet,
      setSelectedOutlet,
      cartCount,
      refreshCartCount,
      clearOutlet,
      addToCart,
      selectedVoucher,
      setSelectedVoucher,
      clearVoucher,
      appliedBonusAmount,
      setAppliedBonusAmount,
      clearBonus,
      getCartOutlet,
      clearCart
    }}>
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const context = useContext(ShopContext);
  if (context === undefined) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
};
