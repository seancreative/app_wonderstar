import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { activityTimelineService } from '../services/activityTimelineService';
import {
  Baby, ArrowRight, ArrowLeft, User, Calendar, Camera, Check,
  Cpu, Palette, Code, TrendingUp, Beaker, Music, Dumbbell,
  Brain, Leaf, BookOpen, Calculator, Gamepad2, DollarSign, Sparkles, Upload, Video
} from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';

const WORKSHOP_CATEGORIES = [
  { id: 'robotics', name: 'Robotics', icon: Cpu },
  { id: 'art-craft', name: 'Art & Craft', icon: Palette },
  { id: 'ai-coding', name: 'AI & Coding', icon: Code },
  { id: 'entrepreneurship', name: 'Entrepreneurship', icon: TrendingUp },
  { id: 'science', name: 'Science Experiments', icon: Beaker },
  { id: 'music', name: 'Music & Performance', icon: Music },
  { id: 'sports', name: 'Sports & Movement', icon: Dumbbell },
  { id: 'puzzles', name: 'Puzzle & Brain Games', icon: Brain },
  { id: 'nature', name: 'Nature & Environment', icon: Leaf },
  { id: 'storytelling', name: 'Storytelling & Creativity', icon: BookOpen },
  { id: 'math', name: 'Math & Logic', icon: Calculator },
  { id: 'gaming', name: 'Gaming & Esports', icon: Gamepad2 },
];

const BUDGET_TIERS = [
  { id: 'essential', name: 'Essential Experiences', description: 'Core learning activities', icon: '$' },
  { id: 'enhanced', name: 'Enhanced Experiences', description: 'Expanded opportunities', icon: '$$' },
  { id: 'advanced', name: 'Advanced Experiences', description: 'Premium programs', icon: '$$$' },
  { id: 'full', name: 'Full Experience', description: 'All-inclusive access', icon: '$$$$' },
  { id: 'none', name: "I can't afford to grow their future", description: 'Limited budget', icon: '💙' },
];

const AddChild: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [childData, setChildData] = useState({
    name: '',
    gender: '' as 'male' | 'female' | '',
    photoUrl: '',
    dateOfBirth: '',
    workshopInterests: [] as string[],
    budgetTier: '' as 'essential' | 'enhanced' | 'advanced' | 'full' | 'none' | '',
  });

  const calculateAge = (dateOfBirth: string): number | null => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleNext = () => {
    if (step === 1 && (!childData.name || !childData.gender)) return;
    if (step === 3) {
      const age = childData.dateOfBirth ? calculateAge(childData.dateOfBirth) : null;
      if (age !== null && age > 12) return;
    }
    if (step === 5 && !childData.budgetTier) return;
    setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const toggleWorkshopInterest = (categoryId: string) => {
    setChildData(prev => ({
      ...prev,
      workshopInterests: prev.workshopInterests.includes(categoryId)
        ? prev.workshopInterests.filter(id => id !== categoryId)
        : [...prev.workshopInterests, categoryId]
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setChildData(prev => ({ ...prev, photoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setChildData(prev => ({ ...prev, photoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    setLoading(true);
    try {
      await supabase.from('child_profiles').insert({
        user_id: user.id,
        name: childData.name,
        gender: childData.gender || null,
        photo_url: childData.photoUrl || null,
        date_of_birth: childData.dateOfBirth || null,
        age: childData.dateOfBirth ? calculateAge(childData.dateOfBirth) : null,
        workshop_interests: childData.workshopInterests,
        budget_tier: childData.budgetTier || null,
      });

      // Log child profile addition activity
      try {
        await activityTimelineService.helpers.logChildAdded(user.id, childData.name);
      } catch (activityError) {
        console.warn('Failed to log child addition activity:', activityError);
      }

      setStep(7); // Success screen
    } catch (error) {
      console.error('Error adding child:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary-500 via-primary-600 to-pink-600 rounded-3xl flex items-center justify-center shadow-glow">
                <Baby className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-4xl font-black theme-text-primary">Add your little Star</h1>
              <p className="theme-text-secondary font-medium">
                Let's start with their name and gender
              </p>
            </div>

            <div className="glass p-6 rounded-3xl space-y-6 shadow-xl">
              <div>
                <label className="block text-sm font-bold theme-text-primary mb-2">
                  Child's Name
                </label>
                <input
                  type="text"
                  value={childData.name}
                  onChange={(e) => setChildData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-4 glass-light border-2 border-gray-200 rounded-xl theme-text-primary placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-bold text-lg"
                  placeholder="Enter child's name"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-bold theme-text-primary mb-3">
                  Gender
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setChildData(prev => ({ ...prev, gender: 'male' }))}
                    className={`flex-1 px-6 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 ${
                      childData.gender === 'male'
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg scale-105'
                        : 'glass-light border-2 border-gray-200 theme-text-secondary hover:border-blue-300 hover:scale-105'
                    }`}
                  >
                    <User className="w-6 h-6" />
                    Male
                  </button>
                  <button
                    type="button"
                    onClick={() => setChildData(prev => ({ ...prev, gender: 'female' }))}
                    className={`flex-1 px-6 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 ${
                      childData.gender === 'female'
                        ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-lg scale-105'
                        : 'glass-light border-2 border-gray-200 theme-text-secondary hover:border-pink-300 hover:scale-105'
                    }`}
                  >
                    <User className="w-6 h-6" />
                    Female
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-pink-500 via-purple-600 to-primary-600 rounded-3xl flex items-center justify-center shadow-glow">
                <Camera className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-4xl font-black theme-text-primary">Add a photo</h1>
              <p className="theme-text-secondary font-medium">
                Help us recognize {childData.name} for Face ID entry, safe check-in/out, and emergency response.
              </p>
            </div>

            <div className="glass p-6 rounded-3xl text-center shadow-xl space-y-6">
              {childData.photoUrl ? (
                <div className="space-y-4">
                  <div className="relative w-40 h-40 mx-auto">
                    <img
                      src={childData.photoUrl}
                      alt={childData.name}
                      className="w-full h-full rounded-full object-cover border-4 border-primary-300 shadow-glow"
                    />
                  </div>
                  <button
                    onClick={() => setChildData(prev => ({ ...prev, photoUrl: '' }))}
                    className="w-full py-3 bg-red-500 text-white rounded-xl font-bold hover:scale-105 transition-transform flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    Change Photo
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-40 h-40 mx-auto bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center border-4 border-dashed border-gray-300">
                    <Camera className="w-16 h-16 text-gray-400" />
                  </div>

                  <div className="space-y-3">
                    <label className="cursor-pointer block">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleCameraCapture}
                        className="hidden"
                      />
                      <div className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-bold hover:scale-105 transition-transform flex items-center justify-center gap-2">
                        <Camera className="w-5 h-5" />
                        Open Camera
                      </div>
                    </label>

                    <label className="cursor-pointer block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                      <div className="w-full py-4 glass-light border-2 border-primary-300 text-primary-600 rounded-xl font-bold hover:scale-105 transition-transform flex items-center justify-center gap-2">
                        <Upload className="w-5 h-5" />
                        Upload Photo
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        const age = childData.dateOfBirth ? calculateAge(childData.dateOfBirth) : null;
        const isOver12 = age !== null && age > 12;

        return (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-3xl flex items-center justify-center shadow-glow">
                <Calendar className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-4xl font-black theme-text-primary">When's their birthday?</h1>
              <p className="theme-text-secondary font-medium">
                So we can send them a special gift!
              </p>
            </div>

            <div className="glass p-6 rounded-3xl space-y-4 shadow-xl">
              <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <p className="text-sm text-blue-900 font-bold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Children profiles are for ages 12 and below only
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold theme-text-primary mb-2">
                  Date of Birth
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={childData.dateOfBirth}
                    onChange={(e) => setChildData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-4 glass-light border-2 border-gray-200 rounded-xl theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-bold text-lg"
                  />
                  <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
                {childData.dateOfBirth && age !== null && (
                  <p className={`text-sm font-medium mt-3 flex items-center gap-1 ${
                    isOver12 ? 'text-red-600' : 'theme-text-secondary'
                  }`}>
                    <Sparkles className={`w-4 h-4 ${isOver12 ? 'text-red-600' : 'text-primary-600'}`} />
                    <span className={`font-bold ${isOver12 ? 'text-red-600' : 'text-primary-600'}`}>Age: {age} years old</span>
                  </p>
                )}
              </div>

              {isOver12 ? (
                <div className="p-6 bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 border-2 border-purple-200 rounded-2xl space-y-4 text-center">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center shadow-glow animate-pulse-glow">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-transparent bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text">
                      They're ready for their own adventure!
                    </h3>
                    <p className="text-gray-700 font-medium">
                      For children over 12, we recommend creating their own WonderStars account so they can explore, learn, and earn rewards independently.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/signup')}
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-black hover:scale-105 active:scale-95 transition-all shadow-lg"
                  >
                    Create Their Own Account
                  </button>
                  <button
                    onClick={() => setChildData(prev => ({ ...prev, dateOfBirth: '' }))}
                    className="w-full py-3 glass-light border-2 border-gray-300 theme-text-secondary rounded-xl font-bold hover:scale-105 transition-all"
                  >
                    Enter Different Birthday
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleNext}
                  className="w-full py-3 glass-light border-2 border-gray-300 theme-text-secondary rounded-xl font-bold hover:scale-105 transition-all"
                >
                  Skip for now
                </button>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-green-400 via-teal-500 to-cyan-600 rounded-3xl flex items-center justify-center shadow-glow">
                <Sparkles className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-3xl font-black theme-text-primary">What are they interested in?</h1>
              <p className="theme-text-secondary font-medium">
                Choose as many as you like
              </p>
            </div>

            <div className="glass p-6 rounded-3xl shadow-xl">
              <div className="grid grid-cols-2 gap-3">
                {WORKSHOP_CATEGORIES.map((category) => {
                  const Icon = category.icon;
                  const isSelected = childData.workshopInterests.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleWorkshopInterest(category.id)}
                      className={`p-4 rounded-xl transition-all flex flex-col items-center gap-2 ${
                        isSelected
                          ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg scale-105'
                          : 'glass-light border-2 border-gray-200 theme-text-secondary hover:border-primary-300 hover:scale-105'
                      }`}
                    >
                      <Icon className="w-8 h-8" />
                      <span className="text-xs font-bold text-center leading-tight">{category.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-purple-400 via-pink-500 to-rose-600 rounded-3xl flex items-center justify-center shadow-glow">
                <DollarSign className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-3xl font-black theme-text-primary">Which learning experience?</h1>
              <p className="theme-text-secondary font-medium">
                What works best for your family
              </p>
            </div>

            <div className="space-y-3">
              {BUDGET_TIERS.map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setChildData(prev => ({ ...prev, budgetTier: tier.id as any }))}
                  className={`w-full p-5 rounded-2xl transition-all flex items-center gap-4 ${
                    childData.budgetTier === tier.id
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-glow scale-105'
                      : 'glass border-2 border-gray-200 hover:border-primary-300 hover:scale-105'
                  }`}
                >
                  <div className={`text-3xl ${childData.budgetTier === tier.id ? '' : 'opacity-60'}`}>
                    {tier.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`font-black text-lg ${childData.budgetTier === tier.id ? 'text-white' : 'theme-text-primary'}`}>
                      {tier.name}
                    </p>
                    <p className={`text-sm font-medium ${childData.budgetTier === tier.id ? 'text-white/90' : 'theme-text-secondary'}`}>
                      {tier.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6 animate-slide-up text-center">
            <div className="space-y-4">
              <div className="w-32 h-32 mx-auto bg-gradient-to-br from-primary-500 via-primary-600 to-pink-600 rounded-full flex items-center justify-center shadow-glow animate-bounce-soft">
                {childData.photoUrl ? (
                  <img
                    src={childData.photoUrl}
                    alt={childData.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-5xl font-black text-white">
                    {childData.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <h1 className="text-4xl font-black theme-text-primary">Review Details</h1>
              <p className="theme-text-secondary font-medium">
                Make sure everything looks good
              </p>
            </div>

            <div className="glass p-6 rounded-3xl space-y-4 shadow-xl text-left">
              <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl">
                <User className="w-6 h-6 theme-text-secondary" />
                <div>
                  <p className="text-xs theme-text-secondary font-semibold">Name</p>
                  <p className="font-bold theme-text-primary">{childData.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl">
                <User className="w-6 h-6 theme-text-secondary" />
                <div>
                  <p className="text-xs theme-text-secondary font-semibold">Gender</p>
                  <p className="font-bold theme-text-primary capitalize">{childData.gender}</p>
                </div>
              </div>

              {childData.dateOfBirth && (
                <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl">
                  <Calendar className="w-6 h-6 theme-text-secondary" />
                  <div>
                    <p className="text-xs theme-text-secondary font-semibold">Birthday</p>
                    <p className="font-bold theme-text-primary">
                      {new Date(childData.dateOfBirth).toLocaleDateString()} ({calculateAge(childData.dateOfBirth)} years)
                    </p>
                  </div>
                </div>
              )}

              {childData.workshopInterests.length > 0 && (
                <div className="p-3 bg-white/50 rounded-xl">
                  <p className="text-xs theme-text-secondary font-semibold mb-2">Interests</p>
                  <div className="flex flex-wrap gap-2">
                    {childData.workshopInterests.map(id => {
                      const category = WORKSHOP_CATEGORIES.find(c => c.id === id);
                      return category ? (
                        <span key={id} className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-bold">
                          {category.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {childData.budgetTier && (
                <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl">
                  <DollarSign className="w-6 h-6 theme-text-secondary" />
                  <div>
                    <p className="text-xs theme-text-secondary font-semibold">Learning Experience</p>
                    <p className="font-bold theme-text-primary">
                      {BUDGET_TIERS.find(t => t.id === childData.budgetTier)?.name}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-2xl font-black shadow-glow hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
            >
              {loading ? 'Saving...' : 'Confirm & Save'}
              <Check className="w-6 h-6" />
            </button>
          </div>
        );

      case 7:
        return (
          <div className="space-y-6 animate-pop-in text-center">
            <div className="space-y-4">
              <div className="w-32 h-32 mx-auto bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-glow animate-pulse-glow">
                <Check className="w-16 h-16 text-white" strokeWidth={3} />
              </div>
              <h1 className="text-4xl font-black text-transparent bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text">
                Congratulations!
              </h1>
              <p className="text-2xl font-bold theme-text-primary">
                We've added little star {childData.name}!
              </p>
              <p className="theme-text-secondary font-medium">
                Your family profile is now complete
              </p>
            </div>

            <div className="glass p-8 rounded-3xl shadow-xl">
              {childData.photoUrl ? (
                <img
                  src={childData.photoUrl}
                  alt={childData.name}
                  className="w-32 h-32 mx-auto rounded-full object-cover border-4 border-primary-300 shadow-glow mb-4"
                />
              ) : (
                <div className="w-32 h-32 mx-auto bg-gradient-to-br from-primary-500 via-primary-600 to-pink-600 rounded-full flex items-center justify-center shadow-glow mb-4">
                  <span className="text-5xl font-black text-white">
                    {childData.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <h2 className="text-2xl font-black theme-text-primary mb-2">{childData.name}</h2>
              <p className="theme-text-secondary font-medium">
                {childData.age ? `${childData.age} years old` : 'Little Star'}
              </p>
            </div>

            <button
              onClick={() => navigate('/profile')}
              className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-2xl font-black shadow-glow hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2 text-lg"
            >
              Go to Profile
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen pb-28">
      <PageHeader />
      <div className="max-w-md mx-auto px-6 pt-6 space-y-6">
        {step < 7 && (
          <div className="flex items-center justify-between mb-4">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="p-3 glass rounded-xl hover:scale-105 transition-transform"
              >
                <ArrowLeft className="w-6 h-6 theme-text-secondary" />
              </button>
            )}
            <div className="flex-1 mx-4">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-300"
                  style={{ width: `${(step / 6) * 100}%` }}
                />
              </div>
              <p className="text-xs theme-text-secondary font-bold mt-2 text-center">
                Step {step} of 6
              </p>
            </div>
            {step > 1 && <div className="w-12" />}
          </div>
        )}

        {renderStep()}

        {step >= 1 && step < 6 && (
          <button
            onClick={handleNext}
            disabled={(step === 1 && (!childData.name || !childData.gender)) || (step === 5 && !childData.budgetTier)}
            className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-2xl font-black shadow-glow hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
          >
            Continue
            <ArrowRight className="w-6 h-6" />
          </button>
        )}

        {step === 1 && (
          <button
            onClick={() => navigate('/home')}
            className="w-full py-4 glass border-2 border-gray-300 theme-text-secondary rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
};

export default AddChild;
