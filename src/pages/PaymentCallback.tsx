import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, AlertCircle, QrCode, Star, ArrowRight, Wallet, Home } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { API_ENDPOINTS } from '../config/api';
import { fiuuService } from '../services/fiuuService';
import { activityTimelineService } from '../services/activityTimelineService';
import { updateWalletTransactionStatus, verifyWalletTransactionStatus } from '../services/walletStatusUpdateService';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../hooks/useWallet';
import { useStars } from '../hooks/useStars';
import { useStamps } from '../hooks/useStamps';
import confetti from 'canvas-confetti';
import QRCodeDisplay from '../components/QRCodeDisplay';

const PaymentCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, reloadUser } = useAuth();
  const { reloadBalance } = useWallet();
  const { earnStars, refresh: refreshStars } = useStars();
  const { awardStamps } = useStamps();

  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'cancelled'>('loading');
  const [message, setMessage] = useState('Verifying payment...');
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [confettiFired, setConfettiFired] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [workshopCode, setWorkshopCode] = useState<string | null>(null);
  const hasVerified = useRef(false);
  const isProcessing = useRef(false);
  const MAX_RETRIES = 10;
  const RETRY_DELAY = 3000;

  useEffect(() => {
    if (!hasVerified.current) {
      hasVerified.current = true;
      verifyPayment();
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

  const verifyPayment = async () => {
    try {
      const orderId = searchParams.get('order_id');
      const paymentStatus = searchParams.get('status');
      const tranId = searchParams.get('tran_id');
      const amount = searchParams.get('amount');
      let shopOrderId = searchParams.get('shop_order_id');
      let walletTransactionId = searchParams.get('wallet_transaction_id');
      let userId = searchParams.get('user_id');

      console.log('[PaymentCallback] ===== PAYMENT CALLBACK RECEIVED =====');
      console.log('[PaymentCallback] URL Parameters:', {
        orderId,
        paymentStatus,
        tranId,
        amount,
        shopOrderId,
        walletTransactionId,
        userId,
        timestamp: new Date().toISOString(),
        all_params: Object.fromEntries(searchParams.entries())
      });
      console.log('[PaymentCallback] Payment Status Details:', {
        raw_status: paymentStatus,
        is_success: paymentStatus === 'success',
        is_failed: paymentStatus === 'failed',
        is_cancelled: paymentStatus === 'cancelled'
      });

      if (!orderId || !paymentStatus) {
        console.error('[PaymentCallback] Missing required parameters');
        setStatus('failed');
        setMessage('Invalid payment reference');
        return;
      }

      // FALLBACK: If shop_order_id or user_id is missing, query Laravel API
      if ((!shopOrderId || !userId) && orderId) {
        console.log('[PaymentCallback] shop_order_id or user_id missing, querying Laravel API...');
        try {
          const transaction = await fiuuService.getPaymentTransaction(orderId);
          console.log('[PaymentCallback] Retrieved from Laravel:', transaction);

          if (transaction) {
            shopOrderId = shopOrderId || transaction.shop_order_id;
            walletTransactionId = walletTransactionId || transaction.wallet_transaction_id;
            userId = userId || transaction.user_id;

            console.log('[PaymentCallback] Updated values:', {
              shopOrderId,
              walletTransactionId,
              userId
            });
          }
        } catch (error) {
          console.error('[PaymentCallback] Failed to fetch transaction from Laravel:', error);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1500)); // Short delay for UX

      // Create payment transaction object from URL params
      const paymentTx = {
        order_id: orderId,
        status: paymentStatus === 'success' ? 'completed' : paymentStatus,
        fiuu_transaction_id: tranId,
        shop_order_id: shopOrderId,
        wallet_transaction_id: walletTransactionId,
        user_id: userId,
        amount: amount ? parseFloat(amount) : 0,
      };

      console.log('[PaymentCallback] Processing payment:', paymentTx);

      // Handle based on status from URL (backend already verified with Fiuu)
      if (paymentStatus === 'success') {
        // FRONTEND PROTECTION LAYER 1: Check if already processing
        if (isProcessing.current) {
          console.log('[PaymentCallback] Already processing, skipping duplicate call');
          return;
        }

        // FRONTEND PROTECTION LAYER 2: Check sessionStorage to prevent same-session duplicates
        const sessionKey = `payment_processed_${orderId}`;
        const alreadyProcessed = sessionStorage.getItem(sessionKey);

        if (alreadyProcessed) {
          console.log('[PaymentCallback] Payment already processed in this session, showing success UI with balance refresh');
          setStatus('success');
          setMessage('Payment already processed successfully!');
          setPaymentDetails(paymentTx);

          // Reload balances to show current state
          if (user) {
            await reloadBalance();
            await refreshStars();
            await reloadUser();
          }

          // Clear URL parameters
          window.history.replaceState({}, document.title, '/payment/callback');
          return;
        }

        // Set processing flag BEFORE starting
        isProcessing.current = true;

        // Mark as processed in sessionStorage BEFORE processing (not after)
        sessionStorage.setItem(sessionKey, new Date().toISOString());

        // Clear URL parameters BEFORE processing to prevent back button issues
        console.log('[PaymentCallback] Clearing URL parameters before processing');
        window.history.replaceState({}, document.title, '/payment/callback');

        try {
          console.log('[PaymentCallback] Payment successful, updating records...');
          await handleSuccessfulPayment(paymentTx);
          setStatus('success');
          setMessage('Payment successful!');
          setPaymentDetails(paymentTx);
        } finally {
          // Clear processing flag when done
          isProcessing.current = false;
        }
      } else {
        handleFailedPayment(paymentStatus, paymentTx);
      }
    } catch (error) {
      console.error('[PaymentCallback] Error verifying payment:', error);
      setStatus('failed');
      setMessage('An error occurred while verifying payment');
    }
  };

  const handleFailedPayment = async (paymentStatus: string, paymentTx: any) => {
    if (paymentStatus === 'failed') {
      console.log('[PaymentCallback] Payment failed');
      setStatus('failed');
      setMessage('Payment failed. Please try again.');
      setPaymentDetails(paymentTx);

      if (paymentTx.shop_order_id) {
        const { error: updateError } = await supabase
          .from('shop_orders')
          .update({
            status: 'cancelled',
            payment_status: 'failed',
            payment_error_code: paymentTx.error_code || paymentTx.error_desc || 'Payment failed'
          })
          .eq('id', paymentTx.shop_order_id);

        if (updateError) {
          console.error('[PaymentCallback] Failed to update shop order status:', updateError);
        } else {
          console.log('[PaymentCallback] Shop order marked as failed');
        }
      }
    } else if (paymentStatus === 'cancelled') {
      console.log('[PaymentCallback] Payment cancelled');
      setStatus('cancelled');
      setMessage('Payment was cancelled');
      setPaymentDetails(paymentTx);

      if (paymentTx.shop_order_id) {
        const { error: updateError } = await supabase
          .from('shop_orders')
          .update({
            status: 'cancelled',
            payment_status: 'failed',
            payment_error_code: 'Payment cancelled by user'
          })
          .eq('id', paymentTx.shop_order_id);

        if (updateError) {
          console.error('[PaymentCallback] Failed to update shop order status:', updateError);
        }
      }
    }
  };

  const handleSuccessfulPayment = async (paymentTx: any) => {
    try {
      // NOTE: payment_transactions table is in Laravel's database, not Supabase
      // The Laravel backend already updates it via the webhook callback
      console.log('[Payment Success] Processing successful payment');

      if (paymentTx.wallet_transaction_id) {
        console.log('[Payment Success] Processing wallet topup');

        const { data: walletTx, error: walletFetchError } = await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('id', paymentTx.wallet_transaction_id)
          .maybeSingle();

        if (walletFetchError || !walletTx) {
          console.error('[Payment Success] Failed to fetch wallet transaction:', walletFetchError);
          return;
        }

        // CRITICAL: Check if this transaction has already been processed
        if (walletTx.status === 'success') {
          console.log('[Payment Success] Transaction already processed, checking if bonus was awarded...');

          // FIX: Check if bonus still needs to be awarded
          const metadata = walletTx.metadata || paymentTx.metadata || {};
          const bonusAmount = metadata.bonus_amount || 0;

          if (bonusAmount > 0) {
            console.log('[Payment Success] Checking if bonus was awarded for this topup...');

            // Check if bonus_transaction exists for this wallet transaction
            const { data: existingBonus } = await supabase
              .from('bonus_transactions')
              .select('id')
              .eq('user_id', paymentTx.user_id)
              .eq('transaction_type', 'topup_bonus')
              .eq('metadata->>wallet_transaction_id', walletTx.id)
              .maybeSingle();

            if (!existingBonus) {
              console.log('[Payment Success] ⚠️ Bonus NOT found, awarding now...');

              try {
                // Use atomic function to update bonus balance safely
                // This prevents race conditions and ensures balance_after is always correct
                const { data: result, error: atomicError } = await supabase
                  .rpc('update_bonus_balance_atomic', {
                    p_user_id: paymentTx.user_id,
                    p_amount: bonusAmount,
                    p_transaction_type: 'topup_bonus',
                    p_description: `Bonus from wallet top-up: RM${walletTx.amount.toFixed(2)}`,
                    p_order_id: paymentTx.shop_order_id || null,
                    p_order_number: paymentTx.order_id,
                    p_metadata: {
                      payment_transaction_id: paymentTx.order_id,
                      wallet_transaction_id: walletTx.id,
                      package_id: metadata.package_id,
                      topup_amount: walletTx.amount,
                      completed_at: new Date().toISOString(),
                      recovered_from_skip: true
                    }
                  });

                if (atomicError) {
                  console.error('[Payment Success] Failed to award bonus atomically:', atomicError);
                } else if (result && result.length > 0) {
                  const atomicResult = result[0];
                  if (atomicResult.success) {
                    console.log('[Payment Success] ✅ Bonus awarded successfully via atomic function:', {
                      transaction_id: atomicResult.transaction_id,
                      new_balance: atomicResult.new_balance,
                      amount: bonusAmount
                    });
                  } else {
                    console.error('[Payment Success] Atomic bonus update failed:', atomicResult.message);
                  }
                }
              } catch (bonusError) {
                console.error('[Payment Success] Error awarding bonus:', bonusError);
              }
            } else {
              console.log('[Payment Success] ✅ Bonus already awarded');
            }
          }

          setStatus('success');
          setMessage('Payment already processed successfully!');
          setPaymentDetails(paymentTx);

          // IMPORTANT: Reload balances even when already processed so user sees current balance
          if (user) {
            console.log('[Payment Success] Reloading balances for already-processed transaction...');
            await new Promise(resolve => setTimeout(resolve, 500));
            await reloadBalance();
            await refreshStars();
            await reloadUser();
            console.log('[Payment Success] ✅ Balances reloaded');
          }

          return;
        }

        // Use atomic status update function with retry logic
        console.log('[Payment Success] Calling atomic status update function with retry...');
        const updateResult = await updateWalletTransactionStatus(
          paymentTx.wallet_transaction_id,
          'success',
          'payment_callback',
          {
            completed_at: new Date().toISOString(),
            payment_transaction_id: paymentTx.order_id,
            payment_order_id: paymentTx.order_id,
            fiuu_transaction_id: paymentTx.fiuu_transaction_id,
            payment_amount: paymentTx.amount,
            callback_timestamp: new Date().toISOString()
          },
          {
            maxAttempts: 5,
            initialDelayMs: 300,
            maxDelayMs: 3000
          }
        );

        if (!updateResult.success) {
          console.error('[Payment Success] ❌ CRITICAL: Failed to update wallet transaction status after all retries');
          console.error('[Payment Success] Update result:', updateResult);
          throw new Error(`Failed to credit wallet balance: ${updateResult.error_message || updateResult.error || 'Unknown error'}`);
        }

        console.log('[Payment Success] ✅ Wallet transaction marked as success:', {
          old_status: updateResult.old_status,
          new_status: updateResult.new_status,
          idempotent: updateResult.idempotent,
          audit_id: updateResult.audit_id,
          attempts: updateResult.attempt
        });

        // Verify the update with our verification function
        const verification = await verifyWalletTransactionStatus(
          paymentTx.wallet_transaction_id,
          'success'
        );

        if (!verification.verified) {
          console.error('[Payment Success] ⚠️ WARNING: Status verification failed!', {
            expected: 'success',
            actual: verification.actualStatus,
            transaction: verification.transaction
          });
          // Don't throw - the atomic function logged success, verification might be timing issue
        } else {
          console.log('[Payment Success] ✅ Status verified successfully');
        }

        // Update user's lifetime_topups for tier calculation
        console.log('[Payment Success] Updating lifetime_topups for tier system');
        const { error: lifetimeError } = await supabase
          .from('users')
          .update({
            lifetime_topups: supabase.raw(`COALESCE(lifetime_topups, 0) + ${walletTx.amount}`)
          } as any)
          .eq('id', paymentTx.user_id);

        if (lifetimeError) {
          console.error('[Payment Success] Failed to update lifetime_topups:', lifetimeError);
        } else {
          console.log('[Payment Success] ✅ Lifetime topups updated (+RM' + walletTx.amount.toFixed(2) + ')');
        }

        // Also update the shop_order status for topup orders
        const orderId = walletTx.metadata?.order_id;
        if (orderId) {
          console.log('[Payment Success] Updating shop order status for topup:', orderId);
          const { error: orderUpdateError } = await supabase
            .from('shop_orders')
            .update({
              status: 'completed',
              payment_status: 'paid',
              completed_at: new Date().toISOString(),
              confirmed_at: new Date().toISOString()
            })
            .eq('id', orderId);

          if (orderUpdateError) {
            console.error('[Payment Success] Failed to update shop order:', orderUpdateError);
          } else {
            console.log('[Payment Success] Shop order updated successfully');
          }
        }

        // Get metadata from wallet transaction (more reliable than URL params)
        const metadata = walletTx.metadata || paymentTx.metadata || {};
        const baseStars = metadata.base_stars || 0;
        const extraStars = metadata.extra_stars || 0;
        const bonusAmount = metadata.bonus_amount || 0;
        const packageId = metadata.package_id;

        // Award stars from package configuration (base + extra)
        const starsToAward = baseStars + extraStars;
        console.log('[Payment Success] Awarding stars for top-up:', {
          baseStars,
          extraStars,
          totalStars: starsToAward,
          topupAmount: walletTx.amount
        });

        if (starsToAward > 0 && paymentTx.user_id) {
          try {
            console.log('[Payment Success] 🌟 INSERTING STARS TRANSACTION:', {
              user_id: paymentTx.user_id,
              amount: starsToAward,
              source: 'wallet_topup',
              wallet_transaction_id: walletTx.id
            });

            // Award stars directly to ensure it works even if user is not logged in
            const { data: starsData, error: starsError } = await supabase
              .from('stars_transactions')
              .insert({
                user_id: paymentTx.user_id,
                transaction_type: 'earn',
                amount: starsToAward,
                source: 'wallet_topup',
                metadata: {
                  topup_amount: walletTx.amount,
                  payment_transaction_id: paymentTx.order_id,
                  wallet_transaction_id: walletTx.id,
                  package_id: packageId,
                  base_stars: baseStars,
                  extra_stars: extraStars
                }
              })
              .select();

            if (starsError) {
              console.error('[Payment Success] ❌ FAILED to award stars:', {
                error: starsError,
                code: starsError.code,
                message: starsError.message,
                details: starsError.details,
                hint: starsError.hint
              });
            } else {
              console.log('[Payment Success] ✅ STARS AWARDED SUCCESSFULLY:', {
                amount: starsToAward,
                insertedRecord: starsData
              });
            }
          } catch (starsError) {
            console.error('[Payment Success] ❌ EXCEPTION awarding stars:', starsError);
          }
        } else {
          console.log('[Payment Success] ⚠️ SKIPPING stars award:', {
            starsToAward,
            userId: paymentTx.user_id,
            reason: starsToAward <= 0 ? 'No stars to award' : 'No user ID'
          });
        }

        // Award Bonus Balance from package configuration
        if (bonusAmount > 0) {
          console.log('[Payment Success] 💰 AWARDING BONUS BALANCE from package:', {
            bonusAmount,
            userId: paymentTx.user_id,
            walletTransactionId: walletTx.id
          });

          try {
            // Use atomic function to update bonus balance safely
            // This prevents race conditions and ensures balance_after is always correct
            console.log('[Payment Success] 💰 CALLING update_bonus_balance_atomic RPC function with params:', {
              p_user_id: paymentTx.user_id,
              p_amount: bonusAmount,
              p_transaction_type: 'topup_bonus',
              p_description: `Bonus from wallet top-up: RM${walletTx.amount.toFixed(2)}`,
              p_order_id: paymentTx.shop_order_id || null,
              p_order_number: paymentTx.order_id,
              p_metadata: {
                payment_transaction_id: paymentTx.order_id,
                wallet_transaction_id: walletTx.id,
                package_id: packageId,
                topup_amount: walletTx.amount,
                completed_at: new Date().toISOString()
              }
            });

            const { data: result, error: atomicError } = await supabase
              .rpc('update_bonus_balance_atomic', {
                p_user_id: paymentTx.user_id,
                p_amount: bonusAmount,
                p_transaction_type: 'topup_bonus',
                p_description: `Bonus from wallet top-up: RM${walletTx.amount.toFixed(2)}`,
                p_order_id: paymentTx.shop_order_id || null,
                p_order_number: paymentTx.order_id,
                p_metadata: {
                  payment_transaction_id: paymentTx.order_id,
                  wallet_transaction_id: walletTx.id,
                  package_id: packageId,
                  topup_amount: walletTx.amount,
                  completed_at: new Date().toISOString()
                }
              });

            if (atomicError) {
              // Check if error is due to duplicate constraint
              if (atomicError.code === '23505') {
                console.log('[Payment Success] ⚠️ Bonus already awarded (duplicate prevented by database constraint)');
              } else {
                console.error('[Payment Success] ❌ FAILED to award bonus atomically:', {
                  error: atomicError,
                  code: atomicError.code,
                  message: atomicError.message,
                  details: atomicError.details,
                  hint: atomicError.hint
                });
                throw atomicError;
              }
            } else if (result && result.length > 0) {
              const atomicResult = result[0];
              console.log('[Payment Success] 💰 RPC RESULT:', atomicResult);
              if (atomicResult.success) {
                console.log('[Payment Success] ✅ BONUS AWARDED SUCCESSFULLY via atomic function:', {
                  transaction_id: atomicResult.transaction_id,
                  new_balance: atomicResult.new_balance,
                  amount: bonusAmount,
                  fullResult: atomicResult
                });
              } else {
                console.error('[Payment Success] ❌ Atomic bonus update returned success=false:', atomicResult.message);
                throw new Error(atomicResult.message);
              }
            } else {
              console.error('[Payment Success] ❌ RPC returned no result:', { result, atomicError });
            }
          } catch (bonusError) {
            console.error('[Payment Success] ❌ EXCEPTION awarding bonus:', bonusError);
          }
        } else {
          console.log('[Payment Success] ⚠️ SKIPPING bonus award:', {
            bonusAmount,
            reason: 'No bonus amount in package'
          });
        }

        // Log wallet topup activity
        try {
          await activityTimelineService.helpers.logWalletTopup(
            paymentTx.user_id,
            walletTx.amount,
            bonusAmount
          );
          console.log('[Payment Success] Topup activity logged');
        } catch (activityError) {
          console.warn('Failed to log topup activity:', activityError);
        }

        // Reload user data if user is logged in (optional for callback success)
        if (user) {
          // Add delay to ensure Supabase has fully committed and replicated the transaction
          console.log('[Payment Success] Waiting 1.5s for database commit and replication...');
          await new Promise(resolve => setTimeout(resolve, 1500));

          console.log('[Payment Success] Reloading wallet balance...');
          await reloadBalance();
          console.log('[Payment Success] ✅ Wallet balance reloaded');

          console.log('[Payment Success] Refreshing stars balance...');
          await refreshStars();
          console.log('[Payment Success] ✅ Stars balance refreshed');

          console.log('[Payment Success] Reloading user data...');
          await reloadUser();
          console.log('[Payment Success] ✅ User data reloaded');

          // Additional delay before navigation to ensure UI updates
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log('[Payment Success] 🎉 All data refreshed, ready to navigate');
        } else {
          console.log('[Payment Success] User not logged in, skipping balance reload (will update on next login)');
        }
      } else if (paymentTx.shop_order_id) {
        // FALLBACK: If wallet_transaction_id is missing but shop_order_id exists,
        // try to find the wallet transaction by shop_order_id for topup orders
        console.log('[Payment Success] wallet_transaction_id missing, checking if this is a topup order');

        const { data: order } = await supabase
          .from('shop_orders')
          .select('*')
          .eq('id', paymentTx.shop_order_id)
          .maybeSingle();

        if (order && order.metadata?.is_topup) {
          console.log('[Payment Success] Found topup order, searching for wallet transaction');

          // Find wallet transaction by order metadata
          const { data: walletTx } = await supabase
            .from('wallet_transactions')
            .select('*')
            .eq('user_id', paymentTx.user_id)
            .eq('metadata->>order_id', order.id)
            .eq('status', 'pending')
            .maybeSingle();

          if (walletTx) {
            console.log('[Payment Success] Found pending wallet transaction:', walletTx.id);

            // Update it to success
            const { error: updateError } = await supabase
              .from('wallet_transactions')
              .update({
                status: 'success',
                metadata: {
                  ...walletTx.metadata,
                  completed_at: new Date().toISOString(),
                  callback_processed_at: new Date().toISOString(),
                  recovered_from_missing_id: true
                }
              } as any)
              .eq('id', walletTx.id);

            if (!updateError) {
              console.log('[Payment Success] Wallet transaction recovered and updated');

              // Award stars
              const metadata = walletTx.metadata || {};
              const baseStars = metadata.base_stars || 0;
              const extraStars = metadata.extra_stars || 0;
              const starsToAward = baseStars + extraStars;

              if (starsToAward > 0) {
                try {
                  await earnStars(starsToAward, 'wallet_topup', {
                    topup_amount: walletTx.amount,
                    wallet_transaction_id: walletTx.id,
                    package_id: metadata.package_id,
                    base_stars: baseStars,
                    extra_stars: extraStars,
                    recovered: true
                  });
                  console.log('[Payment Success] Stars awarded (recovered)');
                } catch (err) {
                  console.warn('[Payment Success] Failed to award stars:', err);
                }
              }

              await reloadBalance();
              await refreshStars();
              await reloadUser();
            }
          }
        }
      }

      if (paymentTx.shop_order_id) {
        console.log('[Payment Success] Processing shop order');

        // Check if order already has QR code (webhook might have generated it)
        const { data: existingOrder } = await supabase
          .from('shop_orders')
          .select('qr_code, status, payment_status, items')
          .eq('id', paymentTx.shop_order_id)
          .maybeSingle();

        // CRITICAL: Check if this order has already been processed
        if (existingOrder?.payment_status === 'paid' && existingOrder?.qr_code) {
          console.log('[Payment Success] Order already processed, skipping to prevent duplicates');
          setOrderDetails(existingOrder);
          return;
        }

        let qrCode = existingOrder?.qr_code;

        // Generate QR code only if it doesn't exist
        if (!qrCode) {
          // Check if this is a workshop order (contains workshop products)
          const isWorkshopOrder = existingOrder?.items?.some((item: any) => {
            const name = item.product_name?.toLowerCase() || '';
            const cat = item.metadata?.category?.toLowerCase() || '';
            const metaName = item.metadata?.product_name?.toLowerCase() || '';
            return name.includes('workshop') ||
              name.includes('genius') ||
              cat.includes('education') ||
              cat.includes('genius') ||
              cat.includes('ai') ||
              metaName.includes('workshop');
          });

          if (isWorkshopOrder) {
            console.log('[Payment Success] Workshop order detected, generating collection number...');
            // Fetch current count of workshop orders to generate running number
            const { count, error: countError } = await supabase
              .from('shop_orders')
              .select('*', { count: 'exact', head: true })
              .like('qr_code', 'WS-%');

            if (countError) {
              console.error('[Payment Success] Failed to count workshop orders:', countError);
              // Fallback to timestamp if count fails
              qrCode = `WS-${Date.now().toString().slice(-6)}`;
            } else {
              const nextNum = (count || 0) + 1;
              qrCode = `WS-${nextNum.toString().padStart(4, '0')}`;
            }
            console.log('[Payment Success] Generated Workshop Collection Code:', qrCode);
          } else {
            qrCode = `WP-${paymentTx.shop_order_id}-${Date.now()}`;
            console.log('[Payment Success] Generating Standard QR code:', qrCode);
          }
        } else {
          console.log('[Payment Success] QR code already exists:', qrCode);
        }

        // Always update the order to ensure status and payment_status are correct
        const { error: updateError } = await supabase
          .from('shop_orders')
          .update({
            status: 'ready',
            payment_status: 'paid',
            qr_code: qrCode,
            confirmed_at: new Date().toISOString()
          })
          .eq('id', paymentTx.shop_order_id);

        if (updateError) {
          console.error('[Payment Success] Failed to update shop order:', updateError);
        } else {
          console.log('[Payment Success] Shop order updated successfully');
        }

        const { data: orderData } = await supabase
          .from('shop_orders')
          .select('*, outlets(name, location)')
          .eq('id', paymentTx.shop_order_id)
          .maybeSingle();

        if (orderData) {
          setOrderDetails(orderData);
          console.log('[Payment Success] Order confirmed with QR code:', qrCode);

          // SYNC WITH WORKSHOP API
          // Check if detected as workshop order earlir (needs recalculation or store in state, but simpler to check qr_code or items again)
          // We can check if qr_code starts with 'WS-'
          const isWorkshopOrder = qrCode?.startsWith('WS-') || false;

          if (isWorkshopOrder || (orderData.metadata && orderData.metadata.participants && orderData.metadata.participants.length > 0)) {
            console.log('[Payment Success] Syncing with Workshop API...');

            // Resolve customer details safely (user might be null in callback)
            let customerEmail = user?.email;
            let customerName = user?.name;
            let customerPhone = user?.phone;

            if (!customerEmail && paymentTx.user_id) {
              const { data: uData } = await supabase
                .from('users')
                .select('email, name, phone')
                .eq('id', paymentTx.user_id)
                .maybeSingle();

              if (uData) {
                customerEmail = uData.email;
                customerName = uData.name;
                customerPhone = uData.phone;
              }
            }

            try {
              let participants = orderData.metadata?.participants || [];

              // If no participants in metadata, fetch from child_profiles using paymentTx.user_id
              if (participants.length === 0 && paymentTx.user_id) {
                console.log('[Payment Success] No participants in metadata, fetching from profile...');
                const { data: childData } = await supabase
                  .from('child_profiles')
                  .select('*')
                  .eq('user_id', paymentTx.user_id);

                if (childData && childData.length > 0) {
                  participants = childData.map((child: any) => ({
                    name: child.name,
                    nric: child.mykid_number || null,
                    gender: child.gender || 'Male',
                    dob: child.birth_date || null
                  }));
                  console.log('[Payment Success] Fetched children from profile:', participants);
                }
              }

              const payload = {
                email: customerEmail,
                package_type: 'Standard', // Default package
                items: orderData.items,
                parent_details: {
                  name: customerName,
                  phone: customerPhone
                },
                collection_code: qrCode, // Use the generated running number
                children: participants
              };

              console.log('[Payment Success] Workshop Payload:', payload);

              fetch(API_ENDPOINTS.WORKSHOP_GENERATE_CODE, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
              })
                .then(async res => {
                  if (!res.ok) {
                    const text = await res.text();
                    console.error('[Payment Success] Workshop Sync Error Response:', res.status, text);
                    try {
                      return JSON.parse(text); // Try to parse as JSON to handle gracefully if possible
                    } catch (e) {
                      throw new Error(`Workshop API Error: ${res.status} ${text.substring(0, 100)}`);
                    }
                  }
                  return res.json();
                })
                .then(async data => {
                  console.log('[Payment Success] Workshop Sync Response:', data);
                  if (data.success && data.code) {
                    setWorkshopCode(data.code);
                    // Update shop_orders metadata to persist the code
                    await supabase.from('shop_orders').update({
                      metadata: {
                        ...orderData.metadata,
                        workshop_code: data.code
                      }
                    }).eq('id', orderData.id);
                    // alert("Workshop Account Synced! Use code: " + data.code);
                  } else {
                    console.error("Workshop Sync Error response:", data);
                  }
                })
                .catch(err => {
                  console.error('[Payment Success] Workshop Sync Failed:', err);
                  // alert("Workshop Sync Failed. Please contact support. Error: " + err.message);
                });

            } catch (err) {
              console.error('[Payment Success] Workshop Sync Error:', err);
            }
          }

          try {
            if (orderData.stars_earned && orderData.stars_earned > 0) {
              console.log('[Payment Success] Awarding stars:', orderData.stars_earned);
              await earnStars(orderData.stars_earned, 'shop_purchase', {
                order_id: orderData.id,
                payment_method: paymentTx.payment_method,
                order_number: orderData.order_number
              });
            }
          } catch (starsError) {
            console.warn('[Payment Success] Failed to award stars:', starsError);
          }

          try {
            if (orderData.stamps_earned && orderData.stamps_earned > 0) {
              console.log('[Payment Success] Awarding stamps:', orderData.stamps_earned);
              await awardStamps(orderData.stamps_earned, 'ticket_purchase', orderData.id, {
                order_number: orderData.order_number,
                outlet_id: orderData.outlet_id,
                items: orderData.items
              });
            }
          } catch (stampsError) {
            console.warn('[Payment Success] Failed to award stamps:', stampsError);
          }

          try {
            const { data: existingRedemptions } = await supabase
              .from('order_item_redemptions')
              .select('item_index')
              .eq('order_id', orderData.id);

            const existingIndexes = new Set((existingRedemptions || []).map(r => r.item_index));

            for (let idx = 0; idx < (orderData.items || []).length; idx++) {
              if (existingIndexes.has(idx)) {
                continue;
              }

              const item = orderData.items[idx];
              await supabase
                .from('order_item_redemptions')
                .insert({
                  order_id: orderData.id,
                  user_id: paymentTx.user_id,
                  item_index: idx,
                  product_id: item.product_id,
                  product_name: item.product_name,
                  quantity: item.quantity,
                  redeemed_quantity: 0,
                  status: 'pending',
                  redeemed_at_outlet_id: orderData.outlet_id
                });
            }
            console.log('[Payment Success] Order redemption records created');
          } catch (redemptionError) {
            console.warn('[Payment Success] Failed to create redemption records:', redemptionError);
          }

          console.log('[Payment Success] Clearing cart for user:', paymentTx.user_id);
          const { error: clearCartError } = await supabase
            .from('shop_cart_items')
            .delete()
            .eq('user_id', paymentTx.user_id);

          if (clearCartError) {
            console.error('[Payment Success] Failed to clear cart:', clearCartError);
          } else {
            console.log('[Payment Success] Cart cleared successfully');
          }

          if (orderData.voucher_id) {
            console.log('[Payment Success] Marking voucher as used:', orderData.voucher_id);
            try {
              // Find the user_voucher record
              const { data: userVoucher } = await supabase
                .from('user_vouchers')
                .select('id')
                .eq('user_id', paymentTx.user_id)
                .eq('voucher_id', orderData.voucher_id)
                .maybeSingle();

              if (userVoucher) {
                await supabase.rpc('use_user_voucher', {
                  user_voucher_uuid: userVoucher.id
                });
                console.log('[Payment Success] Voucher marked as used');
              }
            } catch (voucherError) {
              console.warn('[Payment Success] Failed to mark voucher as used:', voucherError);
            }
          }
        }
      }
    } catch (error) {
      console.error('[Payment Success] Error in success handler:', error);
    }
  };

  const handleRetry = () => {
    // If user is not logged in, redirect to login first
    if (!user) {
      navigate('/login');
      return;
    }

    if (paymentDetails?.wallet_transaction_id) {
      // Set flag to indicate coming from payment
      sessionStorage.setItem('payment_completed', 'true');
      navigate('/wallet', { state: { fromPayment: true } });
    } else if (paymentDetails?.shop_order_id) {
      const outlet = searchParams.get('outlet');
      if (outlet) {
        navigate(`/shop/${outlet}/cart`);
      } else {
        navigate('/home');
      }
    } else {
      navigate('/home');
    }
  };

  // Allow callback to process even if user is not logged in
  // Payment verification uses URL params, not user session

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex items-center justify-center p-4 pt-28 pb-20">
      <div className="w-full max-w-md">
        <div className="glass-strong rounded-3xl p-8 text-center space-y-6">
          {status === 'loading' && (
            <>
              <div className="relative">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-glow animate-pulse">
                  <Loader2 className="w-12 h-12 text-white animate-spin" />
                </div>
                <div className="absolute inset-0 w-24 h-24 mx-auto bg-primary-400 rounded-full blur-xl opacity-50 animate-pulse"></div>
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">
                  Processing Payment
                </h2>
                <p className="text-sm text-gray-600">{message}</p>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="relative">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-glow animate-bounce-once">
                  <CheckCircle2 className="w-12 h-12 text-white" />
                </div>
                <div className="absolute inset-0 w-24 h-24 mx-auto bg-green-400 rounded-full blur-xl opacity-50 animate-pulse"></div>
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">
                  Thank you for purchasing!
                </h2>
                <p className="text-sm text-gray-600 mb-4">{message}</p>
                {paymentDetails && (
                  <div className="p-4 bg-white/60 rounded-xl">
                    <p className="text-xs text-gray-600">Amount Paid</p>
                    <p className="text-2xl font-black text-green-600">
                      RM {Number(paymentDetails.amount).toFixed(2)}
                    </p>
                    {orderDetails?.stars_earned > 0 && (
                      <div className="flex items-center justify-center gap-1 mt-2">
                        <Star className="w-4 h-4 text-amber-500" fill="currentColor" />
                        <p className="text-sm font-bold text-gray-700">
                          +{orderDetails.stars_earned} stars earned
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {orderDetails && orderDetails.qr_code && (
                <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
                  <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <QrCode className="w-6 h-6 text-green-600" />
                      <h3 className="text-lg font-black text-gray-900">Here's your order QR code</h3>
                    </div>
                    <p className="text-sm text-gray-600 font-medium">Just show it to our staff</p>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border-2 border-green-500 shadow-xl">
                    <QRCodeDisplay
                      value={orderDetails.qr_code}
                      size={220}
                      level="H"
                      showValue={false}
                      allowEnlarge={true}
                      className="w-full"
                    />
                    <p className="text-xs font-bold text-gray-700 text-center mt-3">
                      Order #{orderDetails.order_number}
                    </p>
                  </div>

                  {workshopCode && (
                    <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-2xl border-2 border-orange-200 animate-slide-up">
                      <div className="text-center space-y-2">
                        <h3 className="text-sm font-bold text-orange-800 uppercase tracking-wider">AIGenius Workshop Code</h3>
                        <div className="p-3 bg-white rounded-xl border border-orange-200 shadow-inner">
                          <p className="text-3xl font-black text-orange-600 tracking-widest">{workshopCode}</p>
                        </div>
                        <p className="text-xs text-orange-700 font-medium">Use this code to login at the workshop kiosk</p>
                      </div>
                    </div>
                  )}

                  {orderDetails.items && orderDetails.items.length > 0 && (
                    <div className="bg-white/60 p-3 rounded-xl space-y-2">
                      <p className="text-xs font-bold text-gray-700">Order Items:</p>
                      <div className="space-y-1">
                        {orderDetails.items.slice(0, 3).map((item: any, idx: number) => (
                          <p key={idx} className="text-xs text-gray-600">
                            {item.quantity}x {item.product_name}
                          </p>
                        ))}
                        {orderDetails.items.length > 3 && (
                          <p className="text-xs text-gray-500 italic">
                            +{orderDetails.items.length - 3} more item(s)
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-xl border border-blue-200">
                    <p className="text-xs text-gray-700 text-center font-medium">
                      If you need to access later, just click on <span className="font-bold text-green-600">MyQR</span> at the bottom
                    </p>
                  </div>

                  <button
                    onClick={() => navigate('/myqr')}
                    className="w-full py-3.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-5 h-5" />
                    View in MyQR
                    <ArrowRight className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => navigate('/home')}
                    className="w-full py-3 bg-white/80 text-gray-700 rounded-xl font-semibold hover:bg-white transition-colors"
                  >
                    Back to Home
                  </button>
                </div>
              )}

              {paymentDetails?.wallet_transaction_id && !orderDetails && (
                <button
                  onClick={() => {
                    if (user) {
                      // Set flag to indicate coming from payment
                      sessionStorage.setItem('payment_completed', 'true');
                      navigate('/wallet', { state: { fromPayment: true } });
                    } else {
                      navigate('/login');
                    }
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <Wallet className="w-5 h-5" />
                  {user ? 'View Wallet' : 'Login to View Wallet'}
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}

              {/* Always show Back to Home button for successful payments */}
              <button
                onClick={() => navigate(user ? '/home' : '/login')}
                className="w-full py-3 bg-white/80 text-gray-700 rounded-xl font-semibold hover:bg-white transition-colors flex items-center justify-center gap-2"
              >
                <Home className="w-5 h-5" />
                {user ? 'Back to Home' : 'Login'}
              </button>
            </>
          )}

          {status === 'failed' && (
            <>
              <div className="relative">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-glow-red animate-shake">
                  <XCircle className="w-12 h-12 text-white" />
                </div>
                <div className="absolute inset-0 w-24 h-24 mx-auto bg-red-400 rounded-full blur-xl opacity-50 animate-pulse"></div>
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">
                  Payment Failed
                </h2>
                <p className="text-sm text-gray-600">{message}</p>
              </div>
              <button
                onClick={handleRetry}
                className="w-full py-3.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-transform"
              >
                Try Again
              </button>
            </>
          )}

          {status === 'cancelled' && (
            <>
              <div className="relative">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center shadow-glow">
                  <AlertCircle className="w-12 h-12 text-white" />
                </div>
                <div className="absolute inset-0 w-24 h-24 mx-auto bg-orange-400 rounded-full blur-xl opacity-50"></div>
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">
                  Payment Cancelled
                </h2>
                <p className="text-sm text-gray-600">{message}</p>
              </div>
              <button
                onClick={handleRetry}
                className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-transform"
              >
                Return to App
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentCallback;