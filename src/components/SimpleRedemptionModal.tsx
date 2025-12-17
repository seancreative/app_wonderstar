import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import NumericKeypad from './NumericKeypad';
import QRCodeDisplay from './QRCodeDisplay';
import { scanHistoryService } from '../services/scanHistoryService';

interface SimpleRedemptionModalProps {
  redemption: {
    id: string;
    type: 'gift_redemption' | 'stamp_redemption';
    qrCode: string;
    title: string;
    outlet_id?: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

const SimpleRedemptionModal: React.FC<SimpleRedemptionModalProps> = ({
  redemption,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'passcode' | 'confirm'>('passcode');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffPasscodeId, setStaffPasscodeId] = useState<string | null>(null);
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
          p_redemption_type: redemption.type === 'gift_redemption' ? 'gift' : 'stamp',
          p_redemption_id: redemption.id,
          p_user_id: null,
          p_outlet_id: redemption.outlet_id || null,
          p_items_redeemed: [],
          p_success: false,
          p_failure_reason: 'Invalid passcode entered',
          p_metadata: { passcode_entered: passcode }
        });
      } else {
        setStaffName(data.staff_name);
        setStaffPasscodeId(data.id);
        setStep('confirm');
      }
    } catch (err) {
      console.error('Error verifying passcode:', err);
      setError('Failed to verify passcode. Please try again.');
      setPasscode('');
    }
  };

  const handleRedeem = async () => {
    setRedeeming(true);
    setError('');

    try {
      if (redemption.type === 'gift_redemption') {
        const { error: updateError } = await supabase
          .from('redemptions')
          .update({ used_at: new Date().toISOString() })
          .eq('id', redemption.id);

        if (updateError) throw updateError;

        await supabase.rpc('log_staff_redemption', {
          p_staff_passcode_id: staffPasscodeId,
          p_redemption_type: 'gift',
          p_redemption_id: redemption.id,
          p_user_id: null,
          p_outlet_id: redemption.outlet_id || null,
          p_items_redeemed: [{ title: redemption.title, qr_code: redemption.qrCode }],
          p_success: true,
          p_failure_reason: null,
          p_metadata: { staff_name: staffName, redemption_title: redemption.title }
        });

        // Log to scan history for "Scan History" UI
        await scanHistoryService.logScan({
          scan_type: 'reward',
          qr_code: redemption.qrCode,
          scan_result: 'success',
          staff_id: staffPasscodeId || undefined,
          staff_name: staffName,
          outlet_id: redemption.outlet_id,
          success: true,
          scanned_at: new Date().toISOString(),
          metadata: {
            action: 'gift_redemption',
            redemption_title: redemption.title,
            redemption_id: redemption.id
          }
        });
      } else if (redemption.type === 'stamp_redemption') {
        const { error: updateError } = await supabase
          .from('stamps_redemptions')
          .update({
            status: 'used',
            used_at: new Date().toISOString()
          })
          .eq('id', redemption.id);

        if (updateError) throw updateError;

        await supabase.rpc('log_staff_redemption', {
          p_staff_passcode_id: staffPasscodeId,
          p_redemption_type: 'stamp',
          p_redemption_id: redemption.id,
          p_user_id: null,
          p_outlet_id: redemption.outlet_id || null,
          p_items_redeemed: [{ title: redemption.title, qr_code: redemption.qrCode }],
          p_success: true,
          p_failure_reason: null,
          p_metadata: { staff_name: staffName, redemption_title: redemption.title }
        });

        // Log to scan history for "Scan History" UI
        await scanHistoryService.logScan({
          scan_type: 'reward',
          qr_code: redemption.qrCode,
          scan_result: 'success',
          staff_id: staffPasscodeId || undefined,
          staff_name: staffName,
          outlet_id: redemption.outlet_id,
          success: true,
          scanned_at: new Date().toISOString(),
          metadata: {
            action: 'stamp_redemption',
            redemption_title: redemption.title,
            redemption_id: redemption.id
          }
        });
      }

      onSuccess();
    } catch (err) {
      console.error('Error redeeming:', err);
      setError('Failed to redeem. Please try again.');

      await supabase.rpc('log_staff_redemption', {
        p_staff_passcode_id: staffPasscodeId,
        p_redemption_type: redemption.type === 'gift_redemption' ? 'gift' : 'stamp',
        p_redemption_id: redemption.id,
        p_user_id: null,
        p_outlet_id: redemption.outlet_id || null,
        p_items_redeemed: [],
        p_success: false,
        p_failure_reason: err instanceof Error ? err.message : 'Unknown error',
        p_metadata: { redemption_title: redemption.title }
      });

      setRedeeming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass p-8 rounded-3xl max-w-md w-full shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black theme-text-primary">Staff Redemption</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6 text-gray-700" />
            </button>
          </div>

          {step === 'passcode' && (
            <div className="space-y-4">
              <div className="text-center p-4 bg-blue-50 rounded-2xl border border-blue-200">
                <Shield className="w-12 h-12 text-blue-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-blue-900">
                  Staff, please enter your 4-digit passcode
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-900 font-semibold">{error}</p>
                </div>
              )}

              <NumericKeypad
                value={passcode}
                onChange={setPasscode}
                maxLength={4}
              />
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="text-center p-4 bg-green-50 rounded-2xl border border-green-200">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-green-900">
                  Verified: {staffName}
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                <h3 className="font-black theme-text-primary mb-2">Confirm Redemption</h3>
                <p className="text-sm theme-text-secondary font-medium">{redemption.title}</p>
                <QRCodeDisplay
                  value={redemption.qrCode}
                  size={160}
                  level="M"
                  showValue={true}
                  allowEnlarge={false}
                  className="mx-auto"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-900 font-semibold">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-4 bg-gray-200 hover:bg-gray-300 rounded-2xl font-black text-gray-700 transition-colors"
                  disabled={redeeming}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRedeem}
                  disabled={redeeming}
                  className="flex-1 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl font-black hover:scale-105 transition-transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {redeeming ? 'Redeeming...' : 'Redeem Now'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleRedemptionModal;
