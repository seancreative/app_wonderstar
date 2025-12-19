import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { EduWorkshop } from '../types/database';
import WorkshopDetailModal from '../components/WorkshopDetailModal';
import LoadingScreen from '../components/LoadingScreen';
import PageHeader from '../components/Layout/PageHeader';
import BottomNav from '../components/Layout/BottomNav';
import AIGeniusHero from '../components/AIGeniusHero';
import AIContext from '../components/AIContext';
import SpecialVoucher from '../components/SpecialVoucher';
import ParentBenefits from '../components/ParentBenefits';
import WorkshopCurriculum from '../components/WorkshopCurriculum';
import SarawakTestimonials from '../components/SarawakTestimonials';
import ImagineYourChild from '../components/ImagineYourChild';
import FinalCTA from '../components/FinalCTA';
import { Clock, Users, Sparkles } from 'lucide-react';

const EduWorkshops: React.FC = () => {
  const navigate = useNavigate();
  const [workshops, setWorkshops] = useState<EduWorkshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkshop, setSelectedWorkshop] = useState<EduWorkshop | null>(null);
  const [filterType, setFilterType] = useState<string>('For All');

  useEffect(() => {
    loadWorkshops();
  }, []);

  const loadWorkshops = async () => {
    try {
      const { data, error } = await supabase
        .from('edu_workshops')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setWorkshops(data || []);
    } catch (error) {
      console.error('Error loading workshops:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkshops = workshops.filter(workshop => {
    return workshop.event_type === filterType;
  });

  const eventTypes = [
    { value: 'For All', label: 'For All' },
    { value: 'For Members', label: 'For Members' },
    { value: 'For Schools', label: 'For Schools' }
  ];

  if (loading) {
    return <LoadingScreen variant="content" text="Loading workshops..." />;
  }

  return (
    <div className="min-h-screen pb-28 pt-20">
      <PageHeader />

      <AIGeniusHero />

      <AIContext />

      <SpecialVoucher />

      <ParentBenefits />

      <WorkshopCurriculum />

      <SarawakTestimonials />

      <ImagineYourChild />

      <FinalCTA />

      <div id="workshops-list" className="bg-gradient-to-br from-gray-900 via-gray-800 to-black px-4 pt-8 pb-12 space-y-6">
        <div className="max-w-md mx-auto">
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 mb-2 text-center">
            Available Workshops
          </h2>
          <p className="text-sm text-gray-400 text-center">Choose your perfect learning adventure</p>
        </div>

        <div className="max-w-md mx-auto flex flex-wrap gap-2 justify-center px-2">
          {eventTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setFilterType(type.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === type.value
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 shadow-lg'
                  : 'bg-gray-800/50 border border-yellow-400/30 text-gray-300 hover:border-yellow-400'
                }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {filteredWorkshops.length === 0 ? (
          <div className="max-w-md mx-auto text-center py-12 bg-gray-800/50 border border-yellow-400/30 rounded-3xl backdrop-blur-sm">
            <Sparkles className="w-16 h-16 mx-auto text-yellow-400/50 mb-4" />
            <p className="text-gray-400 font-semibold">No workshops available</p>
          </div>
        ) : (
          <div className="max-w-md mx-auto grid grid-cols-2 gap-3">
            {filteredWorkshops.map((workshop) => {
              const mainImage = workshop.workshop_images && workshop.workshop_images.length > 0
                ? workshop.workshop_images[0]
                : workshop.image_url;

              return (
                <div
                  key={workshop.id}
                  onClick={() => setSelectedWorkshop(workshop)}
                  className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden hover:scale-[1.02] transition-transform cursor-pointer shadow-lg border-2 border-yellow-400/30 hover:border-yellow-400"
                >
                  {mainImage ? (
                    <div className="w-full aspect-square bg-gradient-to-br from-gray-700 to-gray-800 relative overflow-hidden">
                      <img
                        src={mainImage}
                        alt={workshop.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 right-2 flex gap-1 flex-wrap">
                        <span className="px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 text-[10px] font-bold rounded-full shadow-lg">
                          {workshop.event_type}
                        </span>
                        <span className="px-2 py-0.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] font-bold rounded-full shadow-lg">
                          {workshop.availability}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full aspect-square bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                      <Sparkles className="w-12 h-12 text-yellow-500" />
                    </div>
                  )}

                  <div className="p-2.5 space-y-1.5 bg-gradient-to-br from-gray-800 to-gray-900">
                    <h3 className="text-xs font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 leading-tight line-clamp-2">
                      {workshop.title}
                    </h3>

                    <div className="flex items-center gap-1.5 text-xs">
                      <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-400/30 rounded">
                        <Clock className="w-2.5 h-2.5 text-yellow-400" />
                        <span className="font-bold text-yellow-300 text-[10px]">{workshop.estimated_time}m</span>
                      </div>
                      <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-green-500/20 border border-green-400/30 rounded">
                        <Users className="w-2.5 h-2.5 text-green-400" />
                        <span className="font-bold text-green-300 text-[9px]">{workshop.age_group}</span>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-gray-700">
                      {workshop.has_special_price && workshop.special_price ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-gray-500 line-through">
                            RM{workshop.event_price.toFixed(2)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
                              RM{workshop.special_price.toFixed(2)}
                            </span>
                            <span className="px-1.5 py-0.5 bg-red-500 text-white text-[7px] font-bold rounded">SPECIAL</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
                          RM{workshop.event_price.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedWorkshop && (
        <WorkshopDetailModal
          workshop={selectedWorkshop}
          onClose={() => setSelectedWorkshop(null)}
        />
      )}

      <BottomNav />
    </div>
  );
};

export default EduWorkshops;
