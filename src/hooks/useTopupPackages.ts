import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { WalletTopupPackage } from '../types/database';

export const useTopupPackages = () => {
  const [packages, setPackages] = useState<WalletTopupPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPackages();

    const subscription = supabase
      .channel('wallet_topup_packages_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'wallet_topup_packages' },
        () => {
          loadPackages();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadPackages = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('wallet_topup_packages')
        .select('*')
        .order('display_order', { ascending: true });

      if (fetchError) throw fetchError;

      setPackages(data || []);
    } catch (err) {
      console.error('Error loading topup packages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  const createPackage = async (packageData: Omit<WalletTopupPackage, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error: insertError } = await supabase
        .from('wallet_topup_packages')
        .insert([packageData])
        .select()
        .single();

      if (insertError) throw insertError;

      return { success: true, data };
    } catch (err) {
      console.error('Error creating package:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create package'
      };
    }
  };

  const updatePackage = async (id: string, updates: Partial<Omit<WalletTopupPackage, 'id' | 'created_at' | 'updated_at'>>) => {
    console.log('[useTopupPackages] Updating package:', { id, updates });

    try {
      const { data, error: updateError } = await supabase
        .from('wallet_topup_packages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      console.log('[useTopupPackages] Update response:', { data, error: updateError });

      if (updateError) {
        console.error('[useTopupPackages] Update error:', updateError);
        throw updateError;
      }

      console.log('[useTopupPackages] Update successful:', data);
      return { success: true, data };
    } catch (err) {
      console.error('[useTopupPackages] Exception in updatePackage:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update package'
      };
    }
  };

  const deletePackage = async (id: string, soft: boolean = true) => {
    try {
      if (soft) {
        const { error: updateError } = await supabase
          .from('wallet_topup_packages')
          .update({ is_active: false })
          .eq('id', id);

        if (updateError) throw updateError;
      } else {
        const { error: deleteError } = await supabase
          .from('wallet_topup_packages')
          .delete()
          .eq('id', id);

        if (deleteError) throw deleteError;
      }

      return { success: true };
    } catch (err) {
      console.error('Error deleting package:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete package'
      };
    }
  };

  const getActivePackages = () => {
    return packages.filter(pkg => pkg.is_active);
  };

  return {
    packages,
    activePackages: getActivePackages(),
    loading,
    error,
    createPackage,
    updatePackage,
    deletePackage,
    refreshPackages: loadPackages
  };
};
