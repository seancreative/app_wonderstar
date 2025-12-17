import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { Scan, Star, CheckCircle, XCircle, Camera, X, LogOut, User, History, Filter, Calendar, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Html5Qrcode } from 'html5-qrcode';
import StaffRedemptionModal from '../../components/StaffRedemptionModal';
import SimpleRedemptionModal from '../../components/SimpleRedemptionModal';
import { scanHistoryService, type ScanLog } from '../../services/scanHistoryService';
import { formatDateTimeCMS } from '../../utils/dateFormatter';

interface ScanResult {
  success: boolean;
  userName?: string;
  starsEarned?: number;
  currentBalance?: number;
  tierName?: string;
  message: string;
  timestamp: Date;
}

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
  outlet_name?: string;
  outlet_location?: string;
  created_at?: string;
}

const StaffScanner: React.FC = () => {
  const navigate = useNavigate();
  const { staff, logout } = useStaffAuth();
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<QRCodeItem | null>(null);
  const [selectedReward, setSelectedReward] = useState<{ id: string; type: 'gift_redemption' | 'stamp_redemption'; qrCode: string; title: string; outlet_id?: string } | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanLog[]>([]);
  const [allScans, setAllScans] = useState<ScanLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'my_scans' | 'customer' | 'order' | 'reward'>('all');
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerInitialized = useRef(false);

  useEffect(() => {
    if (!staff) {
      navigate('/cms/login');
    } else {
      loadScanHistory();
    }
  }, [staff, navigate]);

  const loadScanHistory = async () => {
    if (!staff?.id) return;

    setLoadingHistory(true);
    try {
      // Load ALL scans from the system (single source of truth)
      const history = await scanHistoryService.getRecentScans(100);
      setAllScans(history);
      applyFilter(history, filterType);
    } catch (error) {
      console.error('Error loading scan history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const applyFilter = (scans: ScanLog[], filter: typeof filterType) => {
    let filtered = scans;

    if (filter === 'my_scans') {
      // Show only scans by this staff member
      filtered = scans.filter(scan => scan.staff_id === staff?.id);
    } else if (filter === 'customer' || filter === 'order' || filter === 'reward') {
      // Filter by scan type
      filtered = scans.filter(scan => scan.scan_type === filter);
    }
    // 'all' shows everything

    setScanHistory(filtered);
  };

  const handleFilterChange = (newFilter: typeof filterType) => {
    setFilterType(newFilter);
    applyFilter(allScans, newFilter);
  };

  const handleScan = async (scannedCode: string) => {
    if (!scannedCode.trim()) return;

    setScanning(true);
    setResult(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      // Priority 1: Check if it's a reward redemption QR code (RDM-* format)
      // These need to be checked FIRST to prevent false matches with UUID checks
      const { data: giftRedemption } = await supabase
        .from('redemptions')
        .select('*, rewards(name, description)')
        .eq('qr_code', scannedCode)
        .is('used_at', null)
        .maybeSingle();

      if (giftRedemption) {
        const reward = giftRedemption.rewards;
        const rewardTitle = `🎁 ${reward?.name || 'Gift Reward'}`;

        // Log reward scan
        await scanHistoryService.logScan({
          scan_type: 'reward',
          qr_code: scannedCode,
          scan_result: 'success',
          staff_id: staff?.id,
          staff_name: staff?.staff_name,
          staff_email: staff?.email,
          success: true,
          scanned_at: new Date().toISOString(),
          metadata: {
            redemption_title: rewardTitle,
            action: 'gift_redemption',
            reward_id: giftRedemption.id
          }
        });

        await loadScanHistory();
        setSelectedReward({
          id: giftRedemption.id,
          type: 'gift_redemption',
          qrCode: scannedCode,
          title: rewardTitle,
          outlet_id: undefined
        });
        stopScanning();
        return;
      }

      const { data: stampRedemption } = await supabase
        .from('stamps_redemptions')
        .select('*')
        .eq('qr_code', scannedCode)
        .eq('status', 'pending')
        .maybeSingle();

      if (stampRedemption) {
        const rewardTitle = stampRedemption.redemption_type === 'ice_cream' ? '🍦 Ice Cream Reward' : '🍜 Ramen Reward';

        // Log reward scan
        await scanHistoryService.logScan({
          scan_type: 'reward',
          qr_code: scannedCode,
          scan_result: 'success',
          staff_id: staff?.id,
          staff_name: staff?.staff_name,
          staff_email: staff?.email,
          success: true,
          scanned_at: new Date().toISOString(),
          metadata: {
            redemption_title: rewardTitle,
            action: 'stamp_redemption',
            redemption_id: stampRedemption.id
          }
        });

        await loadScanHistory();
        setSelectedReward({
          id: stampRedemption.id,
          type: 'stamp_redemption',
          qrCode: scannedCode,
          title: rewardTitle,
          outlet_id: undefined
        });
        stopScanning();
        return;
      }

      // Priority 2: Check if it's a customer check-in QR code (CHECKIN-{userId}-{timestamp})
      if (scannedCode.startsWith('CHECKIN-')) {
        const parts = scannedCode.split('-');
        if (parts.length >= 2) {
          const userId = parts[1];

          const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name, email, unique_id')
            .eq('id', userId)
            .maybeSingle();

          if (userError) throw userError;

          if (user) {
            const starsToAdd = 10;

            // Get current balance using helper function
            const { data: balanceData } = await supabase
              .rpc('get_user_stars_balance', { p_user_id: user.id });

            const currentBalance = balanceData || 0;
            const newBalance = currentBalance + starsToAdd;

            // Insert transaction record
            await supabase.from('stars_transactions').insert({
              user_id: user.id,
              amount: starsToAdd,
              transaction_type: 'earn',
              source: 'staff_scanner',
              description: 'Stars earned via Staff Scanner',
              balance_after: newBalance
            });

            // Log to scan history for "Scan History" UI
            await scanHistoryService.logScan({
              scan_type: 'customer',
              qr_code: scannedCode,
              scan_result: 'success',
              staff_id: staff?.id,
              staff_name: staff?.staff_name,
              staff_email: staff?.email,
              customer_id: user.id,
              customer_name: user.name || user.email,
              stars_awarded: starsToAdd,
              success: true,
              scanned_at: new Date().toISOString(),
              metadata: {
                base_stars: starsToAdd,
                new_balance: newBalance,
                source: 'staff_scanner'
              }
            });

            setResult({
              success: true,
              userName: user.name,
              starsEarned: starsToAdd,
              currentBalance: newBalance,
              message: `Successfully added ${starsToAdd} stars!`,
              timestamp: new Date()
            });

            await loadScanHistory();
            stopScanning();
            setTimeout(() => {
              setResult(null);
            }, 3000);
            return;
          }
        }
      }

      // Priority 3: Check if it's an order QR code (WP-* or UUID format)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isOrderQR = scannedCode.startsWith('WP-') || uuidRegex.test(scannedCode);

      if (isOrderQR) {
        await handleOrderQRScan(scannedCode);
        return;
      }

      // If we reach here, QR code format is not recognized
      throw new Error('QR code format not recognized. Please scan a valid order, reward, or check-in QR code.');
    } catch (error: any) {
      // Log failed scan
      await scanHistoryService.logScan({
        scan_type: 'customer',
        qr_code: scannedCode,
        scan_result: 'failure',
        staff_id: staff?.id,
        staff_name: staff?.staff_name,
        staff_email: staff?.email,
        success: false,
        failure_reason: error.message || 'Scan failed',
        scanned_at: new Date().toISOString(),
        metadata: {}
      });

      await loadScanHistory();
      setResult({
        success: false,
        message: error.message || 'Scan failed',
        timestamp: new Date()
      });
      stopScanning();
      setTimeout(() => {
        setResult(null);
      }, 3000);
    } finally {
      setScanning(false);
    }
  };

  const handleOrderQRScan = async (qrCode: string) => {
    try {
      let orderData = null;

      const { data: byQrCode, error: qrError } = await supabase
        .from('shop_orders')
        .select('*, outlets(name, location)')
        .eq('qr_code', qrCode)
        .maybeSingle();

      if (byQrCode) {
        orderData = byQrCode;
      } else {
        const { data: byOrderNumber, error: orderError } = await supabase
          .from('shop_orders')
          .select('*, outlets(name, location)')
          .eq('order_number', qrCode)
          .maybeSingle();

        if (byOrderNumber) {
          orderData = byOrderNumber;
        } else {
          const { data: byId } = await supabase
            .from('shop_orders')
            .select('*, outlets(name, location)')
            .eq('id', qrCode)
            .maybeSingle();

          orderData = byId;
        }
      }

      if (!orderData) {
        throw new Error('Order not found. Please check the QR code and try again.');
      }

      const { data: redemptions } = await supabase
        .from('order_item_redemptions')
        .select('*')
        .eq('order_id', orderData.id)
        .order('item_index');

      const totalItems = orderData.items?.length || 0;
      const redeemedItems = redemptions?.filter((r: any) => r.status === 'completed').length || 0;

      let orderStatus: 'active' | 'partial' | 'completed' = 'active';
      if (redeemedItems === totalItems && totalItems > 0) {
        orderStatus = 'completed';
      } else if (redeemedItems > 0) {
        orderStatus = 'partial';
      }

      const orderItem: QRCodeItem = {
        id: orderData.id,
        type: 'order',
        qrCode: orderData.qr_code || orderData.order_number || orderData.id,
        title: `Order #${orderData.order_number || orderData.id.slice(0, 8)}`,
        description: `RM${orderData.total_amount.toFixed(2)} • ${totalItems} item${totalItems !== 1 ? 's' : ''}`,
        status: orderStatus,
        items: orderData.items || [],
        redemptions: redemptions || [],
        outlet_id: orderData.outlet_id,
        outlet_name: orderData.outlets?.name || 'WonderStars',
        outlet_location: orderData.outlets?.location || '',
        created_at: orderData.created_at
      };

      // Log order scan to history
      await scanHistoryService.logScan({
        scan_type: 'order',
        qr_code: qrCode,
        scan_result: orderStatus === 'completed' ? 'success' : orderStatus === 'partial' ? 'partial' : 'success',
        staff_id: staff?.id,
        staff_name: staff?.staff_name,
        staff_email: staff?.email,
        order_id: orderData.id,
        order_number: orderData.order_number,
        customer_id: orderData.user_id,
        outlet_id: orderData.outlet_id,
        outlet_name: orderData.outlets?.name,
        items_redeemed: redeemedItems,
        success: true,
        scanned_at: new Date().toISOString(),
        metadata: {
          total_items: totalItems,
          redeemed_items: redeemedItems,
          order_status: orderStatus,
          total_amount: orderData.total_amount
        }
      });

      await loadScanHistory();
      setSelectedOrder(orderItem);
      stopScanning();
    } catch (error: any) {
      // Log failed order scan
      await scanHistoryService.logScan({
        scan_type: 'order',
        qr_code: qrCode,
        scan_result: 'failure',
        staff_id: staff?.id,
        staff_name: staff?.staff_name,
        staff_email: staff?.email,
        success: false,
        failure_reason: error.message || 'Order not found',
        scanned_at: new Date().toISOString(),
        metadata: {}
      });

      await loadScanHistory();
      setResult({
        success: false,
        message: error.message || 'Unable to load order details. Please try again.',
        timestamp: new Date()
      });
      stopScanning();
      setTimeout(() => {
        setResult(null);
      }, 3000);
    }
  };

  const startScanning = async () => {
    setCameraError('');
    setShowCameraScanner(true);

    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const scannerId = 'qr-reader';
      const html5QrCode = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          handleScan(decodedText);
        },
        () => {}
      );

      scannerInitialized.current = true;
    } catch (err: any) {
      setCameraError(err.message || 'Failed to start camera');
      setShowCameraScanner(false);
    }
  };

  const stopScanning = async () => {
    if (html5QrCodeRef.current && scannerInitialized.current) {
      try {
        await html5QrCodeRef.current.stop();
        scannerInitialized.current = false;
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setShowCameraScanner(false);
  };

  const handleLogout = () => {
    stopScanning();
    logout();
    navigate('/cms/login');
  };

  const handleRedemptionSuccess = async () => {
    setSelectedOrder(null);
    setResult({
      success: true,
      message: 'Order items redeemed successfully!',
      timestamp: new Date()
    });
    await loadScanHistory();
    setTimeout(() => {
      setResult(null);
    }, 3000);
  };

  const handleCloseRedemption = () => {
    setSelectedOrder(null);
  };

  if (!staff) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-700">
      <div className="sticky top-0 z-50 bg-white shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Scan className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900">Star Scanner</h1>
              <p className="text-sm text-gray-600">{staff.staff_name}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-all active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {result && (
          <div
            className={`p-6 rounded-2xl shadow-xl animate-fade-in ${
              result.success
                ? 'bg-green-50 border-2 border-green-200'
                : 'bg-red-50 border-2 border-red-200'
            }`}
          >
            <div className="flex items-start gap-4">
              {result.success ? (
                <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
              ) : (
                <XCircle className="w-8 h-8 text-red-600 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className={`text-lg font-bold ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                  {result.message}
                </p>
                {result.success && result.userName && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-gray-700">
                      <User className="w-4 h-4" />
                      <span className="font-semibold">{result.userName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                      <span className="text-xl font-black text-gray-900">
                        +{result.starsEarned} Stars
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      New Balance: <span className="font-bold">{result.currentBalance} stars</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!showCameraScanner && !result && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <button
              onClick={startScanning}
              disabled={scanning}
              className="w-full py-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-black text-xl shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3"
            >
              <Camera className="w-8 h-8" />
              {scanning ? 'Scanning...' : 'Start Camera Scanner'}
            </button>

            {cameraError && (
              <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                <p className="text-sm text-red-800 font-semibold">{cameraError}</p>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <History className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-black text-gray-900">Scan History</h2>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filterType}
                onChange={(e) => handleFilterChange(e.target.value as typeof filterType)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Scans</option>
                <option value="my_scans">My Scans Only</option>
                <option value="customer">Customer Check-ins</option>
                <option value="order">Order Scans</option>
                <option value="reward">Reward Redemptions</option>
              </select>
            </div>
          </div>

          <div className="mb-4 text-sm text-gray-600">
            Showing {scanHistory.length} of {allScans.length} scans
          </div>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : scanHistory.length === 0 ? (
            <div className="text-center py-12">
              <Scan className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-semibold">No scans yet</p>
              <p className="text-sm text-gray-400 mt-1">Scan history will appear here</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {scanHistory.map((scan) => (
                <div
                  key={scan.id}
                  className={`p-4 rounded-xl border-2 ${
                    scan.scan_result === 'success'
                      ? 'bg-green-50 border-green-200'
                      : scan.scan_result === 'partial'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                          scan.scan_type === 'customer'
                            ? 'bg-blue-100 text-blue-700'
                            : scan.scan_type === 'order'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {scan.scan_type.toUpperCase()}
                        </span>
                        <p className={`font-bold text-sm ${
                          scan.scan_result === 'success' ? 'text-green-900' :
                          scan.scan_result === 'partial' ? 'text-yellow-900' :
                          'text-red-900'
                        }`}>
                          {scan.scan_type === 'reward'
                            ? (scan.metadata?.redemption_title || 'Reward Redemption')
                            : (scan.customer_name || scan.order_number || 'Unknown')
                          }
                        </p>
                      </div>

                      {scan.scan_type === 'customer' && scan.stars_awarded && scan.stars_awarded > 0 && (
                        <p className="text-sm text-green-700 font-semibold flex items-center gap-1">
                          <Star className="w-4 h-4" fill="currentColor" />
                          +{scan.stars_awarded} stars
                        </p>
                      )}

                      {scan.scan_type === 'order' && (
                        <p className="text-sm text-gray-700">
                          {scan.items_redeemed || 0}/{scan.metadata?.total_items || 0} items redeemed
                        </p>
                      )}

                      {scan.scan_type === 'reward' && scan.metadata?.action && (
                        <p className="text-sm text-orange-700 font-semibold">
                          {scan.metadata.action === 'gift_redemption' ? '🎁 Gift Reward' : '🎟️ Stamp Reward'}
                        </p>
                      )}

                      {!scan.success && scan.failure_reason && (
                        <p className="text-sm text-red-600 mt-1">{scan.failure_reason}</p>
                      )}

                      <div className="mt-2 space-y-1">
                        {(scan.staff_email || scan.admin_email) && (
                          <p className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                            <User className="w-3 h-3" />
                            Scanned by: {scan.staff_email || scan.admin_email}
                          </p>
                        )}
                        <p className="text-xs text-gray-600 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDateTimeCMS(scan.scanned_at)}
                        </p>
                      </div>
                    </div>
                    {scan.scan_result === 'success' ? (
                      <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                    ) : scan.scan_result === 'partial' ? (
                      <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCameraScanner && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex-shrink-0 bg-gray-900 px-4 py-3 flex items-center justify-between">
            <span className="text-white font-bold text-lg">Scan QR Code</span>
            <button
              onClick={stopScanning}
              className="w-10 h-10 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-colors active:scale-95"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
              <div id="qr-reader" className="rounded-2xl overflow-hidden shadow-2xl"></div>
              <p className="text-center text-white mt-4 text-sm">
                Position QR code within the frame
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedOrder && (
        <StaffRedemptionModal
          order={selectedOrder}
          onClose={handleCloseRedemption}
          onSuccess={handleRedemptionSuccess}
        />
      )}

      {selectedReward && (
        <SimpleRedemptionModal
          redemption={selectedReward}
          onClose={() => setSelectedReward(null)}
          onSuccess={async () => {
            setSelectedReward(null);
            setResult({
              success: true,
              message: 'Reward redeemed successfully!',
              timestamp: new Date()
            });
            await loadScanHistory();
            setTimeout(() => {
              setResult(null);
            }, 3000);
          }}
        />
      )}

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-3 px-4 z-10">
        <div className="text-center">
          <p className="text-xs text-gray-600">
            Developed & Powered by <span className="font-bold text-gray-900">CRAVE</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default StaffScanner;
