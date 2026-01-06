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

  // Handle topup orders differently
  if (order.payment_type === 'topup') {
    const metadata = order.metadata || {};
    const topupAmount = metadata.topup_amount || order.total_amount || 0;
    const bonusAmount = metadata.bonus_awarded || 0;

    items.push({
      name: `Wallet Top-up`,
      quantity: 1,
      unit_price: topupAmount,
      modifiers: [],
      item_subtotal: topupAmount,
      item_total: topupAmount
    });

    if (bonusAmount > 0) {
      items.push({
        name: `Bonus Credited`,
        quantity: 1,
        unit_price: bonusAmount,
        modifiers: [],
        item_subtotal: bonusAmount,
        item_total: bonusAmount
      });
    }
  } else if (order.items && Array.isArray(order.items)) {
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
      name: order.payment_type === 'topup' ? 'W Balance' : (outlet.name || 'Unknown Outlet'),
      location: order.payment_type === 'topup' ? 'Online' : (outlet.location || ''),
      address: order.payment_type === 'topup' ? '' : (outlet.address || '')
    },
    order: {
      order_number: order.order_number || order.id,
      date: dateOnly,
      time: timeOnly,
      datetime_iso: orderDate
    },
    items: items,
    pricing: {
      subtotal: order.subtotal || order.total_amount || 0,
      gross_sales: order.gross_sales || order.total_amount || 0,
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
      status: order.payment_status === 'paid' ? 'PAID' : (order.status === 'completed' ? 'PAID' : 'PENDING')
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

export const getOrGenerateReceipt = async (orderId: string): Promise<ReceiptData & { actualOrderId?: string }> => {
  console.log('[ReceiptService] Loading receipt for order ID:', orderId);

  // First try to fetch from shop_orders
  let { data: order, error: orderError } = await supabase
    .from('shop_orders')
    .select('id, receipt_data, receipt_number, receipt_generated_at, payment_type')
    .eq('id', orderId)
    .single();

  let actualOrderId = orderId;

  // If not found in shop_orders, check if it's a wallet_transaction ID
  if (orderError || !order) {
    console.log('[ReceiptService] Not found in shop_orders, checking wallet_transactions...');

    const { data: walletTxn, error: walletError } = await supabase
      .from('wallet_transactions')
      .select('id, metadata')
      .eq('id', orderId)
      .single();

    if (walletError || !walletTxn) {
      console.error('[ReceiptService] Order not found in either table:', orderError, walletError);
      throw new Error('Order not found');
    }

    // Get the wpay_order_id from metadata and find the shop_order
    const wpayOrderId = walletTxn.metadata?.order_number;
    if (!wpayOrderId) {
      throw new Error('Wallet transaction missing order number');
    }

    console.log('[ReceiptService] Searching for shop_order with order_number:', wpayOrderId);

    const { data: shopOrders, error: shopOrderError } = await supabase
      .from('shop_orders')
      .select('id, receipt_data, receipt_number, receipt_generated_at, payment_type, order_number')
      .eq('order_number', wpayOrderId);

    console.log('[ReceiptService] Shop order query result:', {
      data: shopOrders,
      error: shopOrderError,
      count: shopOrders?.length
    });

    if (shopOrderError || !shopOrders || shopOrders.length === 0) {
      console.warn('[ReceiptService] Shop order not found for wpay order, will create from wallet_transaction:', wpayOrderId);

      // Create a minimal shop_order structure from wallet_transaction for receipt generation
      // This handles cases where shop_order creation failed but wallet_transaction exists
      const amount = walletTxn.metadata?.topup_amount || walletTxn.amount || 0;
      const bonusAmount = walletTxn.metadata?.bonus_amount || 0;

      order = {
        id: orderId, // Use wallet_transaction ID as fallback
        order_number: wpayOrderId,
        payment_type: 'topup',
        total_amount: amount,
        subtotal: amount,
        gross_sales: amount,
        discount_amount: 0,
        bonus_discount_amount: 0,
        permanent_discount_amount: 0,
        payment_method: 'card',
        payment_status: 'paid',
        status: 'completed',
        receipt_data: null,
        receipt_number: null,
        receipt_generated_at: null,
        metadata: {
          topup_amount: amount,
          bonus_awarded: bonusAmount,
          is_topup: true
        }
      };
      actualOrderId = orderId;
      console.log('[ReceiptService] Created virtual shop_order from wallet_transaction');
    } else {
      order = shopOrders[0];
      actualOrderId = order.id;
      console.log('[ReceiptService] Found shop_order via wallet_transaction:', actualOrderId);
    }
  }

  console.log('[ReceiptService] Order found:', order.id, 'Has receipt:', !!order.receipt_data);

  let receiptData: ReceiptData;

  if (order.receipt_data && order.receipt_number) {
    receiptData = order.receipt_data as ReceiptData;
  } else {
    receiptData = await generateReceiptData(order.id);
    await saveReceiptToOrder(order.id, receiptData);
  }

  // Attach the actual order ID for e-invoice purposes
  return { ...receiptData, actualOrderId };
};
