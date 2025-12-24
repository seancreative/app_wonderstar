import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    CheckCircle2,
    XCircle,
    Loader2,
    AlertCircle,
    Home,
    Wallet,
    Star,
    ArrowRight,
    Trophy,
    Gift
} from 'lucide-react';
import { wpayService, WPayProfile, WPayTransaction } from '../services/wpayService';
import { wpayCache } from '../services/wpayCache';
import { useAuth } from '../contexts/AuthContext';
import confetti from 'canvas-confetti';

const WPayCallback: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, reloadUser } = useAuth();
    const hasProcessed = useRef(false);

    const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'cancelled'>('loading');
    const [message, setMessage] = useState('Verifying payment...');
    const [profile, setProfile] = useState<WPayProfile | null>(null);
    const [transaction, setTransaction] = useState<WPayTransaction | null>(null);
    const [confettiFired, setConfettiFired] = useState(false);
    const [starsAwarded, setStarsAwarded] = useState(0);
    const [bonusAwarded, setBonusAwarded] = useState(0);

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

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval = setInterval(() => {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);

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
        try {
            const orderId = searchParams.get('order_id');
            const wpayStatus = searchParams.get('wpay_status');
            const email = searchParams.get('email');
            const error = searchParams.get('error');

            console.log('[WPayCallback] ===== WPAY CALLBACK RECEIVED =====');
            console.log('[WPayCallback] URL Parameters:', { orderId, wpayStatus, email, error });

            if (error) {
                setStatus('failed');
                setMessage(error === 'system_error' ? 'A system error occurred' : error);
                return;
            }

            if (!orderId) {
                setStatus('failed');
                setMessage('Missing order reference');
                return;
            }

            // Small delay for UX
            setMessage('Verifying payment with server...');
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Fetch transaction details
            const result = await wpayService.getTransaction(orderId);
            console.log('[WPayCallback] Transaction result:', result);

            if (result.wpay_status === 'success' && result.transaction) {
                setTransaction(result.transaction);
                setProfile(result.profile || null);

                const txStatus = result.transaction.status;

                // If URL says success but transaction is pending, complete it manually
                // (This happens because Fiuu callback can't reach localhost)
                if (wpayStatus === 'success' && txStatus === 'pending') {
                    console.log('[WPayCallback] URL says success but tx is pending - completing manually...');
                    console.log('[WPayCallback] Note: Fiuu callback cannot reach localhost for server-to-server callback');

                    setMessage('Finalizing payment...');

                    try {
                        // Call manual complete endpoint
                        const completeResult = await wpayService.completeTransaction(orderId);
                        console.log('[WPayCallback] Complete result:', completeResult);

                        if (completeResult.wpay_status === 'success') {
                            // Re-fetch to get updated profile
                            const updatedResult = await wpayService.getTransaction(orderId);
                            if (updatedResult.transaction) {
                                setTransaction(updatedResult.transaction);
                                setStarsAwarded(updatedResult.transaction.stars_awarded || 0);
                            }
                            if (updatedResult.profile || completeResult.profile) {
                                setProfile(updatedResult.profile || completeResult.profile || null);
                            }

                            setStatus('success');
                            setMessage('Payment completed successfully!');

                            // Reload user data
                            if (user) {
                                try {
                                    await reloadUser();
                                } catch (e) {
                                    console.log('[WPayCallback] Could not reload user:', e);
                                }
                            }
                            return;
                        }
                    } catch (completeError) {
                        console.log('[WPayCallback] Manual complete failed:', completeError);
                    }

                    // If manual complete fails, still show success based on URL
                    setStatus('success');
                    setMessage('Payment completed! Balance will update shortly.');

                    // Calculate expected rewards from metadata
                    const metadata = result.transaction.metadata || {};
                    if (typeof metadata === 'string') {
                        try {
                            const parsed = JSON.parse(metadata);
                            const baseStars = parsed.base_stars || 0;
                            const extraStars = parsed.extra_stars || 0;
                            setStarsAwarded(baseStars + extraStars);
                            setBonusAwarded(parsed.bonus_amount || 0);
                        } catch (e) {
                            console.log('[WPayCallback] Could not parse metadata');
                        }
                    } else if (typeof metadata === 'object') {
                        const baseStars = metadata.base_stars || 0;
                        const extraStars = metadata.extra_stars || 0;
                        setStarsAwarded(baseStars + extraStars);
                        setBonusAwarded(metadata.bonus_amount || 0);
                    }
                    return;
                }

                // Transaction is completed
                if (txStatus === 'success') {
                    setStatus('success');
                    setMessage('Payment completed successfully!');
                    setStarsAwarded(result.transaction.stars_awarded || 0);

                    if (user) {
                        try {
                            await reloadUser();
                        } catch (e) {
                            console.log('[WPayCallback] Could not reload user:', e);
                        }
                    }
                } else if (txStatus === 'pending' || txStatus === 'processing') {
                    // Still processing - wait and retry
                    setMessage('Processing payment...');
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    const retryResult = await wpayService.getTransaction(orderId);
                    if (retryResult.transaction?.status === 'success') {
                        setTransaction(retryResult.transaction);
                        setProfile(retryResult.profile || null);
                        setStatus('success');
                        setMessage('Payment completed successfully!');
                        setStarsAwarded(retryResult.transaction.stars_awarded || 0);
                    } else {
                        // If still pending after retry, check URL status
                        if (wpayStatus === 'success') {
                            setStatus('success');
                            setMessage('Payment completed! Your balance will be updated shortly.');
                        } else {
                            setStatus('failed');
                            setMessage('Payment is still being processed. Please check your wallet.');
                        }
                    }
                } else if (txStatus === 'failed') {
                    setStatus('failed');
                    setMessage('Payment failed or was cancelled');
                } else {
                    setStatus('failed');
                    setMessage('Unknown payment status');
                }
            } else {
                // Transaction not found in database - check URL status
                if (wpayStatus === 'success') {
                    // Trust the URL - Fiuu confirmed success
                    setStatus('success');
                    setMessage('Payment completed!');

                    // Try to get profile by email (force refresh since we just completed payment)
                    if (email) {
                        const profileResult = await wpayCache.forceRefresh(email);
                        if (profileResult.profile) {
                            setProfile(profileResult.profile);
                        }
                    }
                } else if (wpayStatus === 'failed') {
                    setStatus('failed');
                    setMessage('Payment failed');
                } else {
                    setStatus('failed');
                    setMessage(result.message || 'Payment verification failed');
                }
            }

            // Clear URL parameters for clean display
            window.history.replaceState({}, document.title, '/wpay/callback');

        } catch (error) {
            console.error('[WPayCallback] Error:', error);

            // Even on error, check URL params
            const wpayStatus = searchParams.get('wpay_status');
            if (wpayStatus === 'success') {
                setStatus('success');
                setMessage('Payment completed! Your balance will be updated shortly.');
            } else {
                setStatus('failed');
                setMessage('An error occurred while verifying payment');
            }
        }
    };

    const getTierColor = (tier: string) => {
        return wpayService.getTierColor(tier as any);
    };

    const formatCurrency = (amount: number) => {
        return `RM${amount.toFixed(2)}`;
    };

    const handleViewWallet = () => {
        if (user) {
            sessionStorage.setItem('payment_completed', 'true');
            navigate('/wallet', { state: { fromPayment: true } });
        } else {
            navigate('/login');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="glass-strong rounded-3xl p-8 text-center space-y-6">

                    {/* Loading State */}
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

                    {/* Success State */}
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

                                {/* Transaction Details */}
                                {transaction && (
                                    <div className="p-4 bg-white/60 rounded-xl space-y-2">
                                        <p className="text-xs text-gray-600">Amount Paid</p>
                                        <p className="text-2xl font-black text-green-600">
                                            {formatCurrency(transaction.amount)}
                                        </p>

                                        {starsAwarded > 0 && (
                                            <div className="flex items-center justify-center gap-1 mt-2">
                                                <Star className="w-4 h-4 text-amber-500" fill="currentColor" />
                                                <p className="text-sm font-bold text-gray-700">
                                                    +{starsAwarded} stars earned
                                                </p>
                                            </div>
                                        )}

                                        {bonusAwarded > 0 && (
                                            <div className="flex items-center justify-center gap-1 mt-1">
                                                <Gift className="w-4 h-4 text-orange-500" />
                                                <p className="text-sm font-bold text-orange-600">
                                                    +{formatCurrency(bonusAwarded)} bonus added
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Profile Summary */}
                            {profile && (
                                <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-xl p-4 border border-primary-200">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Trophy className="w-5 h-5" style={{ color: getTierColor(profile.tier_type) }} />
                                            <span className="font-bold text-gray-800 capitalize">{profile.tier_type} Member</span>
                                        </div>
                                        <span className="text-xs text-gray-600">{profile.tier_factor}x Stars</span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                                        <div className="bg-white/60 rounded-lg p-2">
                                            <p className="text-xs text-gray-600">W-Balance</p>
                                            <p className="font-bold text-primary-600">{formatCurrency(profile.wbalance)}</p>
                                        </div>
                                        <div className="bg-white/60 rounded-lg p-2">
                                            <p className="text-xs text-gray-600">Bonus</p>
                                            <p className="font-bold text-orange-600">{formatCurrency(profile.bonus)}</p>
                                        </div>
                                        <div className="bg-white/60 rounded-lg p-2">
                                            <p className="text-xs text-gray-600">Stars</p>
                                            <p className="font-bold text-yellow-600">{profile.stars.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <button
                                onClick={handleViewWallet}
                                className="w-full py-3.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2"
                            >
                                <Wallet className="w-5 h-5" />
                                {user ? 'View Wallet' : 'Login to View Wallet'}
                                <ArrowRight className="w-5 h-5" />
                            </button>

                            <button
                                onClick={() => navigate(user ? '/home' : '/login')}
                                className="w-full py-3 bg-white/80 text-gray-700 rounded-xl font-semibold hover:bg-white transition-colors flex items-center justify-center gap-2"
                            >
                                <Home className="w-5 h-5" />
                                {user ? 'Back to Home' : 'Login'}
                            </button>
                        </>
                    )}

                    {/* Failed State */}
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
                                onClick={() => navigate('/wallet/topup')}
                                className="w-full py-3.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-transform"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={() => navigate(user ? '/home' : '/login')}
                                className="w-full py-3 bg-white/80 text-gray-700 rounded-xl font-semibold hover:bg-white transition-colors"
                            >
                                {user ? 'Back to Home' : 'Login'}
                            </button>
                        </>
                    )}

                    {/* Cancelled State */}
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
                                onClick={() => navigate('/wallet/topup')}
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

export default WPayCallback;
