import { supabase } from '../lib/supabase';

export interface ScanLog {
  id: string;
  staff_id?: string;
  staff_name?: string;
  staff_email?: string;
  admin_user_id?: string;
  admin_email?: string;
  scan_type: 'customer' | 'order' | 'workshop' | 'reward';
  qr_code: string;
  scan_result: 'success' | 'failure' | 'partial';
  customer_id?: string;
  customer_name?: string;
  order_id?: string;
  order_number?: string;
  outlet_id?: string;
  outlet_name?: string;
  stars_awarded?: number;
  items_redeemed?: number;
  success: boolean;
  failure_reason?: string;
  metadata?: Record<string, any>;
  scanned_at: string;
  created_at: string;
}

export interface ScanStats {
  totalScans: number;
  successfulScans: number;
  failedScans: number;
  totalStarsAwarded: number;
  customerScans: number;
  orderScans: number;
}

export const scanHistoryService = {
  async getRecentScans(limit: number = 50, outletId?: string): Promise<ScanLog[]> {
    try {
      let query = supabase
        .from('staff_scan_logs')
        .select('*')
        .order('scanned_at', { ascending: false })
        .limit(limit);

      if (outletId) {
        query = query.eq('outlet_id', outletId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data as ScanLog[]) || [];
    } catch (error) {
      console.error('Error fetching recent scans:', error);
      return [];
    }
  },

  async getScansByType(
    scanType: 'customer' | 'order' | 'workshop' | 'reward',
    startDate?: Date,
    endDate?: Date
  ): Promise<ScanLog[]> {
    try {
      let query = supabase
        .from('staff_scan_logs')
        .select('*')
        .eq('scan_type', scanType)
        .order('scanned_at', { ascending: false });

      if (startDate) {
        query = query.gte('scanned_at', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('scanned_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data as ScanLog[]) || [];
    } catch (error) {
      console.error('Error fetching scans by type:', error);
      return [];
    }
  },

  async getScanStats(startDate?: Date, endDate?: Date): Promise<ScanStats> {
    try {
      let query = supabase.from('staff_scan_logs').select('*');

      if (startDate) {
        query = query.gte('scanned_at', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('scanned_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const scans = (data as ScanLog[]) || [];

      return {
        totalScans: scans.length,
        successfulScans: scans.filter(s => s.success).length,
        failedScans: scans.filter(s => !s.success).length,
        totalStarsAwarded: scans.reduce((sum, s) => sum + (s.stars_awarded || 0), 0),
        customerScans: scans.filter(s => s.scan_type === 'customer').length,
        orderScans: scans.filter(s => s.scan_type === 'order').length
      };
    } catch (error) {
      console.error('Error fetching scan stats:', error);
      return {
        totalScans: 0,
        successfulScans: 0,
        failedScans: 0,
        totalStarsAwarded: 0,
        customerScans: 0,
        orderScans: 0
      };
    }
  },

  async getCustomerScanHistory(customerId: string): Promise<ScanLog[]> {
    try {
      const { data, error } = await supabase
        .from('staff_scan_logs')
        .select('*')
        .eq('customer_id', customerId)
        .order('scanned_at', { ascending: false });

      if (error) throw error;
      return (data as ScanLog[]) || [];
    } catch (error) {
      console.error('Error fetching customer scan history:', error);
      return [];
    }
  },

  async getOrderScanHistory(orderId: string): Promise<ScanLog[]> {
    try {
      const { data, error } = await supabase
        .from('staff_scan_logs')
        .select('*')
        .eq('order_id', orderId)
        .order('scanned_at', { ascending: false });

      if (error) throw error;
      return (data as ScanLog[]) || [];
    } catch (error) {
      console.error('Error fetching order scan history:', error);
      return [];
    }
  },

  async getScansByStaffId(staffId: string, limit: number = 50): Promise<ScanLog[]> {
    try {
      const { data, error } = await supabase
        .from('staff_scan_logs')
        .select('*')
        .eq('staff_id', staffId)
        .order('scanned_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data as ScanLog[]) || [];
    } catch (error) {
      console.error('Error fetching scans by staff ID:', error);
      return [];
    }
  },

  async logScan(scanLog: Omit<ScanLog, 'id' | 'created_at'>): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('staff_scan_logs')
        .insert({
          staff_id: scanLog.staff_id,
          staff_name: scanLog.staff_name,
          staff_email: scanLog.staff_email,
          admin_user_id: scanLog.admin_user_id,
          admin_email: scanLog.admin_email,
          scan_type: scanLog.scan_type,
          qr_code: scanLog.qr_code,
          scan_result: scanLog.scan_result,
          customer_id: scanLog.customer_id,
          customer_name: scanLog.customer_name,
          order_id: scanLog.order_id,
          order_number: scanLog.order_number,
          outlet_id: scanLog.outlet_id,
          outlet_name: scanLog.outlet_name,
          stars_awarded: scanLog.stars_awarded || 0,
          items_redeemed: scanLog.items_redeemed || 0,
          success: scanLog.success,
          failure_reason: scanLog.failure_reason,
          metadata: scanLog.metadata || {},
          scanned_at: scanLog.scanned_at
        });

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Error logging scan:', error);
      return { success: false, error: error.message };
    }
  }
};
