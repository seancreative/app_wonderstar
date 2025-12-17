import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { activityTimelineService } from '../services/activityTimelineService';
import { useAuth } from '../contexts/AuthContext';
import {
  X, User, Calendar, Camera, Check, ArrowLeft, ArrowRight,
  Cpu, Palette, Code, TrendingUp, Beaker, Music, Dumbbell,
  Brain, Leaf, BookOpen, Calculator, Gamepad2, DollarSign, Sparkles
} from 'lucide-react';
import type { ChildProfile } from '../types/database';

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

interface EditChildModalProps {
  child: ChildProfile;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const EditChildModal: React.FC<EditChildModalProps> = ({ child, isOpen, onClose, onUpdate }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [childData, setChildData] = useState({
    name: child.name,
    gender: (child.gender || '') as 'male' | 'female' | '',
    photoUrl: child.photo_url || '',
    dateOfBirth: child.date_of_birth || '',
    workshopInterests: Array.isArray(child.workshop_interests) ? child.workshop_interests : [],
    budgetTier: (child.budget_tier || '') as 'essential' | 'enhanced' | 'advanced' | 'full' | 'none' | '',
  });

  useEffect(() => {
    if (isOpen) {
      setChildData({
        name: child.name,
        gender: (child.gender || '') as 'male' | 'female' | '',
        photoUrl: child.photo_url || '',
        dateOfBirth: child.date_of_birth || '',
        workshopInterests: Array.isArray(child.workshop_interests) ? child.workshop_interests : [],
        budgetTier: (child.budget_tier || '') as 'essential' | 'enhanced' | 'advanced' | 'full' | 'none' | '',
      });
      setStep(1);
    }
  }, [child, isOpen]);

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

  const { user } = useAuth();

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await supabase
        .from('child_profiles')
        .update({
          name: childData.name,
          gender: childData.gender || null,
          photo_url: childData.photoUrl || null,
          date_of_birth: childData.dateOfBirth || null,
          age: childData.dateOfBirth ? calculateAge(childData.dateOfBirth) : null,
          workshop_interests: childData.workshopInterests,
          budget_tier: childData.budgetTier || null,
        })
        .eq('id', child.id);

      // Log child profile update activity
      if (user) {
        try {
          await activityTimelineService.logActivity({
            userId: user.id,
            activityType: 'child_updated',
            activityCategory: 'profile',
            title: 'Updated Child Profile',
            description: `Updated profile for ${childData.name}`,
            metadata: { child_id: child.id, child_name: childData.name },
            icon: 'Baby'
          });
        } catch (activityError) {
          console.warn('Failed to log child update activity:', activityError);
        }
      }

      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating child:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
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
        );

      case 2:
        return (
          <div className="space-y-6 text-center">
            {childData.photoUrl ? (
              <div className="relative w-40 h-40 mx-auto">
                <img
                  src={childData.photoUrl}
                  alt={childData.name}
                  className="w-full h-full rounded-full object-cover border-4 border-primary-300 shadow-glow"
                />
                <button
                  onClick={() => setChildData(prev => ({ ...prev, photoUrl: '' }))}
                  className="absolute bottom-0 right-0 p-3 bg-red-500 text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <div className="w-40 h-40 mx-auto bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center border-4 border-dashed border-gray-300 hover:border-primary-500 transition-all hover:scale-105">
                  <Camera className="w-16 h-16 text-gray-400" />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <p className="mt-4 font-bold text-primary-600">Tap to upload photo</p>
              </label>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
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
              {childData.dateOfBirth && (
                <p className="text-sm theme-text-secondary font-medium mt-3 flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-primary-600" />
                  <span className="text-primary-600 font-bold">Age: {calculateAge(childData.dateOfBirth)} years old</span>
                </p>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-black theme-text-primary text-center">What are they interested in?</h3>
            <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
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
        );

      case 5:
        return (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-black theme-text-primary text-center sticky top-0 bg-white/95 backdrop-blur pb-2">
              Which learning experience?
            </h3>
            {BUDGET_TIERS.map((tier) => (
              <button
                key={tier.id}
                type="button"
                onClick={() => setChildData(prev => ({ ...prev, budgetTier: tier.id as any }))}
                className={`w-full p-4 rounded-2xl transition-all flex items-center gap-3 ${
                  childData.budgetTier === tier.id
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-glow scale-105'
                    : 'glass border-2 border-gray-200 hover:border-primary-300 hover:scale-105'
                }`}
              >
                <div className={`text-2xl ${childData.budgetTier === tier.id ? '' : 'opacity-60'}`}>
                  {tier.icon}
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-black ${childData.budgetTier === tier.id ? 'text-white' : 'theme-text-primary'}`}>
                    {tier.name}
                  </p>
                  <p className={`text-xs font-medium ${childData.budgetTier === tier.id ? 'text-white/90' : 'theme-text-secondary'}`}>
                    {tier.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto animate-pop-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 glass rounded-xl hover:scale-110 transition-transform z-10"
        >
          <X className="w-5 h-5 theme-text-secondary" />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-black theme-text-primary text-center mb-4">
            Edit {child.name}
          </h2>

          <div className="flex items-center justify-between mb-4">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="p-2 glass rounded-xl hover:scale-105 transition-transform"
              >
                <ArrowLeft className="w-5 h-5 theme-text-secondary" />
              </button>
            )}
            <div className="flex-1 mx-3">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-300"
                  style={{ width: `${(step / 5) * 100}%` }}
                />
              </div>
              <p className="text-xs theme-text-secondary font-bold mt-1 text-center">
                Step {step} of 5
              </p>
            </div>
            {step > 1 && <div className="w-9" />}
          </div>
        </div>

        {renderStep()}

        <div className="mt-6 flex gap-3">
          {step < 5 ? (
            <button
              onClick={handleNext}
              disabled={step === 1 && (!childData.name || !childData.gender)}
              className="flex-1 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-black hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              Continue
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-black hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Saving...' : 'Save Changes'}
              <Check className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditChildModal;
