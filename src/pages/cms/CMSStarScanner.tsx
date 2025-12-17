import React, { useState, useEffect, useRef } from 'react';
import CMSLayout from '../../components/cms/CMSLayout';
import { Scan, Star, CheckCircle, XCircle, AlertCircle, User, Calendar, Trophy, Camera, X, History } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDateTimeCMS } from '../../utils/dateFormatter';
import { Html5Qrcode } from 'html5-qrcode';
import StaffRedemptionModal from '../../components/StaffRedemptionModal';
import SimpleRedemptionModal from '../../components/SimpleRedemptionModal';
import { scanHistoryService, type ScanLog } from '../../services/scanHistoryService';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

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

const CMSStarScanner: React.FC = () => {
  const { admin } = useAdminAuth();
  const [qrInput, setQrInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);
  const [scanHistory, setScanHistory] = useState<ScanLog[]>([]);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<QRCodeItem | null>(null);
  const [selectedReward, setSelectedReward] = useState<{ id: string; type: 'gift_redemption' | 'stamp_redemption'; qrCode: string; title: string; outlet_id?: string } | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerInitialized = useRef(false);

  useEffect(() => {
    loadScanHistory();
  }, []);

  const loadScanHistory = async () => {
    const history = await scanHistoryService.getRecentScans(20);
    setScanHistory(history);
  };

  const handleScan = async (scannedCode?: string) => {
    const codeToScan = scannedCode || qrInput;

    if (!codeToScan.trim()) {
      setResult({
        success: false,
        message: 'Please enter a QR code',
        timestamp: new Date()
      });
      return;
    }

    setScanning(true);
    setResult(null);

    try {
      console.log('[Star Scanner] Scanning code:', codeToScan);

      // Simulate scanning delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if it's a reward redemption QR code (gift or stamp)
      const { data: giftRedemption } = await supabase
        .from('redemptions')
        .select('*, rewards(name, description)')
        .eq('qr_code', codeToScan)
        .is('used_at', null)
        .maybeSingle();

      if (giftRedemption) {
        console.log('[Star Scanner] Gift redemption found:', giftRedemption);
        const reward = giftRedemption.rewards;
        setSelectedReward({
          id: giftRedemption.id,
          type: 'gift_redemption',
          qrCode: codeToScan,
          title: `🎁 ${reward?.name || 'Gift Reward'}`,
          outlet_id: undefined
        });
        setResult({
          success: true,
          message: 'Gift reward ready for redemption',
          timestamp: new Date()
        });
        setScanning(false);
        if (!scannedCode) {
          setQrInput('');
        }
        return;
      }

      const { data: stampRedemption } = await supabase
        .from('stamps_redemptions')
        .select('*')
        .eq('qr_code', codeToScan)
        .eq('status', 'pending')
        .maybeSingle();

      if (stampRedemption) {
        console.log('[Star Scanner] Stamp redemption found:', stampRedemption);
        const rewardTitle = stampRedemption.redemption_type === 'ice_cream' ? '🍦 Ice Cream Reward' : '🍜 Ramen Reward';
        setSelectedReward({
          id: stampRedemption.id,
          type: 'stamp_redemption',
          qrCode: codeToScan,
          title: rewardTitle,
          outlet_id: undefined
        });
        setResult({
          success: true,
          message: 'Stamp reward ready for redemption',
          timestamp: new Date()
        });
        setScanning(false);
        if (!scannedCode) {
          setQrInput('');
        }
        return;
      }

      // Parse QR code format: "CHECKIN-{userId}-{timestamp}" or similar
      const parts = codeToScan.split('-');
      console.log('[Star Scanner] QR Code parts:', parts);

      if (parts.length < 2) {
        throw new Error('QR code format not recognized. Please scan a valid check-in QR code.');
      }

      const qrType = parts[0];
      const userId = parts[1];

      console.log('[Star Scanner] QR Type:', qrType, 'User ID:', userId);

      // Validate QR code type
      if (qrType !== 'CHECKIN') {
        throw new Error('QR code format not recognized. Please scan a valid check-in, order, or reward QR code.');
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        throw new Error('Invalid QR code format. Please ensure you are scanning a valid WonderStars QR code.');
      }

      // Get user details
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, lifetime_topups, unique_id')
        .eq('id', userId)
        .maybeSingle();

      console.log('[Star Scanner] User lookup result:', userData ? 'Found' : 'Not found', userError);

      if (userError || !userData) {
        throw new Error('User not found. Please check the QR code.');
      }

      // Get current stars balance using helper function
      const { data: currentBalance } = await supabase
        .rpc('get_user_stars_balance', { p_user_id: userId });

      const userStarsBalance = currentBalance || 0;

      // Get user's child profiles to show name
      const { data: childData } = await supabase
        .from('child_profiles')
        .select('name')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      // Award stars (example: 10 stars for scan)
      const starsToAward = 10;

      // Get user's tier for multiplier
      const { data: tierData } = await supabase
        .from('tiers')
        .select('*')
        .lte('threshold', userData.lifetime_topups || 0)
        .order('threshold', { ascending: false })
        .limit(1)
        .maybeSingle();

      const multiplier = tierData?.earn_multiplier || 1;
      const finalStars = Math.floor(starsToAward * multiplier);
      const newBalance = userStarsBalance + finalStars;

      // Insert transaction record (no user update needed - balance calculated from transactions)
      const { error: transactionError } = await supabase.from('stars_transactions').insert({
        user_id: userId,
        amount: finalStars,
        transaction_type: 'earn',
        source: 'cms_scanner',
        description: 'Stars earned via CMS Scanner',
        balance_after: newBalance,
        metadata: {
          scanned_at: new Date().toISOString(),
          base_stars: starsToAward,
          multiplier: multiplier
        }
      });

      if (transactionError) {
        throw new Error('Failed to award stars');
      }

      const displayName = childData?.name || userData.name || userData.email;
      const displayId = userData.unique_id || userData.id.substring(0, 8);

      // Log to scan history
      await scanHistoryService.logScan({
        scan_type: 'customer',
        qr_code: codeToScan,
        scan_result: 'success',
        admin_user_id: admin?.id,
        admin_email: admin?.email,
        customer_id: userId,
        customer_name: displayName,
        stars_awarded: finalStars,
        success: true,
        scanned_at: new Date().toISOString(),
        metadata: {
          base_stars: starsToAward,
          multiplier: multiplier,
          tier: tierData?.name || 'Silver',
          new_balance: newBalance
        }
      });

      const scanResult: ScanResult = {
        success: true,
        userName: `${displayName} (ID: ${displayId})`,
        starsEarned: finalStars,
        currentBalance: newBalance,
        tierName: tierData?.name || 'Silver',
        message: `Successfully awarded ${finalStars} stars!`,
        timestamp: new Date()
      };

      setResult(scanResult);
      setRecentScans(prev => [scanResult, ...prev.slice(0, 9)]);
      await loadScanHistory();
      if (!scannedCode) {
        setQrInput('');
      }
    } catch (error: any) {
      // Log failed scan
      await scanHistoryService.logScan({
        scan_type: 'customer',
        qr_code: codeToScan,
        scan_result: 'failure',
        admin_user_id: admin?.id,
        admin_email: admin?.email,
        success: false,
        failure_reason: error.message || 'Failed to scan QR code',
        scanned_at: new Date().toISOString(),
        metadata: {}
      });

      const errorResult: ScanResult = {
        success: false,
        message: error.message || 'Failed to scan QR code',
        timestamp: new Date()
      };
      setResult(errorResult);
      await loadScanHistory();
    } finally {
      setScanning(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && scannerInitialized.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleCameraOpen = async () => {
    setShowCameraScanner(true);
    setCameraError('');

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      const scannerId = 'qr-reader';
      const html5QrCode = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        async (decodedText) => {
          await handleQRCodeScanned(decodedText);
        },
        () => {}
      );

      scannerInitialized.current = true;
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('Unable to access camera. Please check permissions.');
    }
  };

  const handleCameraClose = async () => {
    if (html5QrCodeRef.current && scannerInitialized.current) {
      try {
        await html5QrCodeRef.current.stop();
        scannerInitialized.current = false;
      } catch (err) {
        console.error('Error stopping camera:', err);
      }
    }
    setShowCameraScanner(false);
    setCameraError('');
  };

  const handleQRCodeScanned = async (qrCode: string) => {
    await handleCameraClose();

    // Priority 1: Check if it's a reward redemption code (RDM-* format)
    // Check database first to avoid false positives with UUID pattern
    const { data: giftRedemption } = await supabase
      .from('redemptions')
      .select('id')
      .eq('qr_code', qrCode)
      .is('used_at', null)
      .maybeSingle();

    const { data: stampRedemption } = await supabase
      .from('stamps_redemptions')
      .select('id')
      .eq('qr_code', qrCode)
      .eq('status', 'pending')
      .maybeSingle();

    if (giftRedemption || stampRedemption) {
      setQrInput(qrCode);
      await handleScan(qrCode);
      return;
    }

    // Priority 2: Check if it's a check-in code (CHECKIN-*)
    if (qrCode.startsWith('CHECKIN-')) {
      setQrInput(qrCode);
      await handleScan(qrCode);
      return;
    }

    // Priority 3: Check if it's an order QR code (WP-* or UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isOrderQR = qrCode.startsWith('WP-') || uuidRegex.test(qrCode);

    if (isOrderQR) {
      await handleOrderQRScan(qrCode);
    } else {
      // Unknown format
      setQrInput(qrCode);
      await handleScan(qrCode);
    }
  };

  const handleOrderQRScan = async (qrCode: string) => {
    setScanning(true);
    setResult(null);

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

      setSelectedOrder(orderItem);

      // Log order scan to history
      await scanHistoryService.logScan({
        scan_type: 'order',
        qr_code: qrCode,
        scan_result: orderStatus === 'completed' ? 'success' : orderStatus === 'partial' ? 'partial' : 'success',
        admin_user_id: admin?.id,
        admin_email: admin?.email,
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

      const scanResult: ScanResult = {
        success: true,
        message: `Order found: ${orderItem.title}`,
        timestamp: new Date()
      };
      setResult(scanResult);
      setRecentScans(prev => [scanResult, ...prev.slice(0, 9)]);
      await loadScanHistory();
    } catch (error: any) {
      // Log failed order scan
      await scanHistoryService.logScan({
        scan_type: 'order',
        qr_code: qrCode,
        scan_result: 'failure',
        admin_user_id: admin?.id,
        admin_email: admin?.email,
        success: false,
        failure_reason: error.message || 'Order not found',
        scanned_at: new Date().toISOString(),
        metadata: {}
      });

      const errorResult: ScanResult = {
        success: false,
        message: error.message || 'Unable to load order details. Please try again.',
        timestamp: new Date()
      };
      setResult(errorResult);
      await loadScanHistory();
    } finally {
      setScanning(false);
    }
  };

  const handleOrderRedemptionSuccess = async () => {
    setSelectedOrder(null);
    setResult({
      success: true,
      message: 'Order items redeemed successfully!',
      timestamp: new Date()
    });
    await loadScanHistory();
  };

  return (
    <CMSLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Star Scanner</h1>
            <p className="text-gray-600 mt-1">Scan customer QR codes to award stars</p>
          </div>
          <div className="p-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl shadow-lg">
            <Scan className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Scanner Input */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Scan className="w-5 h-5 text-orange-600" />
              Scan QR Code
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  QR Code Input
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Scan or enter QR code..."
                    className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all font-mono text-sm"
                    disabled={scanning}
                    autoFocus
                  />
                  <button
                    onClick={handleCameraOpen}
                    disabled={scanning}
                    className="px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg flex items-center gap-2"
                    title="Open Camera Scanner"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <button
                onClick={handleScan}
                disabled={scanning || !qrInput.trim()}
                className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-xl font-bold text-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg flex items-center justify-center gap-2"
              >
                {scanning ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Scan className="w-5 h-5" />
                    Scan & Award Stars
                  </>
                )}
              </button>
            </div>

            {/* Result Display */}
            {result && (
              <div className={`mt-6 p-4 rounded-xl border-2 animate-scale-in ${
                result.success
                  ? 'bg-green-50 border-green-300'
                  : 'bg-red-50 border-red-300'
              }`}>
                <div className="flex items-start gap-3">
                  {result.success ? (
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-bold text-sm mb-1 ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                      {result.message}
                    </p>
                    {result.success && (
                      <div className="space-y-1 text-xs text-green-800">
                        <p><User className="w-3 h-3 inline mr-1" /><strong>User:</strong> {result.userName}</p>
                        <p><Star className="w-3 h-3 inline mr-1" /><strong>Stars Awarded:</strong> {result.starsEarned}</p>
                        <p><Trophy className="w-3 h-3 inline mr-1" /><strong>New Balance:</strong> {result.currentBalance} ({result.tierName})</p>
                        <p className="text-green-600 font-semibold">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          {result.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Scan History */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              Scan History
            </h2>

            {scanHistory.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Scan className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium">No scans yet</p>
                <p className="text-xs mt-1">Scan history will appear here</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {scanHistory.map((scan) => (
                  <div
                    key={scan.id}
                    className={`p-3 rounded-lg border ${
                      scan.scan_result === 'success'
                        ? 'bg-green-50 border-green-200'
                        : scan.scan_result === 'partial'
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
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
                          <p className="text-xs text-green-700 font-semibold">
                            <Star className="w-3 h-3 inline mr-1" fill="currentColor" />
                            +{scan.stars_awarded} stars
                          </p>
                        )}

                        {scan.scan_type === 'order' && (
                          <p className="text-xs text-gray-700">
                            {scan.items_redeemed || 0}/{scan.metadata?.total_items || 0} items redeemed
                          </p>
                        )}

                        {scan.scan_type === 'reward' && scan.metadata?.action && (
                          <p className="text-xs text-orange-700 font-semibold">
                            {scan.metadata.action === 'gift_redemption' ? '🎁 Gift Reward' : '🎟️ Stamp Reward'}
                          </p>
                        )}

                        {!scan.success && scan.failure_reason && (
                          <p className="text-xs text-red-600 mt-1">{scan.failure_reason}</p>
                        )}

                        <p className="text-xs text-gray-600 mt-1">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          {formatDateTimeCMS(scan.scanned_at)}
                        </p>
                      </div>
                      {scan.scan_result === 'success' ? (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      ) : scan.scan_result === 'partial' ? (
                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            How to Use
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="font-bold">1.</span>
              <span>Ask the customer to show their QR code from the MyQR page in the app</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">2.</span>
              <span>Click the camera button to scan QR codes, or manually enter the code</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">3.</span>
              <span>For user QR codes: Stars are awarded based on tier multiplier</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">4.</span>
              <span>For order QR codes: Opens redemption interface to mark items as redeemed</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">5.</span>
              <span>For reward QR codes: Opens redemption interface for gifts and stamp rewards</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">6.</span>
              <span>All scans are logged and displayed in Scan History for tracking</span>
            </li>
          </ul>
        </div>
      </div>

      {showCameraScanner && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          <div className="flex items-center justify-between p-4 bg-black/50">
            <h2 className="text-xl font-bold text-white">Scan QR Code</h2>
            <button
              onClick={handleCameraClose}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
              <div id="qr-reader" className="rounded-2xl overflow-hidden shadow-2xl"></div>
              {cameraError && (
                <div className="mt-4 p-4 bg-red-500/90 rounded-xl text-white text-center">
                  <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                  <p className="font-semibold">{cameraError}</p>
                </div>
              )}
              <p className="text-white text-center mt-4 text-sm">Position QR code within the frame</p>
            </div>
          </div>
        </div>
      )}

      {selectedOrder && (
        <StaffRedemptionModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onSuccess={handleOrderRedemptionSuccess}
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
          }}
        />
      )}
    </CMSLayout>
  );
};

export default CMSStarScanner;
