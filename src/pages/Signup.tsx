import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, User, Mail, Phone, Lock, Sparkles, MapPin, Globe, Shield, Check, AlertCircle, Loader2 } from 'lucide-react';
import ProductShowcase from '../components/ProductShowcase';
import { API_BASE_URL } from '../config/api';

const Signup: React.FC = () => {

  const navigate = useNavigate();
  const { signup } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    countryCode: '+60',
    phone: '',
    country: 'Malaysia',
    state: '',
    zipcode: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
    receiveNews: false,
  });

  const [step, setStep] = useState<'phone' | 'details'>('phone');

  const [verificationState, setVerificationState] = useState({
    otpSent: false,
    otpCode: '',
    verified: false,
    sending: false,
    verifying: false,
    countdown: 0,
    canResend: true,
    attemptsRemaining: 3,
  });

  const [verificationError, setVerificationError] = useState('');
  const [verificationSuccess, setVerificationSuccess] = useState('');

  const malaysianStates = [
    'Johor', 'Kedah', 'Kelantan', 'Malacca', 'Negeri Sembilan',
    'Pahang', 'Penang', 'Perak', 'Perlis', 'Sabah',
    'Sarawak', 'Selangor', 'Terengganu', 'Kuala Lumpur'
  ];

  const countries = [
    { code: '+60', name: 'Malaysia', flag: '🇲🇾' },
  ];

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (verificationState.countdown > 0) {
      timer = setTimeout(() => {
        setVerificationState(prev => ({
          ...prev,
          countdown: prev.countdown - 1,
          canResend: prev.countdown - 1 === 0
        }));
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [verificationState.countdown]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async () => {
    setVerificationError('');
    setVerificationSuccess('');
    setVerificationState(prev => ({ ...prev, sending: true }));

    try {
      const fullPhone = `+60${formData.phone}`;
      console.log('[Signup] Sending OTP to:', fullPhone);

      // Call Laravel backend API
      const response = await fetch(`${API_BASE_URL}/otp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ phone: fullPhone })
      });

      const data = await response.json();
      console.log('[Signup] Laravel API response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setVerificationState(prev => ({
        ...prev,
        otpSent: true,
        sending: false,
        countdown: 60,
        canResend: false,
      }));

      setVerificationSuccess('Verification code sent! Check your SMS.');
      console.log('[Signup] OTP sent successfully');

      setTimeout(() => setVerificationSuccess(''), 5000);
    } catch (err: any) {
      console.error('[Signup] Failed to send OTP:', err);
      const errorMessage = err.message || 'Failed to send verification code. Please check your connection and try again.';
      setVerificationError(errorMessage);
      setVerificationState(prev => ({ ...prev, sending: false }));
    }
  };

  const handleVerifyOTP = async (code: string) => {
    setVerificationError('');
    setVerificationSuccess('');
    setVerificationState(prev => ({ ...prev, verifying: true }));

    try {
      const fullPhone = `+60${formData.phone}`;
      console.log('[Signup] Verifying OTP for:', fullPhone);
      console.log('[Signup] Code:', code);

      // Call Laravel backend API
      const response = await fetch(`${API_BASE_URL}/otp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ phone: fullPhone, code })
      });

      const data = await response.json();
      console.log('[Signup] Laravel API response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setVerificationState(prev => ({
        ...prev,
        verified: true,
        verifying: false,
        otpCode: ''
      }));

      setVerificationSuccess('Phone number verified successfully!');
      console.log('[Signup] Phone verified successfully');

      setTimeout(() => {
        setStep('details');
      }, 1500);
    } catch (err: any) {
      console.error('[Signup] Failed to verify OTP:', err);
      const errorMessage = err.message || 'Invalid verification code. Please try again.';
      setVerificationError(errorMessage);
      setVerificationState(prev => ({ ...prev, verifying: false, otpCode: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (!formData.agreeTerms) {
      setError('Please agree to the terms and conditions');
      setLoading(false);
      return;
    }

    if (!verificationState.verified) {
      setError('Please verify your phone number before registering');
      setLoading(false);
      return;
    }

    try {
      const fullPhone = `${formData.countryCode}${formData.phone}`;
      await signup(
        formData.name,
        formData.email,
        fullPhone,
        formData.password,
        formData.country,
        formData.state,
        formData.zipcode,
        formData.agreeTerms,
        formData.receiveNews
      );
      navigate('/add-child');
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <button
        onClick={() => navigate(-1)}
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
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">Create Account</h1>
            <p className="text-white/80 drop-shadow-md">Join the WonderStars family</p>
          </div>
        </div>

        <ProductShowcase />

        <form onSubmit={handleSubmit} className="space-y-4 animate-scale-in">
          {step === 'phone' ? (
            <div className="glass-magical rounded-3xl p-6 space-y-6 backdrop-blur-xl bg-white/15 border border-white/25 shadow-2xl hover:bg-white/20 transition-all duration-300">
              <div className="text-center space-y-2">
                <Shield className="w-16 h-16 mx-auto text-cyan-300 drop-shadow-lg" />
                <h2 className="text-2xl font-bold text-white">Phone Verification</h2>
                <p className="text-white/80 text-sm">We'll send you a verification code to confirm your number</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Phone Number
                </label>
                <div className="flex gap-2">
                  <div className="w-20 px-3 py-3.5 bg-white/30 backdrop-blur-sm border border-white/40 rounded-xl text-white flex items-center justify-center font-bold">
                    +60
                  </div>
                  <div className="relative flex-1">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                      className="w-full pl-12 pr-4 py-3.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-pink-400/50 focus:bg-white/25 focus:border-pink-400/50 transition-all"
                      placeholder="123456789"
                      required
                      minLength={9}
                      maxLength={11}
                    />
                  </div>
                  {verificationState.verified && (
                    <div className="flex items-center justify-center w-12 bg-green-500/30 border border-green-400/50 rounded-xl">
                      <Check className="w-6 h-6 text-green-300" />
                    </div>
                  )}
                </div>

                {!verificationState.verified && formData.phone.length >= 9 && (
                  <button
                    type="button"
                    onClick={handleSendOTP}
                    disabled={verificationState.sending || !verificationState.canResend}
                    className="mt-3 w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                  >
                    {verificationState.sending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Sending...
                      </>
                    ) : verificationState.otpSent && !verificationState.canResend ? (
                      `Resend in ${verificationState.countdown}s`
                    ) : verificationState.otpSent ? (
                      <>
                        <Shield className="w-5 h-5" />
                        Resend Code
                      </>
                    ) : (
                      <>
                        <Shield className="w-5 h-5" />
                        Verify Phone Number via SMS
                      </>
                    )}
                  </button>
                )}

                {verificationState.otpSent && !verificationState.verified && (
                  <div className="mt-4 space-y-3">
                    <label className="block text-sm font-medium text-white/90">
                      Enter 6-Digit Verification Code
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={verificationState.otpCode}
                        onChange={(e) => {
                          const code = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setVerificationState(prev => ({ ...prev, otpCode: code }));
                          if (code.length === 6) {
                            handleVerifyOTP(code);
                          }
                        }}
                        className="w-full px-4 py-3.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white text-center text-2xl font-bold tracking-widest placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:bg-white/25 focus:border-cyan-400/50 transition-all"
                        placeholder="000000"
                        maxLength={6}
                        autoFocus
                      />
                      {verificationState.verifying && (
                        <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-white animate-spin" />
                      )}
                    </div>
                    <p className="text-xs text-white/70 text-center">
                      Code sent to +60{formData.phone}. Expires in 5 minutes.
                    </p>
                  </div>
                )}

                {verificationError && (
                  <div className="mt-3 p-3 bg-red-500/30 backdrop-blur-sm border border-red-400/50 rounded-xl text-white text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {verificationError}
                  </div>
                )}

                {verificationSuccess && (
                  <div className="mt-3 p-3 bg-green-500/30 backdrop-blur-sm border border-green-400/50 rounded-xl text-white text-sm flex items-center gap-2">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    {verificationSuccess}
                  </div>
                )}

                {!verificationState.verified && formData.phone.length >= 9 && (
                  <div className="mt-3 p-3 bg-red-500/20 backdrop-blur-sm border border-red-400/50 rounded-xl text-white/90 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span><strong>Phone verification is required</strong> to complete registration. Please verify your number to continue.</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-magical rounded-3xl p-6 space-y-4 backdrop-blur-xl bg-white/15 border border-white/25 shadow-2xl hover:bg-white/20 transition-all duration-300">
              <div className="space-y-2 pb-4">
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to phone
                </button>
                <div className="flex items-center justify-center gap-2">
                  <Check className="w-6 h-6 text-green-400" />
                  <span className="text-white/80">Phone Verified: +60{formData.phone}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Parent Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-12 pr-4 py-3.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-pink-400/50 focus:bg-white/25 focus:border-pink-400/50 transition-all"
                    placeholder="Your name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-12 pr-4 py-3.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-pink-400/50 focus:bg-white/25 focus:border-pink-400/50 transition-all"
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Country
                </label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
                  <select
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full pl-12 pr-4 py-3.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-pink-400/50 focus:bg-white/25 focus:border-pink-400/50 transition-all appearance-none"
                    required
                  >
                    {countries.map((country) => (
                      <option key={country.name} value={country.name} className="bg-purple-900">
                        {country.flag} {country.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  State
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full pl-12 pr-4 py-3.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-pink-400/50 focus:bg-white/25 focus:border-pink-400/50 transition-all appearance-none"
                    required
                  >
                    <option value="" className="bg-purple-900">Select state</option>
                    {malaysianStates.map((state) => (
                      <option key={state} value={state} className="bg-purple-900">
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Zipcode
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
                  <input
                    type="text"
                    value={formData.zipcode}
                    onChange={(e) => setFormData({ ...formData, zipcode: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                    className="w-full pl-12 pr-4 py-3.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-pink-400/50 focus:bg-white/25 focus:border-pink-400/50 transition-all"
                    placeholder="12345"
                    required
                    maxLength={5}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-12 pr-4 py-3.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-pink-400/50 focus:bg-white/25 focus:border-pink-400/50 transition-all"
                    placeholder="Choose a password"
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
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full pl-12 pr-4 py-3.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-pink-400/50 focus:bg-white/25 focus:border-pink-400/50 transition-all"
                    placeholder="Re-enter password"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.agreeTerms}
                    onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
                    className="mt-1 w-5 h-5 rounded border-2 border-white/30 bg-white/20 checked:bg-pink-500 checked:border-pink-500 focus:ring-2 focus:ring-pink-400/50 transition-all cursor-pointer"
                    required
                  />
                  <span className="text-sm text-white/90 group-hover:text-white transition-colors">
                    I agree to the <button type="button" className="underline font-semibold hover:text-pink-300">Terms and Conditions</button> and <button type="button" className="underline font-semibold hover:text-pink-300">Privacy Policy</button>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.receiveNews}
                    onChange={(e) => setFormData({ ...formData, receiveNews: e.target.checked })}
                    className="mt-1 w-5 h-5 rounded border-2 border-white/30 bg-white/20 checked:bg-pink-500 checked:border-pink-500 focus:ring-2 focus:ring-pink-400/50 transition-all cursor-pointer"
                  />
                  <span className="text-sm text-white/90 group-hover:text-white transition-colors">
                    I want to receive WonderPark's latest news, promos and exclusive invitations
                  </span>
                </label>
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
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>

              <div className="text-center text-sm">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-white font-semibold hover:underline hover:text-pink-300 transition-colors"
                >
                  ← Already have an account? Login
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default Signup;