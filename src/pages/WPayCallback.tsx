import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Home, Wallet, ShoppingBag, AlertCircle } from 'lucide-react';
import { wpayService } from '../services/wpayService';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../hooks/useWallet';
import { useStars } from '../hooks/useStars';
import confetti from 'canvas-confetti';

const WPayCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, reloadUser } = useAuth();
  const { reloadBalance } = useWallet();
  const { refresh: refreshStars } = useStars();

  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'pending'>('loading');
  const [message, setMessage] = useState('Verifying payment...');
  const [transactionDetails, setTransactionDetails] = useState<any>(null);
  const [confettiFired, setConfettiFired] = useState(false);

  const hasProcessed = useRef(false);

  useEffect(() => {
    if (!hasProcessed.current) {
      hasProcessed.current = true;
      processCallback();
    }
  }, []);

  useEffect(() => {
    if (status === 'success' && !confettiFired) {
      setConfettiFired(true);
      fireConfetti();
    }
  }, [status, confettiFired]);

  const fireConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#10b981', '#f59e0b', '#fbbf24', '#34d399', '#fcd34d']
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#10b981', '#f59e0b', '#fbbf24', '#34d399', '#fcd34d']
      });
    }, 250);
  };

  const processCallback = async () => {
    const orderId = searchParams.get('order_id');
    const wpayStatus = searchParams.get('wpay_status');
    const transactionId = searchParams.get('transaction_id');

    console.log('[WPayCallback] Processing callback:', { orderId, wpayStatus, transactionId });

    if (!orderId) {
      setStatus('failed');
      setMessage('Missing order reference. Please contact support if you were charged.');
      return;
    }

    try {
      const result = await wpayService.getTransaction(orderId);

      console.log('[WPayCallback] Transaction result:', result);
      setTransactionDetails(result);

      if (result.wpay_status === 'success') {
        if (result.transaction) {
          const txStatus = result.transaction.status;

          if (txStatus === 'pending' && wpayStatus === 'success') {
            console.log('[WPayCallback] Transaction pending but URL says success - completing...');
            try {
              await wpayService.completeTransaction(orderId);
              console.log('[WPayCallback] Transaction completed successfully');
            } catch (completeError) {
              console.error('[WPayCallback] Failed to complete transaction:', completeError);
            }
          }

          if (txStatus === 'completed' || wpayStatus === 'success') {
            setStatus('success');
            setMessage('Payment completed successfully!');

            if (user) {
              await reloadUser();
              await reloadBalance();
              await refreshStars();
            }

            setTimeout(() => {
              const isTopup = orderId.startsWith('TU-');
              if (isTopup) {
                navigate('/wallet', { replace: true });
              } else {
                navigate('/order-success?order_id=' + orderId, { replace: true });
              }
            }, 3000);
          } else if (txStatus === 'pending') {
            setStatus('pending');
            setMessage('Payment is being processed. Please check back in a few moments.');

            setTimeout(() => {
              navigate('/home', { replace: true });
            }, 5000);
          } else if (txStatus === 'failed') {
            setStatus('failed');
            setMessage('Payment was not successful. Please try again.');
          }
        } else {
          if (wpayStatus === 'success') {
            setStatus('success');
            setMessage('Payment completed (verified via callback)');

            if (user) {
              await reloadUser();
              await reloadBalance();
              await refreshStars();
            }

            setTimeout(() => {
              const isTopup = orderId.startsWith('TU-');
              if (isTopup) {
                navigate('/wallet', { replace: true });
              } else {
                navigate('/order-success?order_id=' + orderId, { replace: true });
              }
            }, 3000);
          } else {
            setStatus('pending');
            setMessage('Payment is being processed. We will update you once confirmed.');
          }
        }
      } else if (result.wpay_status === 'failed') {
        setStatus('failed');
        setMessage(result.message || 'Payment verification failed. Please try again.');
      } else {
        setStatus('pending');
        setMessage('Payment is being processed. Please wait...');

        setTimeout(() => {
          navigate('/home', { replace: true });
        }, 5000);
      }
    } catch (error) {
      console.error('[WPayCallback] Error verifying payment:', error);
      setStatus('failed');
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to verify payment. Please check your transaction history or contact support.'
      );
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="w-16 h-16 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-16 h-16 text-green-500" />;
      case 'failed':
        return <XCircle className="w-16 h-16 text-red-500" />;
      case 'pending':
        return <AlertCircle className="w-16 h-16 text-yellow-500" />;
    }
  };

  const getTitle = () => {
    switch (status) {
      case 'loading':
        return 'Processing Payment...';
      case 'success':
        return 'Payment Successful!';
      case 'failed':
        return 'Payment Failed';
      case 'pending':
        return 'Payment Pending';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'text-blue-600';
      case 'success':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center space-y-6">
          <div className="flex justify-center">{getIcon()}</div>

          <div>
            <h1 className={`text-2xl font-bold ${getStatusColor()}`}>{getTitle()}</h1>
            <p className="text-gray-600 mt-2">{message}</p>
          </div>

          {transactionDetails?.transaction && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-left">
              <div className="flex justify-between">
                <span className="text-gray-600">Order ID:</span>
                <span className="font-mono font-semibold">{transactionDetails.transaction.order_id}</span>
              </div>
              {transactionDetails.transaction.transaction_id && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Transaction ID:</span>
                  <span className="font-mono text-xs">{transactionDetails.transaction.transaction_id}</span>
                </div>
              )}
              {transactionDetails.transaction.amount && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-semibold">RM {transactionDetails.transaction.amount.toFixed(2)}</span>
                </div>
              )}
              {transactionDetails.transaction_details?.stars_awarded > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Stars Earned:</span>
                  <span className="font-semibold text-yellow-600">
                    ★ {transactionDetails.transaction_details.stars_awarded}
                  </span>
                </div>
              )}
            </div>
          )}

          {status !== 'loading' && (
            <div className="space-y-3">
              {status === 'success' && (
                <div className="text-sm text-gray-500">
                  Redirecting you shortly...
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/home')}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  Home
                </button>

                {status === 'success' && (
                  <button
                    onClick={() => {
                      const orderId = searchParams.get('order_id');
                      const isTopup = orderId?.startsWith('TU-');
                      navigate(isTopup ? '/wallet' : `/order-success?order_id=${orderId}`);
                    }}
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {searchParams.get('order_id')?.startsWith('TU-') ? (
                      <>
                        <Wallet className="w-4 h-4" />
                        View Wallet
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4" />
                        View Order
                      </>
                    )}
                  </button>
                )}

                {status === 'failed' && (
                  <button
                    onClick={() => navigate(-1)}
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
          )}

          {status === 'loading' && (
            <div className="text-xs text-gray-400">
              Please do not close this window...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WPayCallback;
