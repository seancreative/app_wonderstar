import { supabase } from '../lib/supabase';
import { activityTimelineService } from './activityTimelineService';
import type { Voucher, UserVoucher, VoucherAutoRule } from '../types/database';

export const voucherService = {
  async getUserVouchers(userId: string, status?: 'available' | 'used' | 'expired'): Promise<UserVoucher[]> {
    try {
      // First, update expired vouchers
      await supabase
        .from('user_vouchers')
        .update({ status: 'expired' })
        .eq('user_id', userId)
        .eq('status', 'available')
        .lt('expires_at', new Date().toISOString())
        .not('expires_at', 'is', null);

      let query = supabase
        .from('user_vouchers')
        .select(`
          *,
          voucher:vouchers(
            id,
            code,
            title,
            description,
            voucher_type,
            value,
            free_gift_name,
            application_scope,
            product_application_method,
            min_purchase,
            max_uses,
            times_used,
            is_active,
            created_date,
            expires_at,
            eligible_product_ids,
            eligible_category_ids,
            eligible_subcategory_ids,
            restriction_type,
            max_products_per_use,
            is_daily_redeemable,
            usage_limit_per_user,
            user_daily_limit,
            outlet_restriction_type,
            applicable_outlet_ids,
            metadata
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data as any[]) || [];
    } catch (error) {
      console.error('Error fetching user vouchers:', error);
      return [];
    }
  },

  async redeemVoucherCode(userId: string, code: string): Promise<{ success: boolean; voucher?: UserVoucher; error?: string; message?: string }> {
    try {
      const { data: voucher, error: voucherError } = await supabase
        .from('vouchers')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single();

      if (voucherError || !voucher) {
        return { success: false, error: 'Invalid voucher code' };
      }

      if (voucher.is_daily_redeemable) {
        const { data: result, error: dailyError } = await supabase
          .rpc('redeem_daily_voucher', {
            user_uuid: userId,
            voucher_uuid: voucher.id,
            redemption_method: 'manual_code'
          });

        if (dailyError) {
          console.error('Error redeeming daily voucher:', dailyError);
          return { success: false, error: dailyError.message || 'Failed to redeem daily voucher' };
        }

        if (!result.success) {
          return { success: false, error: result.error || 'Failed to redeem daily voucher' };
        }

        const { data: userVoucher } = await supabase
          .from('user_vouchers')
          .select(`
            *,
            voucher:vouchers(
              id,
              code,
              title,
              description,
              voucher_type,
              value,
              free_gift_name,
              application_scope,
              product_application_method,
              min_purchase,
              max_uses,
              times_used,
              is_active,
              created_date,
              expires_at,
              eligible_product_ids,
              eligible_category_ids,
              eligible_subcategory_ids,
              restriction_type,
              max_products_per_use,
              is_daily_redeemable,
              usage_limit_per_user,
              metadata
            )
          `)
          .eq('id', result.user_voucher_id)
          .single();

        // Log activity
        await activityTimelineService.helpers.logVoucherRedemption(
          userId,
          voucher.code,
          voucher.title || 'Voucher'
        );

        return { success: true, voucher: userVoucher as any };
      }

      if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
        return { success: false, error: 'This voucher has expired' };
      }

      const { data: existingUserVoucher } = await supabase
        .from('user_vouchers')
        .select('*')
        .eq('user_id', userId)
        .eq('voucher_id', voucher.id)
        .maybeSingle();

      // Check if user already has this voucher
      if (existingUserVoucher) {
        // IMPORTANT: Always use the PARENT voucher's usage_limit_per_user as the source of truth
        // This ensures that if admin updates the voucher limit, existing users benefit from the new limit
        const parentVoucherLimit = voucher.usage_limit_per_user || 1;
        const storedMaxUsageCount = existingUserVoucher.max_usage_count || 1;
        const maxUsageCount = Math.max(parentVoucherLimit, storedMaxUsageCount);
        const currentUsageCount = existingUserVoucher.usage_count || 0;

        // If the parent voucher's limit is higher than what's stored, update the user_voucher record
        if (parentVoucherLimit > storedMaxUsageCount) {
          await supabase
            .from('user_vouchers')
            .update({
              max_usage_count: parentVoucherLimit,
              // Also reset status to available if they have uses remaining
              status: currentUsageCount < parentVoucherLimit ? 'available' : 'used'
            })
            .eq('id', existingUserVoucher.id);
        }

        // If user has remaining uses, return the existing voucher
        if (currentUsageCount < maxUsageCount) {
          // Voucher is still usable, return it as already available
          const { data: fullUserVoucher } = await supabase
            .from('user_vouchers')
            .select(`
              *,
              voucher:vouchers(
                id,
                code,
                title,
                description,
                voucher_type,
                value,
                free_gift_name,
                application_scope,
                product_application_method,
                min_purchase,
                max_uses,
                times_used,
                is_active,
                created_date,
                expires_at,
                eligible_product_ids,
                eligible_category_ids,
                eligible_subcategory_ids,
                restriction_type,
                max_products_per_use,
                is_daily_redeemable,
                usage_limit_per_user,
                outlet_restriction_type,
                applicable_outlet_ids,
                metadata
              )
            `)
            .eq('id', existingUserVoucher.id)
            .single();

          return {
            success: true,
            voucher: fullUserVoucher as any,
            message: `Voucher already in your wallet. You have ${maxUsageCount - currentUsageCount} uses remaining.`
          };
        }

        // User has exhausted all uses
        return { success: false, error: `You have already used this voucher ${currentUsageCount} time(s). Maximum ${maxUsageCount} uses allowed.` };
      }

      const { data: newUserVoucher, error: insertError } = await supabase
        .from('user_vouchers')
        .insert({
          user_id: userId,
          voucher_id: voucher.id,
          status: 'available',
          expires_at: voucher.expires_at,
          max_usage_count: voucher.usage_limit_per_user || 1,
          usage_count: 0,
          metadata: {
            redemption_method: 'manual_code',
            redeemed_code: code
          }
        })
        .select(`
          *,
          voucher:vouchers(
            id,
            code,
            title,
            description,
            voucher_type,
            value,
            application_scope,
            product_application_method,
            min_purchase,
            max_uses,
            times_used,
            is_active,
            created_date,
            expires_at,
            eligible_product_ids,
            eligible_category_ids,
            eligible_subcategory_ids,
            restriction_type,
            max_products_per_use,
            is_daily_redeemable,
            usage_limit_per_user,
            outlet_restriction_type,
            applicable_outlet_ids,
            metadata
          )
        `)
        .single();

      if (insertError) throw insertError;

      return { success: true, voucher: newUserVoucher as any };
    } catch (error: any) {
      console.error('Error redeeming voucher code:', error);
      return { success: false, error: error.message || 'Failed to redeem voucher' };
    }
  },

  async issueVoucherToUser(
    userId: string,
    voucherId: string,
    ruleId?: string,
    expiresIn?: number
  ): Promise<{ success: boolean; userVoucher?: UserVoucher; error?: string }> {
    try {
      const expiresAt = expiresIn
        ? new Date(Date.now() + expiresIn).toISOString()
        : undefined;

      const { data: newUserVoucher, error } = await supabase
        .from('user_vouchers')
        .insert({
          user_id: userId,
          voucher_id: voucherId,
          status: 'available',
          expires_at: expiresAt,
          issued_by_rule_id: ruleId,
          max_usage_count: 1,
          metadata: {
            auto_issued: true,
            issued_at: new Date().toISOString()
          }
        })
        .select(`
          *,
          voucher:vouchers(
            id,
            code,
            title,
            description,
            voucher_type,
            value,
            application_scope,
            product_application_method,
            min_purchase,
            max_uses,
            times_used,
            is_active,
            created_date,
            expires_at,
            eligible_product_ids,
            eligible_category_ids,
            eligible_subcategory_ids,
            restriction_type,
            max_products_per_use,
            is_daily_redeemable,
            usage_limit_per_user,
            outlet_restriction_type,
            applicable_outlet_ids,
            metadata
          )
        `)
        .single();

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'New Voucher Received!',
        message: `You've received a new voucher. Check your vouchers to use it!`,
        notification_type: 'voucher',
        is_read: false
      });

      return { success: true, userVoucher: newUserVoucher as any };
    } catch (error: any) {
      console.error('Error issuing voucher:', error);
      return { success: false, error: error.message };
    }
  },

  async handleFirstLoginVoucher(userId: string): Promise<void> {
    try {
      const { data: user } = await supabase
        .from('users')
        .select('first_login_at')
        .eq('id', userId)
        .single();

      if (user && !user.first_login_at) {
        await supabase
          .from('users')
          .update({ first_login_at: new Date().toISOString() })
          .eq('id', userId);

        const { data: rule } = await supabase
          .from('voucher_auto_rules')
          .select('*')
          .eq('trigger_type', 'first_login')
          .eq('is_active', true)
          .maybeSingle();

        if (rule && rule.voucher_template_id) {
          await this.issueVoucherToUser(userId, rule.voucher_template_id, rule.id);
        }
      }
    } catch (error) {
      console.error('Error handling first login voucher:', error);
    }
  },

  async handleTopupVoucher(userId: string, topupAmount: number): Promise<void> {
    try {
      const { data: rules } = await supabase
        .from('voucher_auto_rules')
        .select('*')
        .eq('trigger_type', 'topup_amount')
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (!rules) return;

      for (const rule of rules) {
        const ruleAmount = rule.trigger_conditions?.amount || 0;
        if (topupAmount >= ruleAmount && rule.voucher_template_id) {
          await this.issueVoucherToUser(userId, rule.voucher_template_id, rule.id);
          break;
        }
      }
    } catch (error) {
      console.error('Error handling topup voucher:', error);
    }
  },

  async handleCheckinVoucher(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const { data: canReceive } = await supabase
        .rpc('can_receive_checkin_voucher', { user_uuid: userId });

      if (!canReceive) {
        return { success: false, message: 'You have already received your daily check-in voucher' };
      }

      const { data: rule } = await supabase
        .from('voucher_auto_rules')
        .select('*')
        .eq('trigger_type', 'daily_checkin')
        .eq('is_active', true)
        .maybeSingle();

      if (rule && rule.voucher_template_id) {
        const expiryTime = 24 * 60 * 60 * 1000;
        await this.issueVoucherToUser(userId, rule.voucher_template_id, rule.id, expiryTime);

        await supabase
          .from('users')
          .update({ last_checkin_voucher_date: new Date().toISOString().split('T')[0] })
          .eq('id', userId);

        return { success: true, message: 'Daily F&B voucher received!' };
      }

      return { success: false, message: 'No check-in voucher available' };
    } catch (error) {
      console.error('Error handling checkin voucher:', error);
      return { success: false, message: 'Failed to issue check-in voucher' };
    }
  },

  async applyVoucherToProduct(
    userVoucherId: string,
    userId: string,
    productId: string,
    productName: string,
    originalPrice: number
  ): Promise<{ success: boolean; discount?: number; finalPrice?: number; error?: string }> {
    try {
      // First check daily limit using database function
      const { data: dailyCheck, error: dailyError } = await supabase
        .rpc('check_daily_voucher_limit', { user_voucher_uuid: userVoucherId });

      if (dailyError) {
        console.error('Error checking daily limit:', dailyError);
        return { success: false, error: 'Failed to validate voucher' };
      }

      if (!dailyCheck.can_use) {
        return { success: false, error: dailyCheck.error_message };
      }

      const { data: userVoucher, error: fetchError } = await supabase
        .from('user_vouchers')
        .select(`
          *,
          voucher:vouchers(
            id,
            code,
            title,
            description,
            voucher_type,
            value,
            application_scope,
            product_application_method,
            min_purchase,
            max_uses,
            times_used,
            is_active,
            created_date,
            expires_at,
            eligible_product_ids,
            eligible_category_ids,
            eligible_subcategory_ids,
            restriction_type,
            max_products_per_use,
            is_daily_redeemable,
            usage_limit_per_user,
            user_daily_limit,
            outlet_restriction_type,
            applicable_outlet_ids,
            metadata
          )
        `)
        .eq('id', userVoucherId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !userVoucher) {
        return { success: false, error: 'Voucher not found' };
      }

      const voucher = (userVoucher as any).voucher;

      if (voucher.application_scope !== 'product_level') {
        return { success: false, error: 'This voucher can only be applied at checkout' };
      }

      if (voucher.eligible_product_ids && voucher.eligible_product_ids.length > 0) {
        if (!voucher.eligible_product_ids.includes(productId)) {
          return { success: false, error: 'This voucher is not valid for this product' };
        }
      }

      let discount = 0;
      let finalPrice = originalPrice;

      if (voucher.voucher_type === 'percent') {
        discount = (originalPrice * voucher.value) / 100;
        finalPrice = originalPrice - discount;
      } else if (voucher.voucher_type === 'amount') {
        discount = Math.min(voucher.value, originalPrice);
        finalPrice = originalPrice - discount;
      } else if (voucher.voucher_type === 'b1f1') {
        discount = originalPrice;
        finalPrice = 0;
      }

      return {
        success: true,
        discount: parseFloat(discount.toFixed(2)),
        finalPrice: parseFloat(finalPrice.toFixed(2))
      };
    } catch (error: any) {
      console.error('Error applying voucher to product:', error);
      return { success: false, error: error.message };
    }
  },

  async validateOrderVoucher(
    userVoucherId: string,
    userId: string,
    orderTotal: number,
    productIds: string[]
  ): Promise<{ valid: boolean; discount?: number; error?: string }> {
    try {
      // First check daily limit using database function
      const { data: dailyCheck, error: dailyError } = await supabase
        .rpc('check_daily_voucher_limit', { user_voucher_uuid: userVoucherId });

      if (dailyError) {
        console.error('Error checking daily limit:', dailyError);
        return { valid: false, error: 'Failed to validate voucher' };
      }

      if (!dailyCheck.can_use) {
        return { valid: false, error: dailyCheck.error_message };
      }

      const { data: userVoucher } = await supabase
        .from('user_vouchers')
        .select(`
          *,
          voucher:vouchers(
            id,
            code,
            title,
            description,
            voucher_type,
            value,
            application_scope,
            product_application_method,
            min_purchase,
            max_uses,
            times_used,
            is_active,
            created_date,
            expires_at,
            eligible_product_ids,
            eligible_category_ids,
            eligible_subcategory_ids,
            restriction_type,
            max_products_per_use,
            is_daily_redeemable,
            usage_limit_per_user,
            user_daily_limit,
            outlet_restriction_type,
            applicable_outlet_ids,
            metadata
          )
        `)
        .eq('id', userVoucherId)
        .eq('user_id', userId)
        .single();

      if (!userVoucher) {
        return { valid: false, error: 'Voucher not found' };
      }

      const voucher = (userVoucher as any).voucher;

      if (voucher.application_scope !== 'order_total') {
        return { valid: false, error: 'This voucher must be applied to individual products' };
      }

      if (orderTotal < voucher.min_purchase) {
        return { valid: false, error: `Minimum purchase of RM${voucher.min_purchase} required` };
      }

      if (voucher.eligible_product_ids && voucher.eligible_product_ids.length > 0) {
        const hasEligibleProduct = productIds.some(id => voucher.eligible_product_ids.includes(id));
        if (!hasEligibleProduct) {
          return { valid: false, error: 'No eligible products in cart' };
        }
      }

      let discount = 0;
      if (voucher.voucher_type === 'percent') {
        discount = (orderTotal * voucher.value) / 100;
      } else if (voucher.voucher_type === 'amount') {
        discount = Math.min(voucher.value, orderTotal);
      }

      return {
        valid: true,
        discount: parseFloat(discount.toFixed(2))
      };
    } catch (error: any) {
      console.error('Error validating order voucher:', error);
      return { valid: false, error: error.message };
    }
  },

  async markVoucherAsUsed(userVoucherId: string, orderId?: string): Promise<void> {
    try {
      await supabase.rpc('use_user_voucher', { user_voucher_uuid: userVoucherId });
    } catch (error) {
      console.error('Error marking voucher as used:', error);
    }
  }
};
