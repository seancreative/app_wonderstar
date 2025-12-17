import { useState, useEffect, useCallback } from 'react';
import { voucherService } from '../services/voucherService';
import type { UserVoucher } from '../types/database';

export const useVouchers = (userId: string | undefined) => {
  const [vouchers, setVouchers] = useState<UserVoucher[]>([]);
  const [availableVouchers, setAvailableVouchers] = useState<UserVoucher[]>([]);
  const [usedVouchers, setUsedVouchers] = useState<UserVoucher[]>([]);
  const [expiredVouchers, setExpiredVouchers] = useState<UserVoucher[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVouchers = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const allVouchers = await voucherService.getUserVouchers(userId);

      setVouchers(allVouchers);
      setAvailableVouchers(allVouchers.filter(v => v.status === 'available'));
      setUsedVouchers(allVouchers.filter(v => v.status === 'used'));
      setExpiredVouchers(allVouchers.filter(v => v.status === 'expired'));
    } catch (error) {
      console.error('Error loading vouchers:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadVouchers();
  }, [loadVouchers]);

  const redeemCode = async (code: string) => {
    if (!userId) return { success: false, error: 'User not logged in' };

    const result = await voucherService.redeemVoucherCode(userId, code);

    if (result.success) {
      await loadVouchers();
    }

    return result;
  };

  const applyToProduct = async (
    userVoucherId: string,
    productId: string,
    productName: string,
    originalPrice: number
  ) => {
    if (!userId) return { success: false, error: 'User not logged in' };

    return await voucherService.applyVoucherToProduct(
      userVoucherId,
      userId,
      productId,
      productName,
      originalPrice
    );
  };

  const validateForOrder = async (
    userVoucherId: string,
    orderTotal: number,
    productIds: string[]
  ) => {
    if (!userId) return { valid: false, error: 'User not logged in' };

    return await voucherService.validateOrderVoucher(
      userVoucherId,
      userId,
      orderTotal,
      productIds
    );
  };

  return {
    vouchers,
    availableVouchers,
    usedVouchers,
    expiredVouchers,
    loading,
    redeemCode,
    applyToProduct,
    validateForOrder,
    refresh: loadVouchers
  };
};
