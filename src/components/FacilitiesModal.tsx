import React, { useState, useEffect } from 'react';
import { X, Gamepad2, Coffee, Baby, Users, Utensils, Camera, Music, Car, Trophy, Dumbbell, Smartphone, Sparkles, Home, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Facility {
  id: string;
  name: string;
  category: 'everyone' | 'adult' | 'child' | 'facilities';
  icon?: string;
  description?: string;
  display_order: number;
}

interface FacilitiesModalProps {
  outletId: string;
  outletName: string;
  onClose: () => void;
}

const categoryColors = {
  everyone: 'from-purple-500 to-pink-500',
  adult: 'from-blue-500 to-cyan-500',
  child: 'from-orange-500 to-yellow-500',
  facilities: 'from-green-500 to-emerald-500'
};

const categoryIcons = {
  everyone: Users,
  adult: Dumbbell,
  child: Sparkles,
  facilities: Home
};

const FacilitiesModal: React.FC<FacilitiesModalProps> = ({ outletId, outletName, onClose }) => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('everyone');

  useEffect(() => {
    loadFacilities();
  }, [outletId]);

  const loadFacilities = async () => {
    try {
      const { data, error } = await supabase
        .from('outlet_facilities')
        .select('*')
        .eq('outlet_id', outletId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setFacilities(data || []);
    } catch (error) {
      console.error('Error loading facilities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIconComponent = (iconName: string) => {
    const iconMap: { [key: string]: any } = {
      gamepad: Gamepad2,
      coffee: Coffee,
      baby: Baby,
      car: Car,
      camera: Camera,
      music: Music,
      trophy: Trophy,
      smartphone: Smartphone,
      utensils: Utensils,
      shield: ShieldCheck
    };
    return iconMap[iconName] || Sparkles;
  };

  const categories = [
    { id: 'everyone', label: 'Everyone', Icon: Users },
    { id: 'adult', label: 'Adults', Icon: Dumbbell },
    { id: 'child', label: 'Kids', Icon: Sparkles },
    { id: 'facilities', label: 'Facilities', Icon: Home },
  ];

  const filteredFacilities = facilities.filter(f => f.category === selectedCategory);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-scale-in">
        <div className={`sticky top-0 bg-gradient-to-r ${categoryColors[selectedCategory as keyof typeof categoryColors]} px-6 py-4 flex items-center justify-between`}>
          <div>
            <h2 className="text-2xl font-black text-white drop-shadow-lg">🎉 Our Facilities</h2>
            <p className="text-sm text-white/90 font-semibold">{outletName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-4 gap-2">
            {categories.map((category) => {
              const IconComponent = category.Icon;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-xs font-bold transition-all ${
                    selectedCategory === category.id
                      ? `bg-gradient-to-br ${categoryColors[category.id as keyof typeof categoryColors]} text-white shadow-lg scale-105`
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <IconComponent className="w-5 h-5" />
                  {category.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6 overflow-y-auto bg-gradient-to-br from-gray-50 to-white" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className={`animate-spin rounded-full h-12 w-12 border-4 border-t-transparent border-${selectedCategory === 'everyone' ? 'purple' : selectedCategory === 'adult' ? 'blue' : selectedCategory === 'child' ? 'orange' : 'green'}-500`}></div>
            </div>
          ) : filteredFacilities.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 font-semibold">No facilities available in this category</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filteredFacilities.map((facility, index) => {
                const bgColors = [
                  'from-red-100 to-red-200 border-red-300',
                  'from-blue-100 to-blue-200 border-blue-300',
                  'from-green-100 to-green-200 border-green-300',
                  'from-yellow-100 to-yellow-200 border-yellow-300',
                  'from-purple-100 to-purple-200 border-purple-300',
                  'from-pink-100 to-pink-200 border-pink-300',
                  'from-indigo-100 to-indigo-200 border-indigo-300',
                  'from-orange-100 to-orange-200 border-orange-300',
                  'from-teal-100 to-teal-200 border-teal-300',
                  'from-cyan-100 to-cyan-200 border-cyan-300',
                ];
                const colorClass = bgColors[index % bgColors.length];

                return (
                  <div
                    key={facility.id}
                    className={`bg-gradient-to-br ${colorClass} border-2 p-4 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-xl animate-pop-in`}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="text-center space-y-2">
                      <div className="text-4xl mb-2 drop-shadow-md">{facility.icon || '✨'}</div>
                      <h3 className="text-sm font-black text-gray-900 leading-tight">
                        {facility.name}
                      </h3>
                      {facility.description && (
                        <p className="text-xs text-gray-700 leading-snug font-medium">
                          {facility.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={`px-6 py-4 bg-gradient-to-r ${categoryColors[selectedCategory as keyof typeof categoryColors]} text-center`}>
          <p className="text-white font-bold text-sm">🌟 Come and explore all our amazing facilities! 🌟</p>
        </div>
      </div>
    </div>
  );
};

export default FacilitiesModal;
