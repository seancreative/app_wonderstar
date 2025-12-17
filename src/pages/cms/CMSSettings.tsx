import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import CMSLayout from '../../components/cms/CMSLayout';
import { Settings, Store, Users, Shield, Bell, CreditCard, Globe, Database, Power, AlertTriangle, Wallet, Plus, CreditCard as Edit2, Trash2, Star, Gift, TrendingUp, Crown, Trophy, Sparkles, Save, RotateCcw, Info, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTopupPackages } from '../../hooks/useTopupPackages';
import TopupPackageModal from '../../components/cms/TopupPackageModal';
import type { WalletTopupPackage, MembershipTier } from '../../types/database';

const CMSSettings: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('general');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<WalletTopupPackage | null>(null);
  const { packages, createPackage, updatePackage, deletePackage } = useTopupPackages();
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [editingTiers, setEditingTiers] = useState<Record<string, MembershipTier>>({});
  const [savingTiers, setSavingTiers] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [generalSettings, setGeneralSettings] = useState({
    businessName: '',
    companyRegistrationNo: '',
    businessAddress: '',
    contactEmail: '',
    supportPhone: '',
    website: ''
  });
  const [savingGeneral, setSavingGeneral] = useState(false);

  useEffect(() => {
    loadMaintenanceMode();
    loadTiers();
    loadGeneralSettings();

    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [location.search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSettingsDropdown(false);
      }
    };

    if (showSettingsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettingsDropdown]);

  const loadMaintenanceMode = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'maintenance_mode')
        .single();

      if (error) throw error;
      setMaintenanceMode(data.setting_value === 'true');
    } catch (error) {
      console.error('Error loading maintenance mode:', error);
    }
  };

  const loadGeneralSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('config_key, config_value')
        .in('config_key', ['business_name', 'company_registration_no', 'business_address', 'contact_email', 'support_phone', 'business_website']);

      if (error) throw error;

      const settings: any = {};
      data?.forEach(item => {
        const key = item.config_key;
        // JSONB values come as strings from Supabase
        let value = item.config_value;

        // Skip empty or null values
        if (!value || value === '""' || value === 'null') return;

        if (key === 'business_name') settings.businessName = value;
        else if (key === 'company_registration_no') settings.companyRegistrationNo = value;
        else if (key === 'business_address') settings.businessAddress = value;
        else if (key === 'contact_email') settings.contactEmail = value;
        else if (key === 'support_phone') settings.supportPhone = value;
        else if (key === 'business_website') settings.website = value;
      });

      setGeneralSettings(prev => ({ ...prev, ...settings }));
    } catch (error) {
      console.error('Error loading general settings:', error);
    }
  };

  const saveGeneralSettings = async () => {
    setSavingGeneral(true);
    try {
      const updates = [
        { key: 'business_name', value: generalSettings.businessName },
        { key: 'company_registration_no', value: generalSettings.companyRegistrationNo },
        { key: 'business_address', value: generalSettings.businessAddress },
        { key: 'contact_email', value: generalSettings.contactEmail },
        { key: 'support_phone', value: generalSettings.supportPhone },
        { key: 'business_website', value: generalSettings.website }
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('app_config')
          .upsert({
            config_key: update.key,
            config_value: update.value,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'config_key'
          });

        if (error) throw error;
      }

      toast.success('General settings saved successfully!');
    } catch (error) {
      console.error('Error saving general settings:', error);
      toast.error('Failed to save general settings');
    } finally {
      setSavingGeneral(false);
    }
  };

  const toggleMaintenanceMode = async () => {
    setLoading(true);
    try {
      const newValue = !maintenanceMode;
      const { error } = await supabase
        .from('system_settings')
        .update({
          setting_value: newValue.toString(),
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'maintenance_mode');

      if (error) throw error;

      setMaintenanceMode(newValue);
      toast.success(newValue ? 'Maintenance mode enabled. Users will see maintenance page.' : 'Maintenance mode disabled. Users can access the site normally.');
    } catch (error) {
      console.error('Error toggling maintenance mode:', error);
      toast.error('Failed to toggle maintenance mode');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'outlets', label: 'Outlets', icon: Store },
    { id: 'users', label: 'User Settings', icon: Users },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'topup', label: 'Topup Packages', icon: Wallet },
    { id: 'tiers', label: 'Tier Benefits', icon: Crown },
    { id: 'system', label: 'System', icon: Database }
  ];

  const handleSavePackage = async (data: Omit<WalletTopupPackage, 'id' | 'created_at' | 'updated_at'>) => {
    console.log('[CMSSettings] Saving package...', { editingPackage: editingPackage?.id, data });

    try {
      if (editingPackage) {
        console.log('[CMSSettings] Updating package:', editingPackage.id);
        const result = await updatePackage(editingPackage.id, data);
        console.log('[CMSSettings] Update result:', result);

        if (result.success) {
          toast.success('Package updated successfully!');
          setShowPackageModal(false);
          setEditingPackage(null);
        } else {
          console.error('[CMSSettings] Update failed:', result.error);
          toast.error(`Failed to update package: ${result.error}`);
        }
        return result;
      } else {
        console.log('[CMSSettings] Creating new package');
        const result = await createPackage(data);
        console.log('[CMSSettings] Create result:', result);

        if (result.success) {
          toast.success('Package created successfully!');
          setShowPackageModal(false);
        } else {
          console.error('[CMSSettings] Create failed:', result.error);
          toast.error(`Failed to create package: ${result.error}`);
        }
        return result;
      }
    } catch (err) {
      console.error('[CMSSettings] Exception in handleSavePackage:', err);
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return { success: false, error: 'Exception occurred' };
    }
  };

  const handleEditPackage = (pkg: WalletTopupPackage) => {
    setEditingPackage(pkg);
    setShowPackageModal(true);
  };

  const handleDeletePackage = async (id: string) => {
    if (confirm('Are you sure you want to deactivate this package? It will no longer be visible to customers.')) {
      await deletePackage(id, true);
    }
  };

  const handleAddNew = () => {
    setEditingPackage(null);
    setShowPackageModal(true);
  };

  const loadTiers = async () => {
    try {
      const { data, error } = await supabase
        .from('membership_tiers')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      if (data) {
        setTiers(data);
        const tierMap: Record<string, MembershipTier> = {};
        data.forEach(tier => {
          tierMap[tier.id] = tier;
        });
        setEditingTiers(tierMap);
      }
    } catch (error) {
      console.error('Error loading tiers:', error);
      toast.error('Failed to load tier data');
    }
  };

  const handleTierChange = (tierId: string, field: keyof MembershipTier, value: any) => {
    setEditingTiers(prev => ({
      ...prev,
      [tierId]: {
        ...prev[tierId],
        [field]: value
      }
    }));
  };

  const handleSaveTiers = async () => {
    setSavingTiers(true);
    try {
      const updates = Object.values(editingTiers).map(tier => {
        return supabase
          .from('membership_tiers')
          .update({
            threshold: tier.threshold,
            earn_multiplier: tier.earn_multiplier,
            topup_bonus_pct: tier.topup_bonus_pct,
            workshop_discount_pct: tier.workshop_discount_pct,
            redemption_discount_pct: tier.redemption_discount_pct,
            shop_discount_pct: tier.shop_discount_pct,
            mission_bonus_stars: tier.mission_bonus_stars,
            color: tier.color
          })
          .eq('id', tier.id);
      });

      const results = await Promise.all(updates);
      const hasError = results.some(r => r.error);

      if (hasError) {
        throw new Error('Some tiers failed to update');
      }

      toast.success('All tier benefits updated successfully!');
      await loadTiers();
    } catch (error) {
      console.error('Error saving tiers:', error);
      toast.error('Failed to save tier benefits');
    } finally {
      setSavingTiers(false);
    }
  };

  const handleResetTier = (tierId: string) => {
    const originalTier = tiers.find(t => t.id === tierId);
    if (originalTier) {
      setEditingTiers(prev => ({
        ...prev,
        [tierId]: originalTier
      }));
    }
  };

  const getTierIcon = (tierName: string) => {
    switch (tierName.toLowerCase()) {
      case 'bronze': return Trophy;
      case 'silver': return Star;
      case 'gold': return Crown;
      case 'platinum': return Sparkles;
      case 'vip': return Crown;
      default: return Star;
    }
  };

  const getTierGradient = (tierName: string) => {
    switch (tierName.toLowerCase()) {
      case 'bronze': return 'from-amber-700 to-amber-900';
      case 'silver': return 'from-gray-400 to-gray-600';
      case 'gold': return 'from-yellow-400 to-yellow-600';
      case 'platinum': return 'from-slate-300 to-slate-500';
      case 'vip': return 'from-purple-500 to-purple-700';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  return (
    <CMSLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600 font-medium">Configure system preferences and options</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/cms/staff')}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-blue-200 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
          >
            <Shield className="w-4 h-4" />
            Staff
          </button>
          <button
            onClick={() => navigate('/cms/outlets')}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-green-200 text-green-600 rounded-lg font-semibold hover:bg-green-50 transition-colors"
          >
            <Store className="w-4 h-4" />
            Outlets
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-visible">
          <div className="border-b border-gray-200 p-4 overflow-visible">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white border-2 border-gray-300 rounded-xl hover:border-blue-500 transition-colors font-bold text-gray-900"
              >
                <div className="flex items-center gap-3">
                  {(() => {
                    const currentTab = tabs.find(t => t.id === activeTab);
                    const Icon = currentTab?.icon || Settings;
                    return (
                      <>
                        <Icon className="w-5 h-5 text-blue-600" />
                        <span>{currentTab?.label || 'Select Setting'}</span>
                      </>
                    );
                  })()}
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${showSettingsDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showSettingsDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-[9999] max-h-96 overflow-y-auto">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setShowSettingsDropdown(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                          activeTab === tab.id
                            ? 'bg-blue-50 text-blue-600 font-bold'
                            : 'text-gray-700 hover:bg-gray-50 font-medium'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Business Name
                  </label>
                  <input
                    type="text"
                    placeholder="Kiddo Heritage Sdn Bhd"
                    value={generalSettings.businessName}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, businessName: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Company Registration No.
                  </label>
                  <input
                    type="text"
                    placeholder="202401234567 (1234567-X)"
                    value={generalSettings.companyRegistrationNo}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, companyRegistrationNo: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                  />
                  <p className="text-xs text-gray-500 mt-1">Displayed below business name on receipts</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Business Address
                  </label>
                  <textarea
                    placeholder="The Shore Shopping Gallery, Melaka Malaysia."
                    value={generalSettings.businessAddress}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, businessAddress: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    placeholder="info@wonderpark.my"
                    value={generalSettings.contactEmail}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, contactEmail: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Support Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="6012-878-9169"
                    value={generalSettings.supportPhone}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, supportPhone: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Website
                  </label>
                  <input
                    type="text"
                    placeholder="www.wonderpark.my"
                    value={generalSettings.website}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, website: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Timezone
                  </label>
                  <select className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-bold">
                    <option>Asia/Kuala_Lumpur (GMT+8)</option>
                    <option>Asia/Singapore (GMT+8)</option>
                  </select>
                </div>

                <button
                  onClick={saveGeneralSettings}
                  disabled={savingGeneral}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingGeneral ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}

            {activeTab === 'outlets' && (
              <div className="space-y-6">
                <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-100 rounded-xl">
                      <Store className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-blue-900 mb-2">Outlet Configuration</h3>
                      <p className="text-sm text-blue-800 mb-4">
                        Manage outlet-specific settings, operating hours, and capacity limits
                      </p>
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors text-sm">
                        Configure Outlets
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="space-y-6">
                <div>
                  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                    <input type="checkbox" className="w-5 h-5 rounded border-gray-300" defaultChecked />
                    <div>
                      <p className="font-bold text-gray-900">Email Verification Required</p>
                      <p className="text-sm text-gray-600">Users must verify email before accessing features</p>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                    <input type="checkbox" className="w-5 h-5 rounded border-gray-300" />
                    <div>
                      <p className="font-bold text-gray-900">Auto-approve New Users</p>
                      <p className="text-sm text-gray-600">New registrations are active immediately</p>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                    <input type="checkbox" className="w-5 h-5 rounded border-gray-300" defaultChecked />
                    <div>
                      <p className="font-bold text-gray-900">Allow Multiple Children</p>
                      <p className="text-sm text-gray-600">Users can add multiple child profiles</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="bg-red-50 rounded-xl border-2 border-red-200 p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-100 rounded-xl">
                      <Shield className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-red-900 mb-2">Security Settings</h3>
                      <p className="text-sm text-red-800 mb-4">
                        Configure authentication, access control, and security policies
                      </p>
                      <div className="space-y-2 text-sm text-red-800">
                        <p className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-600"></div>
                          Two-factor authentication options
                        </p>
                        <p className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-600"></div>
                          Session timeout configuration
                        </p>
                        <p className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-600"></div>
                          IP whitelist management
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                    <input type="checkbox" className="w-5 h-5 rounded border-gray-300" defaultChecked />
                    <div>
                      <p className="font-bold text-gray-900">Order Notifications</p>
                      <p className="text-sm text-gray-600">Send alerts for new orders</p>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                    <input type="checkbox" className="w-5 h-5 rounded border-gray-300" defaultChecked />
                    <div>
                      <p className="font-bold text-gray-900">Low Stock Alerts</p>
                      <p className="text-sm text-gray-600">Notify when products are running low</p>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                    <input type="checkbox" className="w-5 h-5 rounded border-gray-300" />
                    <div>
                      <p className="font-bold text-gray-900">Marketing Emails</p>
                      <p className="text-sm text-gray-600">Send promotional emails to customers</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="space-y-6">
                <div className="bg-green-50 rounded-xl border-2 border-green-200 p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-green-100 rounded-xl">
                      <CreditCard className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-green-900 mb-2">Payment Gateway</h3>
                      <p className="text-sm text-green-800 mb-4">
                        FIUU payment gateway is configured and active
                      </p>
                      <div className="space-y-2 text-sm text-green-800">
                        <p className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-600"></div>
                          Credit/Debit cards supported
                        </p>
                        <p className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-600"></div>
                          FPX online banking
                        </p>
                        <p className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-600"></div>
                          E-wallet integration (GrabPay, TNG, Boost)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'topup' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-black text-gray-900">Topup Packages</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Manage wallet topup packages shown to customers
                    </p>
                  </div>
                  <button
                    onClick={handleAddNew}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Add Package
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className={`relative rounded-xl border-2 p-5 transition-all ${
                        pkg.is_recommended
                          ? 'border-orange-400 bg-gradient-to-br from-orange-50 to-white shadow-lg'
                          : pkg.is_active
                          ? 'border-gray-200 bg-white hover:border-gray-300'
                          : 'border-gray-200 bg-gray-50 opacity-60'
                      }`}
                    >
                      {pkg.is_recommended && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="px-3 py-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-black rounded-full shadow-lg">
                            RECOMMENDED
                          </span>
                        </div>
                      )}

                      {!pkg.is_active && (
                        <div className="absolute top-3 right-3">
                          <span className="px-2 py-1 bg-gray-600 text-white text-xs font-bold rounded">
                            INACTIVE
                          </span>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="text-center">
                          <div className="text-3xl font-black text-gray-900 mb-1">
                            RM{pkg.amount}
                          </div>
                          <div className="text-xs text-gray-500 font-medium">
                            Topup Amount
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-gray-200">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 flex items-center gap-1">
                              <Star className="w-4 h-4 text-yellow-500" />
                              Base Stars
                            </span>
                            <span className="font-bold text-gray-900">{pkg.base_stars}</span>
                          </div>

                          {pkg.extra_stars > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-orange-600 flex items-center gap-1">
                                <TrendingUp className="w-4 h-4" />
                                Extra Stars
                              </span>
                              <span className="font-bold text-orange-600">+{pkg.extra_stars}</span>
                            </div>
                          )}

                          {pkg.bonus_amount > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-green-600 flex items-center gap-1">
                                <Gift className="w-4 h-4" />
                                Bonus
                              </span>
                              <span className="font-bold text-green-600">+RM{pkg.bonus_amount.toFixed(2)}</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                            <span className="text-gray-600 font-medium">Total Stars</span>
                            <span className="font-black text-blue-600">
                              {pkg.base_stars + pkg.extra_stars}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-3">
                          <button
                            onClick={() => handleEditPackage(pkg)}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-colors text-sm"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePackage(pkg.id)}
                            className="flex items-center justify-center gap-1 px-3 py-2 border-2 border-red-300 text-red-600 rounded-lg font-bold hover:bg-red-50 transition-colors text-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {packages.length === 0 && (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium mb-2">No topup packages yet</p>
                    <p className="text-sm text-gray-500 mb-4">Create your first package to get started</p>
                    <button
                      onClick={handleAddNew}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                    >
                      Add First Package
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tiers' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-black text-gray-900">Membership Tier Benefits</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Configure rewards and benefits for each membership tier
                    </p>
                  </div>
                  <button
                    onClick={handleSaveTiers}
                    disabled={savingTiers}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    <Save className="w-5 h-5" />
                    {savingTiers ? 'Saving...' : 'Save All Changes'}
                  </button>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 p-5 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <Info className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-black text-blue-900 mb-1">Important Notes</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">•</span>
                          <span>Base star earning rate is 2.5 stars per RM1. The multiplier is applied on top of this base rate.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">•</span>
                          <span>Changes will immediately affect all users in each tier.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">•</span>
                          <span>These settings are reflected in the customer Tier Benefits popup.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6">
                  {Object.values(editingTiers).sort((a, b) => a.sort_order - b.sort_order).map((tier) => {
                    const Icon = getTierIcon(tier.name);
                    const gradient = getTierGradient(tier.name);
                    const starsPerRM = (2.5 * tier.earn_multiplier).toFixed(2);

                    return (
                      <div
                        key={tier.id}
                        className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
                      >
                        <div className={`bg-gradient-to-r ${gradient} p-5 text-white`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                                <Icon className="w-8 h-8" />
                              </div>
                              <div>
                                <h3 className="text-2xl font-black">{tier.name}</h3>
                                <p className="text-sm opacity-90 font-medium">
                                  Threshold: RM{tier.threshold} lifetime topup
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleResetTier(tier.id)}
                              className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-bold text-sm backdrop-blur-sm transition-colors"
                            >
                              <RotateCcw className="w-4 h-4" />
                              Reset
                            </button>
                          </div>
                        </div>

                        <div className="p-6 space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-bold text-gray-900 mb-2">
                                Top-Up Threshold (RM)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={tier.threshold}
                                onChange={(e) => handleTierChange(tier.id, 'threshold', parseFloat(e.target.value) || 0)}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-bold text-lg"
                              />
                              <p className="text-xs text-gray-600 mt-1 font-medium">
                                Lifetime topup amount required to reach this tier
                              </p>
                            </div>

                            <div>
                              <label className="block text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                                <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
                                Stars Multiplier
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={tier.earn_multiplier}
                                onChange={(e) => handleTierChange(tier.id, 'earn_multiplier', parseFloat(e.target.value) || 0)}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-bold text-lg"
                              />
                              <p className="text-xs text-gray-600 mt-1 font-medium">
                                Base: 2.5 stars × {tier.earn_multiplier} = <span className="font-black text-yellow-600">{starsPerRM} stars per RM1</span>
                              </p>
                            </div>
                          </div>

                          <div className="border-t-2 border-gray-100 pt-6">
                            <h4 className="font-black text-gray-900 mb-4 flex items-center gap-2">
                              <Gift className="w-5 h-5 text-blue-600" />
                              Discount & Bonus Benefits
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                  Shop Discount (%)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="1"
                                  value={tier.shop_discount_pct}
                                  onChange={(e) => handleTierChange(tier.id, 'shop_discount_pct', parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-bold"
                                />
                                <p className="text-xs text-gray-500 mt-1">Permanent shop discount</p>
                              </div>

                              <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                  Redemption Discount (%)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="1"
                                  value={tier.redemption_discount_pct}
                                  onChange={(e) => handleTierChange(tier.id, 'redemption_discount_pct', parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-bold"
                                />
                                <p className="text-xs text-gray-500 mt-1">Reward redemption discount</p>
                              </div>

                              <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                  Workshop Discount (%)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="1"
                                  value={tier.workshop_discount_pct}
                                  onChange={(e) => handleTierChange(tier.id, 'workshop_discount_pct', parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-bold"
                                />
                                <p className="text-xs text-gray-500 mt-1">Workshop booking discount</p>
                              </div>

                              <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                  Top-Up Bonus (%)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="1"
                                  value={tier.topup_bonus_pct}
                                  onChange={(e) => handleTierChange(tier.id, 'topup_bonus_pct', parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-bold"
                                />
                                <p className="text-xs text-gray-500 mt-1">Extra wallet credit on topup</p>
                              </div>
                            </div>
                          </div>

                          <div className="border-t-2 border-gray-100 pt-6">
                            <h4 className="font-black text-gray-900 mb-4 flex items-center gap-2">
                              <Sparkles className="w-5 h-5 text-purple-600" />
                              Additional Settings
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                  Mission Bonus Stars
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={tier.mission_bonus_stars}
                                  onChange={(e) => handleTierChange(tier.id, 'mission_bonus_stars', parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-bold"
                                />
                                <p className="text-xs text-gray-500 mt-1">Extra stars for completing missions</p>
                              </div>

                              <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                  Tier Color
                                </label>
                                <input
                                  type="color"
                                  value={tier.color}
                                  onChange={(e) => handleTierChange(tier.id, 'color', e.target.value)}
                                  className="w-full h-11 px-2 py-1 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none cursor-pointer"
                                />
                                <p className="text-xs text-gray-500 mt-1">Visual color for tier branding</p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-4">
                            <h5 className="font-bold text-green-900 mb-2 text-sm">Preview Example</h5>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div className="bg-white rounded-lg p-3">
                                <p className="text-gray-600 font-medium mb-1">Spend RM100</p>
                                <p className="text-lg font-black text-green-700">{(100 * 2.5 * tier.earn_multiplier).toFixed(0)} Stars</p>
                              </div>
                              <div className="bg-white rounded-lg p-3">
                                <p className="text-gray-600 font-medium mb-1">RM100 Product</p>
                                <p className="text-lg font-black text-blue-700">RM{(100 * (1 - tier.shop_discount_pct / 100)).toFixed(2)}</p>
                              </div>
                              <div className="bg-white rounded-lg p-3">
                                <p className="text-gray-600 font-medium mb-1">Topup RM100</p>
                                <p className="text-lg font-black text-purple-700">RM{(100 + (100 * tier.topup_bonus_pct / 100)).toFixed(2)}</p>
                              </div>
                              <div className="bg-white rounded-lg p-3">
                                <p className="text-gray-600 font-medium mb-1">Mission Complete</p>
                                <p className="text-lg font-black text-orange-700">+{tier.mission_bonus_stars} Stars</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'system' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm font-bold text-gray-600 mb-1">Database Status</p>
                    <p className="text-lg font-black text-green-600">Connected</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm font-bold text-gray-600 mb-1">System Version</p>
                    <p className="text-lg font-black text-gray-900">v1.0.0</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm font-bold text-gray-600 mb-1">Last Backup</p>
                    <p className="text-lg font-black text-gray-900">Today</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm font-bold text-gray-600 mb-1">Uptime</p>
                    <p className="text-lg font-black text-gray-900">99.9%</p>
                  </div>
                </div>

                <div className={`rounded-xl border-2 p-6 ${maintenanceMode ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${maintenanceMode ? 'bg-red-100' : 'bg-gray-100'}`}>
                      <Power className={`w-6 h-6 ${maintenanceMode ? 'text-red-600' : 'text-gray-600'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={`text-lg font-black ${maintenanceMode ? 'text-red-900' : 'text-gray-900'}`}>
                          Maintenance Mode
                        </h3>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold ${maintenanceMode ? 'text-red-600' : 'text-gray-600'}`}>
                            {maintenanceMode ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                          <button
                            onClick={toggleMaintenanceMode}
                            disabled={loading}
                            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                              maintenanceMode ? 'bg-red-600 focus:ring-red-500' : 'bg-gray-300 focus:ring-gray-400'
                            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                maintenanceMode ? 'translate-x-8' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                      <p className={`text-sm mb-4 ${maintenanceMode ? 'text-red-800' : 'text-gray-600'}`}>
                        {maintenanceMode
                          ? 'System is in maintenance mode. Users will see a maintenance page and cannot access the application.'
                          : 'Enable maintenance mode to prevent user access during system updates or maintenance.'
                        }
                      </p>
                      {maintenanceMode && (
                        <div className="flex items-start gap-2 p-3 bg-red-100 rounded-lg">
                          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-800 font-medium">
                            All user-facing pages are currently showing the maintenance screen. CMS access remains available.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 rounded-xl border-2 border-yellow-200 p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-yellow-100 rounded-xl">
                      <Database className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-yellow-900 mb-2">System Maintenance</h3>
                      <p className="text-sm text-yellow-800 mb-4">
                        Database optimization and system updates
                      </p>
                      <button className="px-4 py-2 bg-yellow-600 text-white rounded-lg font-bold hover:bg-yellow-700 transition-colors text-sm">
                        Run Maintenance
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <TopupPackageModal
        isOpen={showPackageModal}
        onClose={() => {
          setShowPackageModal(false);
          setEditingPackage(null);
        }}
        onSave={handleSavePackage}
        editPackage={editingPackage}
      />
    </CMSLayout>
  );
};

export default CMSSettings;
