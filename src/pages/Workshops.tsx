import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Calendar, Users, Clock, Star } from 'lucide-react';
import type { Workshop } from '../types/database';

const Workshops: React.FC = () => {
  const navigate = useNavigate();
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkshops();
  }, []);

  const loadWorkshops = async () => {
    try {
      const { data } = await supabase
        .from('workshops')
        .select('*')
        .eq('is_active', true)
        .gte('session_date', new Date().toISOString())
        .order('session_date', { ascending: true });

      setWorkshops(data || []);
    } catch (error) {
      console.error('Error loading workshops:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-28 pt-20">
      <div className="max-w-md mx-auto px-6 pt-8 space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-3 glass rounded-xl hover:scale-105 transition-transform"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Workshops</h1>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {workshops.map((workshop) => (
              <div key={workshop.id} className="glass p-6 rounded-3xl space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{workshop.title}</h3>
                  <p className="text-sm text-gray-600 mt-2">{workshop.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary-600" />
                    <span className="text-gray-700">
                      {new Date(workshop.session_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary-600" />
                    <span className="text-gray-700">{workshop.duration_minutes} min</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary-600" />
                    <span className="text-gray-700">Ages {workshop.age_min}-{workshop.age_max}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-primary-600" fill="currentColor" />
                    <span className="text-gray-700">+{workshop.bonus_stars} stars</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/20">
                  <span className="text-2xl font-bold text-gray-900">RM{workshop.price}</span>
                  <button
                    onClick={() => alert('Workshop booking coming soon!')}
                    className="px-6 py-3 gradient-primary text-white rounded-xl font-semibold hover:scale-105 transition-transform"
                  >
                    Book Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Workshops;
