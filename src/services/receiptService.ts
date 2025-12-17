import { supabase } from '../lib/supabase';
import type { ReceiptData, ReceiptItem } from '../types/database';
import { generateReceiptNumber, parseOrderModifiers, formatReceiptDate, getTierNameById } from '../utils/receiptUtils';

const getCompanySettings = async () => {
  console.log('[ReceiptService] Fetching company settings from app_config...');

  const { data, error } = await supabase
    .from('app_config')
    .select('config_key, config_value')
    .in('config_key', ['business_name', 'company_registration_no', 'business_address', 'contact_email', 'support_phone', 'business_website']);

  if (error) {
    console.error('[ReceiptService] Error fetching company settings:', error);
  }

  console.log('[ReceiptService] Raw data from app_config:', data);

  // Default fallback values
  const settings: any = {
    name: 'Kiddo Heritage Sdn Bhd',
    registration_no: '',
    address: 'The Shore Shopping Gallery, Melaka Malaysia.',
    email: 'info@wonderpark.my',
    phone: '6012-878-9169',
    website: 'www.wonderpark.my'
  };

  data?.forEach(item => {
    const key = item.config_key;
    // Handle JSONB value - it comes as a string directly from Supabase
    let value = item.config_value;

    console.log(`[ReceiptService] Processing ${key}:`, value, `(type: ${typeof value})`);

    // If it's an object (shouldn't happen but just in case), stringify and parse
    if (typeof value === 'object') {
      value = value;
    }

    // Skip empty values
    if (!value || value === '""' || value === 'null') {
      console.log(`[ReceiptService] Skipping empty value for ${key}`);
      return;
    }

    if (key === 'business_name') settings.name = value;
    else if (key === 'company_registration_no') settings.registration_no = value;
    else if (key === 'business_address') settings.address = value;
    else if (key === 'contact_email') settings.email = value;
    else if (key === 'support_phone') settings.phone = value;
    else if (key === 'business_website') settings.website = value;
  });

  console.log('[ReceiptService] Final company settings:', settings);
  return settings;
};

const getPaymentMethodLabel = (paymentMethod?: string, paymentType?: string): string => {
  if (paymentType === 'redemption') return 'Free Redemption';
  if (paymentType === 'deduction') {
    if (paymentMethod === 'wonderstars') return 'W Balance Deduction';
    return 'Wallet Deduction';
  }
  if (paymentType === 'payment') {
    if (paymentMethod?.toLowerCase().includes('fiuu')) return 'Online Payment (FIUU)';
    if (paymentMethod?.toLowerCase().includes('card')) return 'Credit/Debit Card';
    if (paymentMethod?.toLowerCase().includes('fpx')) return 'FPX Online Banking';
    return paymentMethod || 'Online Payment';
  }
  return paymentMethod || 'N/A';
};

export const generateReceiptData = async (orderId: string): Promise<ReceiptData> => {
  console.log('[ReceiptService] Generating receipt data for order ID:', orderId);

  const { data: order, error: orderError } = await supabase
    .from('shop_orders')
    .select(`
      *,
      user:users!user_id (id, name, email, phone),
      outlet:outlets (id, name, location, address)
    `)
    .eq('id', orderId)
    .single();

  if (orderError) {
    console.error('[ReceiptService] Error in generateReceiptData:', orderError);
    throw new Error(`Failed to generate receipt: ${orderError.message}`);
  }

  if (!order) {
    console.error('[ReceiptService] No order found in generateReceiptData for ID:', orderId);
    throw new Error('Order not found');
  }

  console.log('[ReceiptService] Order data loaded:', {
    id: order.id,
    order_number: order.order_number,
    has_user: !!order.user,
    has_outlet: !!order.outlet,
    items_count: order.items?.length || 0
  });

  const companySettings = await getCompanySettings();

  const receiptNumber = await generateReceiptNumber();

  const customer = order.user || {};
  const outlet = order.outlet || {};

  const items: ReceiptItem[] = [];

  if (order.items && Array.isArray(order.items)) {
    order.items.forEach((item: any) => {
      const modifiers = parseOrderModifiers(item);

      const itemSubtotal = item.quantity * item.unit_price;

      let modifiersTotal = 0;
      modifiers.forEach(mod => {
        modifiersTotal += mod.price * item.quantity;
      });

      const itemTotal = itemSubtotal + modifiersTotal;

      items.push({
        name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        modifiers: modifiers,
        item_subtotal: itemSubtotal,
        item_total: itemTotal
      });
    });
  }

  const orderDate = order.completed_at || order.created_at;
  const formattedDate = formatReceiptDate(orderDate);

  const dateParts = formattedDate.split(', ');
  const dateOnly = dateParts[0];
  const timeOnly = dateParts[1] || '';

  const tierName = undefined;

  const receiptData: ReceiptData = {
    receipt_number: receiptNumber,
    order_id: order.id,
    generated_at: new Date().toISOString(),
    company: {
      name: companySettings.name,
      registration_no: companySettings.registration_no,
      address: companySettings.address,
      email: companySettings.email,
      phone: companySettings.phone,
      website: companySettings.website
    },
    customer: {
      name: customer.name || 'Guest Customer',
      email: customer.email || '',
      phone: customer.phone || ''
    },
    outlet: {
      name: outlet.name || 'Unknown Outlet',
      location: outlet.location || '',
      address: outlet.address || ''
    },
    order: {
      order_number: order.order_number || order.id,
      date: dateOnly,
      time: timeOnly,
      datetime_iso: orderDate
    },
    items: items,
    pricing: {
      subtotal: order.subtotal || 0,
      gross_sales: order.gross_sales || 0,
      voucher_discount: order.discount_amount || 0,
      voucher_code: order.voucher_code,
      tier_discount: order.permanent_discount_amount || 0,
      tier_name: tierName,
      bonus_discount: order.bonus_discount_amount || 0,
      total_amount: order.total_amount || 0
    },
    payment: {
      method: getPaymentMethodLabel(order.payment_method, order.payment_type),
      type: order.payment_type || 'payment',
      status: order.status === 'completed' ? 'PAID' : 'PENDING'
    }
  };

  return receiptData;
};

export const saveReceiptToOrder = async (orderId: string, receiptData: ReceiptData): Promise<void> => {
  const { error } = await supabase
    .from('shop_orders')
    .update({
      receipt_number: receiptData.receipt_number,
      receipt_data: receiptData,
      receipt_generated_at: receiptData.generated_at
    })
    .eq('id', orderId);

  if (error) {
    console.error('Error saving receipt to order:', error);
    throw error;
  }
};

export const getOrGenerateReceipt = async (orderId: string): Promise<ReceiptData> => {
  console.log('[ReceiptService] Loading receipt for order ID:', orderId);

  const { data: order, error: orderError } = await supabase
    .from('shop_orders')
    .select('id, receipt_data, receipt_number, receipt_generated_at')
    .eq('id', orderId)
    .single();

  if (orderError) {
    console.error('[ReceiptService] Error fetching order:', orderError);
    throw new Error(`Order not found: ${orderError.message}`);
  }

  if (!order) {
    console.error('[ReceiptService] No order data returned for ID:', orderId);
    throw new Error('Order not found');
  }

  console.log('[ReceiptService] Order found:', order.id, 'Has receipt:', !!order.receipt_data);

  if (order.receipt_data && order.receipt_number) {
    return order.receipt_data as ReceiptData;
  }

  const receiptData = await generateReceiptData(orderId);

  await saveReceiptToOrder(orderId, receiptData);

  return receiptData;
};
