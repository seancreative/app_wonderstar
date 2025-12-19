export interface User {
  id: string;
  display_id?: string;
  email: string;
  name: string;
  phone?: string;
  profile_picture_url?: string;
  password_hash?: string;
  lifetime_topups: number;
  referral_code?: string;
  gacha_freespin?: number;
  gacha_total_spins?: number;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  qr_code?: string;
  first_login_at?: string;
  last_checkin_voucher_date?: string;
  theme: 'light' | 'dark' | 'colorful' | 'robotic';
  language: string;
  settings: {
    haptics: boolean;
    surprises: boolean;
    reduceMotion: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface ChildProfile {
  id: string;
  user_id: string;
  name: string;
  age?: number;
  date_of_birth?: string;
  gender?: 'male' | 'female';
  photo_url?: string;
  workshop_interests: string[];
  budget_tier?: 'essential' | 'enhanced' | 'advanced' | 'full' | 'none';
  avatar_config: {
    character: string;
    outfit: Record<string, string>;
    accessories: string[];
  };
  created_at: string;
}

export interface WalletTopupPackage {
  id: string;
  amount: number;
  base_stars: number;
  extra_stars: number;
  bonus_amount: number;
  is_recommended: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  transaction_type: 'topup' | 'spend' | 'bonus' | 'refund';
  amount: number;
  bonus_amount: number;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled';
  description?: string;
  payment_transaction_id?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface StarsTransaction {
  id: string;
  user_id: string;
  transaction_type: 'earn' | 'spend' | 'bonus' | 'refund';
  amount: number;
  multiplier: number;
  source: string;
  description?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface BonusTransaction {
  id: string;
  user_id: string;
  transaction_type: 'earn' | 'spend' | 'topup_bonus' | 'grant' | 'refund' | 'adjustment' | 'revoke';
  amount: number;
  description?: string;
  source?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface MembershipTier {
  id: string;
  name: string;
  threshold: number;
  earn_multiplier: number;
  topup_bonus_pct: number;
  workshop_discount_pct: number;
  redemption_discount_pct: number;
  shop_discount_pct: number;
  mission_bonus_stars: number;
  color: string;
  sort_order: number;
  created_at: string;
  // Frontend helpers
  next_tier_name?: string;
  amount_to_next_tier?: number;
  progress_to_next?: number;
}

export interface Badge {
  id: string;
  user_id: string;
  badge_type: string;
  name: string;
  description?: string;
  icon?: string;
  unlocked_at: string;
}

export interface Mission {
  id: string;
  title: string;
  description?: string;
  mission_type: 'visit' | 'spend' | 'workshop' | 'checkin' | 'seasonal' | 'weekly';
  requirement_value: number;
  reward_stars: number;
  is_active: boolean;
  is_seasonal: boolean;
  start_date?: string;
  end_date?: string;
  created_at: string;
}

export interface MissionProgress {
  id: string;
  user_id: string;
  mission_id: string;
  current_progress: number;
  is_completed: boolean;
  completed_at?: string;
  claimed_at?: string;
}

export interface Reward {
  id: string;
  display_id?: string;
  name: string;
  description?: string;
  category: 'entry' | 'toys' | 'merch' | 'vip';
  base_cost_stars: number;
  stars_required?: number;
  stock: number;
  image_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface Redemption {
  id: string;
  user_id: string;
  reward_id: string;
  stars_cost: number;
  qr_code?: string;
  redeemed_at: string;
  used_at?: string;
}

export interface Workshop {
  id: string;
  title: string;
  description?: string;
  category: string;
  age_min?: number;
  age_max?: number;
  instructor?: string;
  price: number;
  bonus_stars: number;
  max_capacity: number;
  session_date: string;
  duration_minutes: number;
  image_url?: string;
  whats_included?: string;
  is_active: boolean;
  created_at: string;
}

export interface WorkshopBooking {
  id: string;
  user_id: string;
  workshop_id: string;
  child_id?: string;
  amount_paid: number;
  qr_code?: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  booked_at: string;
}

export interface EduWorkshop {
  id: string;
  title: string;
  overview?: string;
  description?: string;
  learning_points: string[];
  event_type: 'For All' | 'For Members' | 'For Schools';
  event_price: number;
  special_price?: number;
  has_special_price?: boolean;
  age_group: string;
  estimated_time: number;
  image_url?: string;
  workshop_images?: string[];
  schedule_info?: string;
  availability: string;
  is_active: boolean;
  display_order: number;
  linked_product_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface Voucher {
  id: string;
  code: string;
  title?: string;
  description?: string;
  voucher_type: 'amount' | 'percent' | 'free_item' | 'b1f1' | 'free_gift';
  value: number;
  application_scope?: 'order_total' | 'product_level';
  product_application_method?: 'total_once' | 'per_product';
  eligible_product_ids?: string[];
  eligible_category_ids?: string[];
  eligible_subcategory_ids?: string[];
  workshop_images?: string[];
  schedule_info?: string;
  max_products_per_use?: number;
  usage_limit_per_user?: number;
  user_daily_limit?: number;
  created_date?: string;
  redemption_count?: number;
  min_purchase: number;
  max_uses?: number;
  times_used: number;
  expires_at?: string;
  is_active: boolean;
  valid_for_today_only?: boolean;
  is_daily_redeemable?: boolean;
  free_gift_name?: string;
  outlet_restriction_type?: 'all_outlets' | 'specific_outlets';
  applicable_outlet_ids?: string[];
  metadata?: Record<string, any>;
  created_at: string;
  restriction_type?: string;
}

export interface VoucherUsage {
  id: string;
  voucher_id: string;
  user_id: string;
  order_value: number;
  discount_amount: number;
  used_at: string;
}

export interface CheckIn {
  id: string;
  user_id: string;
  location: string;
  stars_earned: number;
  checked_in_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: 'reminder' | 'wallet' | 'voucher' | 'mission' | 'promo' | 'system' | 'order_ready';
  is_read: boolean;
  action_url?: string;
  created_at: string;
}

export interface OrderNotification {
  id: string;
  order_id: string;
  user_id: string;
  staff_id?: string;
  notification_id?: string;
  order_number: string;
  collection_number: string;
  outlet_name?: string;
  notification_sent_at: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface AppConfig {
  id: string;
  config_key: string;
  config_value: any;
  description?: string;
  updated_at: string;
}

export interface FiuuCustomer {
  id: string;
  user_id: string;
  fiuu_customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  customer_city: string;
  customer_state: string;
  customer_postcode: string;
  customer_country: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransaction {
  id: string;
  order_id: string;
  user_id: string;
  fiuu_customer_id?: string;
  amount: number;
  payment_method: 'credit' | 'debit' | 'fpx' | 'grabpay' | 'tng' | 'boost' | 'ewallet';
  wallet_transaction_id?: string;
  shop_order_id?: string;
  fiuu_transaction_id?: string;
  fiuu_status?: string;
  fiuu_payment_url?: string;
  fiuu_payment_data?: Record<string, any>;
  fiuu_callback_data?: Record<string, any>;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled';
  error_message?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface Outlet {
  id: string;
  display_id?: string;
  name: string;
  location: string;
  address: string;
  status: 'active' | 'inactive';
  image_url?: string;
  cover_image_url?: string;
  slug?: string;
  operating_hours?: Record<string, any>;
  contact_phone?: string;
  contact_email?: string;
  capacity?: number;
  created_at: string;
  updated_at: string;
  is_active?: boolean;
  opening_hours?: Record<string, any>;
  coordinates?: Record<string, any>;
}

export interface OutletFacility {
  id: string;
  outlet_id: string;
  category: string;
  name: string;
  icon?: string;
  is_available: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  icon?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Subcategory {
  id: string;
  subcategory_id: string;
  category_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductOutlet {
  id: string;
  product_id: string;
  outlet_id: string;
  is_available: boolean;
  local_stock?: number;
  local_price?: number;
  created_at: string;
}

export interface ShopProduct {
  id: string;
  product_id: string;
  outlet_id: string;
  name: string;
  description?: string;
  category: string;
  category_id?: string;
  subcategory?: string;
  subcategory_id?: string;
  base_price: number;
  weekend_price?: number;
  pricing_type?: 'fixed' | 'variable';
  variants?: Array<{ name: string; price: number }>;
  addons?: Array<{ name: string; price: number }>;
  stock: number;
  image_url?: string;
  images?: string[];
  primary_image?: string;
  is_active: boolean;
  workshop_date?: string;
  duration_minutes?: number;
  age_min?: number;
  age_max?: number;
  max_capacity?: number;
  bonus_stars?: number;
  is_recommended?: boolean;
  recommended_sort_order?: number;
  created_at: string;
  updated_at: string;
}

export interface ModifierGroup {
  id: string;
  name: string;
  description?: string;
  modifier_type: 'single_choice' | 'multiple_choice';
  enable_quantity_selector: boolean;
  min_selections: number;
  max_selections?: number;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface ModifierOption {
  id: string;
  modifier_group_id: string;
  option_name: string;
  addon_price: number;
  is_default: boolean;
  sort_order: number;
  created_at: string;
}

export interface ProductModifier {
  id: string;
  product_id: string;
  modifier_group_id: string;
  is_required: boolean;
  sort_order: number;
  created_at: string;
}

export interface SelectedModifierOption {
  option_id: string;
  option_name: string;
  addon_price: number;
  quantity: number;
}

export interface SelectedModifier {
  modifier_group_id: string;
  group_name: string;
  modifier_type: 'single_choice' | 'multiple_choice';
  selected_options: SelectedModifierOption[];
}

export interface ShopCartItem {
  id: string;
  user_id: string;
  outlet_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  metadata?: Record<string, any>;
  selected_modifiers?: SelectedModifier[];
  created_at: string;
}

export interface ShopOrder {
  id: string;
  user_id: string;
  outlet_id: string;
  order_number?: string;
  qr_code?: string;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  subtotal: number;
  discount_amount: number;
  bonus_discount_amount: number;
  permanent_discount_amount: number;
  gross_sales: number;
  total_amount: number;
  status: 'waiting_payment' | 'ready' | 'completed' | 'cancelled' | 'refunded';
  payment_status: 'pending' | 'paid' | 'failed';
  payment_error_code?: string;
  payment_method?: string;
  payment_type?: 'payment' | 'deduction' | 'redemption';
  payment_transaction_id?: string;
  voucher_id?: string;
  voucher_code?: string;
  user_voucher_id?: string;
  w_balance_after?: number;
  bonus_balance_after?: number;
  receipt_number?: string;
  receipt_data?: ReceiptData;
  receipt_generated_at?: string;
  notes?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  confirmed_at?: string;
  completed_at?: string;
  cancellation_reason?: string;
  cancellation_notes?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  refund_reason?: string;
  refund_notes?: string;
  refunded_by?: string;
  refunded_at?: string;
  staff_name_last_action?: string;
  fnbstatus?: 'preparing' | 'ready' | 'collected' | 'cancelled';
  fnbstatus_updated_at?: string;
  fnbstatus_updated_by?: string;
}

export interface OrderItemRedemption {
  id: string;
  order_id: string;
  user_id: string;
  item_index: number;
  product_id?: string;
  product_name: string;
  quantity: number;
  redeemed_quantity: number;
  status: 'pending' | 'completed';
  redeemed_at?: string;
  redeemed_by_admin_id?: string;
  redeemed_at_outlet_id?: string;
  redemption_method?: 'scan' | 'manual';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'super_admin' | 'outlet_manager' | 'staff' | 'analyst';
  avatar_url?: string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminPermission {
  id: string;
  admin_id: string;
  resource: string;
  actions: string[];
  created_at: string;
}

export interface AdminActivityLog {
  id: string;
  admin_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

export interface StaffPasscode {
  id: string;
  display_id?: string;
  staff_id?: string;
  outlet_id?: string;
  staff_name: string;
  passcode: string;
  email?: string;
  password_hash?: string;
  description?: string;
  roles?: {
    sections: string[];
    can_scan: boolean;
  };
  is_active: boolean;
  is_superadmin: boolean;
  created_by_admin_id?: string;
  created_at: string;
  updated_at: string;
  last_used_at?: string;
}

export interface StaffScanLog {
  id: string;
  staff_id: string;
  staff_name: string;
  scan_type: 'order' | 'customer' | 'workshop' | 'reward';
  scanned_entity_id?: string;
  scanned_entity_type?: string;
  qr_code?: string;
  customer_id?: string;
  customer_name?: string;
  order_id?: string;
  outlet_id?: string;
  metadata: Record<string, any>;
  scanned_at: string;
  created_at: string;
}

export interface UserVoucher {
  id: string;
  user_id: string;
  voucher_id: string;
  status: 'available' | 'used' | 'expired';
  issued_at: string;
  used_at?: string;
  expires_at?: string;
  usage_count: number;
  max_usage_count: number;
  daily_usage_count?: number;
  last_daily_reset_date?: string;
  issued_by_rule_id?: string;
  last_redeemed_date?: string;
  redemption_count?: number;
  is_daily_voucher?: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  voucher?: Voucher;
}

export interface VoucherAutoRule {
  id: string;
  rule_name: string;
  trigger_type: 'first_login' | 'topup_amount' | 'daily_checkin';
  trigger_conditions: Record<string, any>;
  voucher_template_id?: string;
  voucher_config?: Record<string, any>;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface VoucherRedemption {
  id: string;
  user_voucher_id: string;
  user_id: string;
  voucher_id: string;
  order_id?: string;
  product_id?: string;
  product_name?: string;
  discount_amount: number;
  original_price?: number;
  final_price?: number;
  redeemed_at: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ReceiptModifier {
  group_name: string;
  option_name: string;
  price: number;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  modifiers: ReceiptModifier[];
  item_subtotal: number;
  item_total: number;
}

export interface ReceiptCompany {
  name: string;
  registration_no?: string;
  address: string;
  email: string;
  phone: string;
  website: string;
}

export interface ReceiptCustomer {
  name: string;
  email: string;
  phone: string;
}

export interface ReceiptOutlet {
  name: string;
  location: string;
  address: string;
}

export interface ReceiptOrder {
  order_number: string;
  date: string;
  time: string;
  datetime_iso: string;
}

export interface ReceiptPricing {
  subtotal: number;
  gross_sales: number;
  voucher_discount: number;
  voucher_code?: string;
  tier_discount: number;
  tier_name?: string;
  bonus_discount: number;
  total_amount: number;
}

export interface ReceiptPayment {
  method: string;
  type: string;
  status: string;
}

export interface ReceiptData {
  receipt_number: string;
  order_id: string;
  generated_at: string;
  company: ReceiptCompany;
  customer: ReceiptCustomer;
  outlet: ReceiptOutlet;
  order: ReceiptOrder;
  items: ReceiptItem[];
  pricing: ReceiptPricing;
  payment: ReceiptPayment;
}

export interface SocialTask {
  id: string;
  platform_name: string;
  task_type: string;
  task_description: string;
  link_url: string;
  icon_emoji: string;
  reward_spins: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserSocialTaskCompleted {
  id: string;
  user_id: string;
  social_task_id: string;
  completed_at: string;
  created_at: string;
}
