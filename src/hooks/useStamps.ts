import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface StampsTracking {
  id: string;
  user_id: string;
  total_stamps_earned: number;
  current_stamps: number;
  ice_cream_redeemed_count: number;
  boba_redeemed_count: number;
  last_stamp_earned_at: string | null;
  created_at: string;
  updated_at: string;
}

interface StampHistory {
  id: string;
  user_id: string;
  stamps_earned: number;
  source: 'ticket_purchase' | 'checkin_bonus' | 'promotion' | 'admin_grant';
  is_free_ticket: boolean;
  reference_id: string | null;
  metadata: Record<string, any>;
  earned_at: string;
}

interface StampRedemption {
  id: string;
  user_id: string;
  redemption_type: 'ice_cream' | 'ramen';
  stamps_spent: number;
  flavor_selection: string | null;
  qr_code: string;
  order_id: string | null;
  redeemed_at: string;
  used_at: string | null;
  expires_at: string;
  status: 'pending' | 'used' | 'expired' | 'cancelled';
}

export const useStamps = () => {
  const { user } = useAuth();
  const [stampsTracking, setStampsTracking] = useState<StampsTracking | null>(null);
  const [history, setHistory] = useState<StampHistory[]>([]);
  const [redemptions, setRedemptions] = useState<StampRedemption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadStampsData();
    }
  }, [user]);

  // Auto-refresh stamps data when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        console.log('[useStamps] Page visible, refreshing stamps data');
        loadStampsData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  const loadStampsData = async () => {
    if (!user) return;

    try {
      const [trackingResult, historyResult, redemptionsResult] = await Promise.all([
        supabase
          .from('stamps_tracking')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('stamps_history')
          .select('*')
          .eq('user_id', user.id)
          .order('earned_at', { ascending: false })
          .limit(50),
        supabase
          .from('stamps_redemptions')
          .select('*')
          .eq('user_id', user.id)
          .order('redeemed_at', { ascending: false })
          .limit(20),
      ]);

      if (trackingResult.data) {
        setStampsTracking(trackingResult.data);
      } else {
        const newTracking = await initializeStampsTracking();
        setStampsTracking(newTracking);
      }

      setHistory(historyResult.data || []);
      setRedemptions(redemptionsResult.data || []);
    } catch (error) {
      console.error('Error loading stamps data:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeStampsTracking = async (): Promise<StampsTracking | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('stamps_tracking')
        .insert({
          user_id: user.id,
          total_stamps_earned: 0,
          current_stamps: 0,
          ice_cream_redeemed_count: 0,
          boba_redeemed_count: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error initializing stamps tracking:', error);
      return null;
    }
  };

  const awardStamps = async (
    stampsCount: number,
    source: StampHistory['source'],
    referenceId: string | null = null,
    metadata: Record<string, any> = {}
  ) => {
    if (!user || stampsCount <= 0) return false;

    try {
      let tracking = stampsTracking;
      if (!tracking) {
        tracking = await initializeStampsTracking();
        if (!tracking) throw new Error('Failed to initialize stamps tracking');
      }

      const newCurrentStamps = (tracking.current_stamps + stampsCount) % 10;
      const newTotalStamps = tracking.total_stamps_earned + stampsCount;

      await supabase
        .from('stamps_tracking')
        .update({
          total_stamps_earned: newTotalStamps,
          current_stamps: newCurrentStamps,
          last_stamp_earned_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      await supabase.from('stamps_history').insert({
        user_id: user.id,
        stamps_earned: stampsCount,
        source,
        is_free_ticket: false,
        reference_id: referenceId,
        metadata,
      });

      await loadStampsData();
      return true;
    } catch (error) {
      console.error('Error awarding stamps:', error);
      return false;
    }
  };

  const redeemStamps = async (
    redemptionType: 'ice_cream' | 'ramen',
    flavorSelection: string
  ): Promise<{ success: boolean; qrCode?: string; orderId?: string; error?: string }> => {
    if (!user || !stampsTracking) {
      return { success: false, error: 'User not authenticated or stamps not loaded' };
    }

    const requiredStamps = redemptionType === 'ice_cream' ? 5 : 10;

    if (stampsTracking.current_stamps < requiredStamps) {
      return { success: false, error: `Not enough stamps. You need ${requiredStamps} stamps.` };
    }

    try {
      const timestamp = Date.now();
      const qrCode = `STAMP-${redemptionType.toUpperCase()}-${timestamp}-${user.id.substring(0, 8)}`;
      const orderNumber = `STAMP${timestamp.toString().slice(-8)}`;

      // Get first outlet ID for the order
      const { data: outlets } = await supabase
        .from('outlets')
        .select('id')
        .limit(1)
        .single();

      if (!outlets) throw new Error('No outlet found');

      // Get product ID based on redemption type
      const productName = redemptionType === 'ice_cream' ? 'Ice Cream Sundae' : 'Fried Noodles';
      const { data: product } = await supabase
        .from('shop_products')
        .select('id, name')
        .eq('name', productName)
        .limit(1)
        .maybeSingle();

      if (!product) throw new Error(`Product ${productName} not found`);

      // Create order with RM0.00
      const { data: order, error: orderError } = await supabase
        .from('shop_orders')
        .insert({
          user_id: user.id,
          outlet_id: outlets.id,
          order_number: orderNumber,
          total_amount: 0,
          subtotal: 0,
          discount_amount: 0,
          payment_method: 'free_reward',
          status: 'pending',
          qr_code: qrCode,
          items: [{
            product_id: product.id,
            product_name: `Free ${redemptionType === 'ice_cream' ? 'Ice Cream' : 'Ramen'} (Stamp Reward)`,
            quantity: 1,
            unit_price: 0,
            total: 0,
            metadata: {
              flavor: flavorSelection,
              is_free_reward: true
            }
          }],
          metadata: {
            redemption_type: redemptionType,
            flavor: flavorSelection,
            stamps_used: requiredStamps,
            is_stamp_redemption: true
          }
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create redemption record
      const { error: redemptionError } = await supabase
        .from('stamps_redemptions')
        .insert({
          user_id: user.id,
          redemption_type: redemptionType,
          stamps_spent: requiredStamps,
          flavor_selection: flavorSelection,
          qr_code: qrCode,
          order_id: order.id,
          status: 'pending',
        });

      if (redemptionError) throw redemptionError;

      const newCurrentStamps = stampsTracking.current_stamps - requiredStamps;
      const updateData: any = {
        current_stamps: newCurrentStamps,
      };

      if (redemptionType === 'ice_cream') {
        updateData.ice_cream_redeemed_count = stampsTracking.ice_cream_redeemed_count + 1;
      } else {
        updateData.boba_redeemed_count = stampsTracking.boba_redeemed_count + 1;
      }

      const { error: updateError } = await supabase
        .from('stamps_tracking')
        .update(updateData)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      await loadStampsData();
      return { success: true, qrCode, orderId: order.id };
    } catch (error) {
      console.error('Error redeeming stamps:', error);
      return { success: false, error: 'Failed to process redemption. Please try again.' };
    }
  };

  const calculateStampsFromOrder = (orderItems: any[]): number => {
    let totalStamps = 0;

    for (const item of orderItems) {
      const productName = item.product_name?.toLowerCase() || '';
      const metadata = item.metadata || {};

      const isTicket = productName.includes('ticket') ||
                       productName.includes('entry') ||
                       productName.includes('pass') ||
                       metadata.is_ticket === true;

      const isFreeTicket = metadata.is_free === true ||
                          metadata.price === 0 ||
                          item.unit_price === 0;

      if (isTicket && !isFreeTicket) {
        totalStamps += item.quantity;
      }
    }

    return totalStamps;
  };

  const getProgressToIceCream = () => {
    if (!stampsTracking) return { current: 0, needed: 5, percentage: 0 };
    const current = Math.min(stampsTracking.current_stamps, 5);
    return {
      current,
      needed: 5,
      percentage: (current / 5) * 100,
    };
  };

  const getProgressToRamen = () => {
    if (!stampsTracking) return { current: 0, needed: 10, percentage: 0 };
    const current = stampsTracking.current_stamps;
    return {
      current,
      needed: 10,
      percentage: (current / 10) * 100,
    };
  };

  const canRedeemIceCream = stampsTracking ? stampsTracking.current_stamps >= 5 : false;
  const canRedeemRamen = stampsTracking ? stampsTracking.current_stamps >= 10 : false;

  return {
    stampsTracking,
    currentStamps: stampsTracking?.current_stamps || 0,
    totalStampsEarned: stampsTracking?.total_stamps_earned || 0,
    iceCreamRedeemed: stampsTracking?.ice_cream_redeemed_count || 0,
    ramenRedeemed: stampsTracking?.boba_redeemed_count || 0,
    history,
    redemptions,
    loading,
    canRedeemIceCream,
    canRedeemRamen,
    awardStamps,
    redeemStamps,
    calculateStampsFromOrder,
    getProgressToIceCream,
    getProgressToRamen,
    refresh: loadStampsData,
  };
};
