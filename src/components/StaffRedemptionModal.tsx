import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Package, User, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import NumericKeypad from './NumericKeypad';
import { scanHistoryService } from '../services/scanHistoryService';

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  metadata?: any;
}

interface ItemRedemption {
  id: string;
  item_index: number;
  product_name: string;
  quantity: number;
  redeemed_quantity: number;
  status: 'pending' | 'completed';
  redeemed_at: string | null;
}

interface QRCodeItem {
  id: string;
  type: string;
  qrCode: string;
  title: string;
  description: string;
  status: string;
  items?: OrderItem[];
  redemptions?: ItemRedemption[];
  outlet_id?: string;
}

interface StaffRedemptionModalProps {
  order: QRCodeItem;
  onClose: () => void;
  onSuccess: () => void;
}

const StaffRedemptionModal: React.FC<StaffRedemptionModalProps> = ({
  order,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'passcode' | 'checklist'>('passcode');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffPasscodeId, setStaffPasscodeId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (passcode.length === 4) {
      verifyPasscode();
    }
  }, [passcode]);

  const verifyPasscode = async () => {
    setError('');

    try {
      const { data, error: queryError } = await supabase
        .from('staff_passcodes')
        .select('id, staff_name, is_superadmin')
        .eq('passcode', passcode)
        .eq('is_active', true)
        .maybeSingle();

      if (queryError) throw queryError;

      if (!data) {
        setError('Invalid passcode. Please try again.');
        setPasscode('');

        await supabase.rpc('log_staff_redemption', {
          p_staff_passcode_id: null,
          p_redemption_type: 'order',
          p_redemption_id: order.id,
          p_user_id: null,
          p_outlet_id: order.outlet_id,
          p_items_redeemed: [],
          p_success: false,
          p_failure_reason: 'Invalid passcode entered',
          p_metadata: { passcode_entered: passcode }
        });
      } else {
        setStaffName(data.staff_name);
        setStaffPasscodeId(data.id);
        setStep('checklist');
        setSelectedItems(new Set());
      }
    } catch (err) {
      console.error('Error verifying passcode:', err);
      setError('Failed to verify passcode. Please try again.');
      setPasscode('');
    }
  };

  const toggleItem = (itemIndex: number) => {
    const redemption = order.redemptions?.find(r => r.item_index === itemIndex);
    if (redemption?.status === 'completed') {
      return;
    }

    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemIndex)) {
        newSet.delete(itemIndex);
      } else {
        newSet.add(itemIndex);
      }
      return newSet;
    });
  };

  const handleRedeem = async () => {
    if (selectedItems.size === 0) {
      setError('Please select at least one item to redeem');
      return;
    }

    setRedeeming(true);
    setError('');

    const itemsToRedeem: any[] = [];

    try {
      for (const itemIndex of Array.from(selectedItems)) {
        const redemption = order.redemptions?.find(r => r.item_index === itemIndex);
        if (!redemption || redemption.status === 'completed') continue;

        const item = order.items?.[itemIndex];
        if (item) {
          itemsToRedeem.push({
            item_index: itemIndex,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total
          });
        }

        const { error: updateError } = await supabase
          .from('order_item_redemptions')
          .update({
            status: 'completed',
            redeemed_quantity: redemption.quantity,
            redeemed_at: new Date().toISOString(),
            redeemed_at_outlet_id: order.outlet_id,
            redemption_method: 'scan'
          })
          .eq('id', redemption.id);

        if (updateError) throw updateError;
      }

      const allItemsRedeemed = order.redemptions?.every(r =>
        r.status === 'completed' || selectedItems.has(r.item_index)
      );

      if (allItemsRedeemed) {
        const { error: orderUpdateError } = await supabase
          .from('shop_orders')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            staff_name_last_action: staffName
          })
          .eq('id', order.id);

        if (orderUpdateError) {
          console.warn('Failed to update order status:', orderUpdateError);
        }
      }

      await supabase.rpc('log_staff_redemption', {
        p_staff_passcode_id: staffPasscodeId,
        p_redemption_type: 'order',
        p_redemption_id: order.id,
        p_user_id: null,
        p_outlet_id: order.outlet_id,
        p_items_redeemed: itemsToRedeem,
        p_success: true,
        p_failure_reason: null,
        p_metadata: {
          items_count: selectedItems.size,
          order_completed: allItemsRedeemed,
          staff_name: staffName
        }
      });

      // Log redemption completion to scan logs
      await scanHistoryService.logScan({
        scan_type: 'order',
        qr_code: order.qrCode || order.id,
        scan_result: allItemsRedeemed ? 'success' : 'partial',
        staff_id: staffPasscodeId || undefined,
        staff_name: staffName,
        order_id: order.id,
        order_number: order.title.replace('Order #', ''),
        outlet_id: order.outlet_id,
        outlet_name: order.outlet_name,
        items_redeemed: selectedItems.size,
        success: true,
        scanned_at: new Date().toISOString(),
        metadata: {
          action: 'redemption_completed',
          items_count: selectedItems.size,
          all_items_redeemed: allItemsRedeemed,
          items: itemsToRedeem
        }
      });

      onSuccess();
    } catch (err) {
      console.error('Error redeeming items:', err);
      setError('Failed to redeem items. Please try again.');

      await supabase.rpc('log_staff_redemption', {
        p_staff_passcode_id: staffPasscodeId,
        p_redemption_type: 'order',
        p_redemption_id: order.id,
        p_user_id: null,
        p_outlet_id: order.outlet_id,
        p_items_redeemed: itemsToRedeem,
        p_success: false,
        p_failure_reason: err instanceof Error ? err.message : 'Unknown error',
        p_metadata: { items_count: selectedItems.size }
      });
    } finally {
      setRedeeming(false);
    }
  };

  const pendingItems = order.redemptions?.filter(r => r.status === 'pending') || [];
  const completedItems = order.redemptions?.filter(r => r.status === 'completed') || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="glass p-6 rounded-3xl max-w-lg w-full shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black theme-text-primary flex items-center gap-2">
            {step === 'passcode' ? (
              <>
                <Shield className="w-7 h-7 text-primary-600" />
                Staff Verification
              </>
            ) : (
              <>
                <Package className="w-7 h-7 text-primary-600" />
                Redeem Items
              </>
            )}
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {step === 'passcode' && (
          <div className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700 font-semibold">{error}</p>
              </div>
            )}

            <NumericKeypad
              value={passcode}
              onChange={setPasscode}
              maxLength={4}
            />

            <button
              onClick={onClose}
              className="w-full py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {step === 'checklist' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
              <User className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-green-900">Verified Staff</p>
                <p className="text-xs text-green-700 font-semibold">{staffName}</p>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700 font-semibold">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              {pendingItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold theme-text-primary mb-3">
                    Pending Items ({pendingItems.length})
                  </h3>
                  <div className="space-y-2">
                    {order.items?.map((item, index) => {
                      const redemption = order.redemptions?.find(r => r.item_index === index);
                      if (redemption?.status === 'completed') return null;

                      const isSelected = selectedItems.has(index);

                      return (
                        <button
                          key={index}
                          onClick={() => toggleItem(index)}
                          className={`w-full flex items-start gap-3 p-4 rounded-xl transition-all border-2 ${
                            isSelected
                              ? 'bg-primary-50 border-primary-400'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                            isSelected
                              ? 'bg-primary-500 border-primary-500'
                              : 'bg-white border-gray-300'
                          }`}>
                            {isSelected && <CheckCircle className="w-5 h-5 text-white" />}
                          </div>
                          <div className="flex-1 text-left">
                            <p className={`text-sm font-bold ${
                              isSelected ? 'text-primary-900' : 'theme-text-primary'
                            }`}>
                              {item.product_name}
                            </p>
                            <p className="text-xs theme-text-secondary font-medium">
                              Qty: {item.quantity} • RM{(item.total_price || item.total || (item.unit_price * item.quantity)).toFixed(2)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {completedItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-green-900 mb-3">
                    Already Redeemed ({completedItems.length})
                  </h3>
                  <div className="space-y-2">
                    {order.items?.map((item, index) => {
                      const redemption = order.redemptions?.find(r => r.item_index === index);
                      if (redemption?.status !== 'completed') return null;

                      return (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-4 rounded-xl bg-green-50 border-2 border-green-200"
                        >
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 bg-green-500">
                            <CheckCircle className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-bold text-green-900">
                              {item.product_name}
                            </p>
                            <p className="text-xs text-green-700 font-medium">
                              Qty: {item.quantity} • RM{(item.total_price || item.total || (item.unit_price * item.quantity)).toFixed(2)}
                            </p>
                            {redemption?.redeemed_at && (
                              <p className="text-xs text-green-600 font-semibold mt-1">
                                {new Date(redemption.redeemed_at).toLocaleString('en-MY', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRedeem}
                disabled={selectedItems.size === 0 || redeeming}
                className="flex-1 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg"
              >
                {redeeming ? 'Redeeming...' : `Redeem ${selectedItems.size} Item${selectedItems.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffRedemptionModal;
