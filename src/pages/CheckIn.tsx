import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useStars } from '../hooks/useStars';
import { useStamps } from '../hooks/useStamps';
import { voucherService } from '../services/voucherService';
import { supabase } from '../lib/supabase';
import { ArrowLeft, QrCode, Sparkles, CheckCircle, Ticket, Star, Trophy, Calendar, Gift } from 'lucide-react';
import QRCodeDisplay from '../components/QRCodeDisplay';

const CheckIn: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { earnStars } = useStars();
  const { awardStamps } = useStamps();
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [stampsEarned, setStampsEarned] = useState(0);
  const [checkInDate, setCheckInDate] = useState<Date | null>(null);
  const [checkInQR, setCheckInQR] = useState<string>('');
  const [voucherReceived, setVoucherReceived] = useState(false);
  const [voucherMessage, setVoucherMessage] = useState('');

  const handleCheckIn = async () => {
    if (!user) return;

    setScanning(true);

    setTimeout(async () => {
      try {
        const hour = new Date().getHours();
        const isOffPeak = hour < 13;
        const baseStars = 10;
        const bonusStars = isOffPeak ? 5 : 0;
        const totalStars = baseStars + bonusStars;

        const starsEarned = await earnStars(totalStars, 'Check-in', { isOffPeak });

        const checkInData = await supabase.from('check_ins').insert({
          user_id: user.id,
          location: 'Wonderpark',
          stars_earned: starsEarned || totalStars,
        }).select().single();

        const qrCodeValue = `CHECKIN-${user.id}-${Date.now()}`;
        setCheckInQR(qrCodeValue);
        setCheckInDate(new Date());

        const bonusStamp = isOffPeak ? 1 : 0;
        if (bonusStamp > 0) {
          await awardStamps(bonusStamp, 'checkin_bonus', checkInData.data?.id || null, {
            location: 'Wonderpark',
            isOffPeak,
            stars_earned: starsEarned || totalStars
          });
          setStampsEarned(bonusStamp);
        }

        const voucherResult = await voucherService.handleCheckinVoucher(user.id);
        if (voucherResult.success) {
          setVoucherReceived(true);
          setVoucherMessage(voucherResult.message || 'Daily F&B voucher received!');
        }

        setScanning(false);
        setSuccess(true);

        setTimeout(() => {
          navigate('/home');
        }, 3000);
      } catch (error) {
        console.error('Error checking in:', error);
        setScanning(false);
        alert('Failed to check in. Please try again.');
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen pb-28 pt-20">
      <div className="max-w-md mx-auto px-6 pt-8 space-y-8">
        <button
          onClick={() => navigate(-1)}
          className="p-3 glass rounded-xl hover:scale-105 transition-transform"
        >
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>

        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-gray-900">Check-In</h1>
          <p className="text-gray-600">Scan to earn your stars</p>
        </div>

        <div className="glass p-8 rounded-3xl space-y-8">
          {!success ? (
            <>
              <div className="relative">
                {!scanning ? (
                  <div className="w-48 h-48 mx-auto bg-gradient-to-br from-primary-500 to-primary-600 rounded-3xl flex items-center justify-center shadow-glow">
                    <QrCode className="w-24 h-24 text-white" />
                  </div>
                ) : (
                  <div className="w-48 h-48 mx-auto">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-32 h-1 bg-primary-500 animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!scanning ? (
                <button
                  onClick={handleCheckIn}
                  className="w-full py-4 gradient-primary text-white rounded-2xl font-semibold text-lg hover:scale-105 transition-transform shadow-glow"
                >
                  Simulate Scan
                </button>
              ) : (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 font-medium">Scanning...</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center space-y-6 animate-scale-in">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-glow animate-bounce-slow">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Checked In!</h2>
                <p className="text-gray-600">Stars have been added to your account</p>
                {checkInDate && (
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <p className="text-sm text-gray-500 font-medium">
                      {checkInDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      {' at '}
                      {checkInDate.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                )}
                {stampsEarned > 0 && (
                  <div className="mt-3 glass p-3 rounded-2xl bg-gradient-to-r from-amber-50 to-amber-100">
                    <div className="flex items-center justify-center gap-2">
                      <Ticket className="w-5 h-5 text-amber-600" />
                      <p className="text-sm font-bold text-amber-900">
                        +{stampsEarned} Bonus Stamp for off-peak check-in!
                      </p>
                    </div>
                  </div>
                )}
                {voucherReceived && (
                  <div className="mt-3 glass p-3 rounded-2xl bg-gradient-to-r from-orange-50 to-orange-100 border-2 border-orange-200">
                    <div className="flex items-center justify-center gap-2">
                      <Gift className="w-5 h-5 text-orange-600" />
                      <p className="text-sm font-bold text-orange-900">
                        {voucherMessage}
                      </p>
                    </div>
                    <p className="text-xs text-orange-700 text-center mt-1 font-medium">
                      Check Stars page to view your voucher!
                    </p>
                  </div>
                )}
              </div>

              {checkInQR && (
                <div className="glass p-4 rounded-2xl bg-white">
                  <p className="text-sm font-bold text-gray-900 mb-3">Your Check-In QR</p>
                  <QRCodeDisplay
                    value={checkInQR}
                    size={180}
                    level="M"
                    showValue={false}
                    allowEnlarge={true}
                  />
                </div>
              )}

              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-6 h-6 text-primary-600 animate-spin-slow" />
                <Sparkles className="w-8 h-8 text-primary-600 animate-pulse" />
                <Sparkles className="w-6 h-6 text-primary-600 animate-spin-slow" />
              </div>
            </div>
          )}
        </div>

        {!success && (
          <div className="glass p-6 rounded-3xl">
            <h3 className="font-bold text-gray-900 mb-3">Check-in Rewards</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <Star className="w-5 h-5 text-primary-600 flex-shrink-0" />
                <span className="font-medium">Earn 10 stars on every check-in</span>
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span className="font-medium">Check in before 1 PM for +5 bonus stars</span>
              </li>
              <li className="flex items-start gap-2">
                <Ticket className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span className="font-medium">Earn 1 bonus stamp when checking in before 1 PM</span>
              </li>
              <li className="flex items-start gap-2">
                <Gift className="w-5 h-5 text-orange-600 flex-shrink-0" />
                <span className="font-medium">Receive daily RM5 F&B voucher (once per day)</span>
              </li>
              <li className="flex items-start gap-2">
                <Trophy className="w-5 h-5 text-primary-600 flex-shrink-0" />
                <span className="font-medium">Your tier multiplier applies to check-in stars</span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckIn;
