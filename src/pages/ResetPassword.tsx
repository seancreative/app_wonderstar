import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lock, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

const ResetPassword: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [tokenValid, setTokenValid] = useState(false);

    const token = searchParams.get('token');
    const email = searchParams.get('email');

    useEffect(() => {
        // Verify token on component mount
        const verifyToken = async () => {
            if (!token || !email) {
                setError('Invalid reset link');
                setVerifying(false);
                return;
            }

            try {
                const response = await fetch(API_ENDPOINTS.PASSWORD_VERIFY_TOKEN, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, token }),
                });

                const data = await response.json();

                if (data.valid) {
                    setTokenValid(true);
                } else {
                    setError(data.message || 'Invalid or expired reset link');
                }
            } catch (err: any) {
                setError('Failed to verify reset link');
            } finally {
                setVerifying(false);
            }
        };

        verifyToken();
    }, [token, email]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validation
        if (password.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(API_ENDPOINTS.PASSWORD_RESET, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, token, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to reset password');
            }

            setSuccess(true);

            // Redirect to login after 3 seconds
            setTimeout(() => {
                navigate('/');
            }, 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    if (verifying) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-pink-500 mx-auto"></div>
                    <p className="text-white text-lg">Verifying reset link...</p>
                </div>
            </div>
        );
    }

    if (!tokenValid && !verifying) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <button
                    onClick={() => navigate('/')}
                    className="absolute top-6 left-6 p-3 glass-magical rounded-xl text-white hover:scale-110 transition-all z-20 backdrop-blur-xl bg-white/15 border border-white/25"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>

                <div className="z-10 w-full max-w-md space-y-8 animate-slide-up">
                    <div className="glass-magical rounded-3xl p-8 backdrop-blur-xl bg-white/15 border border-white/25 shadow-2xl">
                        <div className="flex flex-col items-center space-y-4 text-center">
                            <AlertCircle className="w-16 h-16 text-red-400" />
                            <h3 className="text-xl font-semibold text-white">Invalid Reset Link</h3>
                            <p className="text-white/80">{error}</p>
                            <button
                                onClick={() => navigate('/forgot-password')}
                                className="w-full py-3 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white rounded-xl font-bold shadow-xl hover:scale-105 hover:shadow-2xl active:scale-95 transition-all duration-200"
                            >
                                Request New Link
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <button
                onClick={() => navigate('/')}
                className="absolute top-6 left-6 p-3 glass-magical rounded-xl text-white hover:scale-110 transition-all z-20 backdrop-blur-xl bg-white/15 border border-white/25"
            >
                <ArrowLeft className="w-6 h-6" />
            </button>

            <div className="z-10 w-full max-w-md space-y-8 animate-slide-up">
                <div className="text-center space-y-6">
                    <div className="flex justify-center">
                        <div className="relative">
                            <img
                                src="/wonderstar-nobg.png"
                                alt="WonderStars Logo"
                                className="h-32 w-auto drop-shadow-2xl animate-bounce-soft"
                            />
                            <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-300 animate-twinkle" />
                            <Sparkles className="absolute -bottom-2 -left-2 w-6 h-6 text-pink-300 animate-twinkle" style={{ animationDelay: '0.5s' }} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold text-white drop-shadow-lg">Reset Password</h1>
                        <p className="text-white/80 drop-shadow-md">
                            {success ? "Password reset successful!" : "Enter your new password"}
                        </p>
                    </div>
                </div>

                {success ? (
                    <div className="glass-magical rounded-3xl p-8 backdrop-blur-xl bg-white/15 border border-white/25 shadow-2xl animate-scale-in">
                        <div className="flex flex-col items-center space-y-4 text-center">
                            <CheckCircle className="w-16 h-16 text-green-400 animate-pulse" />
                            <h3 className="text-xl font-semibold text-white">Password Reset!</h3>
                            <p className="text-white/80">
                                Your password has been successfully reset.
                            </p>
                            <p className="text-white/70 text-sm">
                                Redirecting to login...
                            </p>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 animate-scale-in">
                        <div className="glass-magical rounded-3xl p-6 space-y-4 backdrop-blur-xl bg-white/15 border border-white/25 shadow-2xl hover:bg-white/20 transition-all duration-300">
                            <div>
                                <label className="block text-sm font-medium text-white/90 mb-2">
                                    New Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-pink-400/50 focus:bg-white/25 focus:border-pink-400/50 transition-all"
                                        placeholder="Enter new password"
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white/90 mb-2">
                                    Confirm Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-pink-400/50 focus:bg-white/25 focus:border-pink-400/50 transition-all"
                                        placeholder="Confirm new password"
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/30 backdrop-blur-sm border border-red-400/50 rounded-xl text-white text-sm animate-shake">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white rounded-xl font-bold text-lg shadow-xl hover:scale-105 hover:shadow-2xl active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed animate-pulse-gentle"
                            >
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </button>

                            <div className="text-center text-sm">
                                <button
                                    type="button"
                                    onClick={() => navigate('/')}
                                    className="text-white font-semibold hover:underline hover:text-pink-300 transition-colors"
                                >
                                    ← Back to Login
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;