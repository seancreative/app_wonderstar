import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Sparkles, Gift, Star, Stamp, Box, Trophy, Users, Zap, Sparkle, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { supabase } from '../lib/supabase';
import VersionModal from '../components/VersionModal';

const benefits = [
  { icon: Zap, title: 'Exclusive Discount', color: 'from-orange-400 to-pink-500' },
  { icon: Star, title: 'Earn Stars', color: 'from-yellow-400 to-orange-500' },
  { icon: Stamp, title: 'Earn Stamps', color: 'from-blue-400 to-purple-500' },
  { icon: Box, title: 'Mystery Box', color: 'from-purple-400 to-pink-500' },
  { icon: Gift, title: 'Redeem Gifts', color: 'from-pink-400 to-red-500' },
  { icon: Users, title: 'Events Invitation', color: 'from-green-400 to-teal-500' },
  { icon: Trophy, title: 'VIP Lane', color: 'from-amber-400 to-yellow-500' },
  { icon: Sparkle, title: 'Many Benefits!', color: 'from-indigo-400 to-purple-500' },
];

const Welcome: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { login: adminLogin } = useAdminAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('...');

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % benefits.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadLatestVersion();
  }, []);

  const loadLatestVersion = async () => {
    try {
      const { data, error } = await supabase
        .from('app_versions')
        .select('version')
        .order('release_date', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setCurrentVersion(data.version);
      }
    } catch (error) {
      console.error('Failed to load version');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formData.email, formData.password);
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Failed to log in');
    } finally {
      setLoading(false);
    }
  };

  const handleDevMode = async () => {
    setLoading(true);
    setError('');

    try {
      const { data: existingUsers, error: selectError } = await supabase
        .from('users')
        .select('*')
        .limit(1);

      if (selectError) throw selectError;

      if (existingUsers && existingUsers.length > 0) {
        // No localStorage - demo users not supported anymore
        // Users must sign up with proper accounts
        setError('Demo mode disabled. Please sign up for a real account.');
        return;
      } else {
        const randomCode = 'DEMO' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const randomEmail = 'demo' + Math.random().toString(36).substring(2, 8) + '@wonderstars.com';

        const { data, error } = await supabase
          .from('users')
          .insert({
            name: 'Demo User',
            email: randomEmail,
            phone: '+60123456789',
            referral_code: randomCode,
          })
          .select()
          .single();

        if (error) throw error;
        if (!data) throw new Error('No data returned from insert');

        // No localStorage - demo users not supported anymore
        setError('Demo mode disabled. Please sign up for a real account.');
        return;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create demo account');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminAccess = async () => {
    setLoading(true);
    setError('');

    try {
      // Directly login with admin credentials
      await adminLogin('admin@wonderstars.com', 'Admin123!');
      // Navigate directly to CMS dashboard
      navigate('/cms');
    } catch (err: any) {
      setError(err.message || 'Failed to access admin panel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
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

          <div className="relative overflow-hidden h-20 animate-slide-up">
            <div className="absolute inset-0 flex items-center justify-center">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                const isActive = index === currentSlide;
                const isPrev = index === (currentSlide - 1 + benefits.length) % benefits.length;
                const isNext = index === (currentSlide + 1) % benefits.length;

                return (
                  <div
                    key={index}
                    className={`absolute transition-all duration-700 ease-in-out ${
                      isActive
                        ? 'opacity-100 scale-100 translate-x-0'
                        : isPrev
                        ? 'opacity-0 scale-75 -translate-x-full'
                        : isNext
                        ? 'opacity-0 scale-75 translate-x-full'
                        : 'opacity-0 scale-50'
                    }`}
                  >
                    <div className="flex items-center gap-4 px-4">
                      <Icon className="w-10 h-10 text-white drop-shadow-lg flex-shrink-0" />
                      <h2 className="text-2xl font-bold text-white drop-shadow-lg">
                        {benefit.title}
                      </h2>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-2">
              {benefits.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentSlide
                      ? 'bg-white w-6 shadow-lg'
                      : 'bg-white/40 hover:bg-white/60'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 animate-scale-in">
          <div className="glass-magical rounded-3xl p-6 space-y-4 backdrop-blur-xl bg-white/15 border border-white/25 shadow-2xl hover:bg-white/20 transition-all duration-300">
            <div>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-pink-400/50 focus:bg-white/25 focus:border-pink-400/50 transition-all"
                  placeholder="Email address"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-pink-400/50 focus:bg-white/25 focus:border-pink-400/50 transition-all"
                  placeholder="Password"
                  autoComplete="new-password"
                  required
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
              {loading ? 'Logging in...' : 'Login'}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => navigate('/signup')}
                className="text-white font-semibold hover:underline hover:text-pink-300 transition-colors"
              >
                Create Your Account →
              </button>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-white/80 hover:text-pink-300 hover:underline transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          </div>
        </form>

        <div className="text-center space-y-2">
          <button
            onClick={() => setShowVersionModal(true)}
            className="text-white font-semibold hover:underline hover:text-pink-300 transition-colors"
          >
            Built V{currentVersion}
          </button>
          <a href="https://www.craveasia.com/" target="_blank" rel="noopener noreferrer" className="text-white font-semibold hover:underline hover:text-pink-300 transition-colors"> | Powered by CRAVE</a>
        </div>
      </div>

      <VersionModal
        isOpen={showVersionModal}
        onClose={() => setShowVersionModal(false)}
        currentVersion={currentVersion}
      />
    </div>
  );
};

export default Welcome;
