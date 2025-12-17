import { supabase } from '../lib/supabase';

export const generateReceiptNumber = async (): Promise<string> => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');

  const datePrefix = `R${year}${month}${day}`;

  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const receiptNumber = `${datePrefix}-${randomDigits}`;

    const { data, error } = await supabase
      .from('shop_orders')
      .select('receipt_number')
      .eq('receipt_number', receiptNumber)
      .maybeSingle();

    if (error) {
      console.error('Error checking receipt number uniqueness:', error);
      throw error;
    }

    if (!data) {
      return receiptNumber;
    }

    attempts++;
  }

  throw new Error('Failed to generate unique receipt number after maximum attempts');
};

export const formatReceiptDate = (dateString: string): string => {
  const date = new Date(dateString);

  const day = date.getDate().toString().padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;

  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
};

export const formatReceiptCurrency = (amount: number): string => {
  return `RM ${amount.toFixed(2)}`;
};

export const formatReceiptDiscount = (amount: number): string => {
  return `-RM ${Math.abs(amount).toFixed(2)}`;
};

export const alignReceiptText = (left: string, right: string, width: number = 50): string => {
  const leftPart = left.slice(0, width - right.length - 1);
  const spaces = ' '.repeat(Math.max(1, width - leftPart.length - right.length));
  return `${leftPart}${spaces}${right}`;
};

export const parseOrderModifiers = (item: any): Array<{ group_name: string; option_name: string; price: number }> => {
  const modifiers: Array<{ group_name: string; option_name: string; price: number }> = [];

  if (item.metadata?.selected_modifiers && Array.isArray(item.metadata.selected_modifiers)) {
    item.metadata.selected_modifiers.forEach((group: any) => {
      if (group.selected_options && Array.isArray(group.selected_options)) {
        group.selected_options.forEach((option: any) => {
          modifiers.push({
            group_name: group.group_name || '',
            option_name: option.option_name || option.name || '',
            price: option.price || 0
          });
        });
      }
    });
  }

  return modifiers;
};

export const getTierNameById = (tierId: string): string => {
  const tierNames: Record<string, string> = {
    'tier_1': 'Bronze',
    'tier_2': 'Silver',
    'tier_3': 'Gold',
    'tier_4': 'Platinum',
    'tier_5': 'Diamond'
  };
  return tierNames[tierId] || 'Member';
};
