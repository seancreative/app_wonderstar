import { CreditCard, Wallet as WalletIcon } from 'lucide-react';

export interface PaymentMethodConfig {
  label: string;
  shortLabel: string;
  icon: any;
  color: string;
  bgColor: string;
}

export const getPaymentMethodConfig = (paymentMethod: string | undefined): PaymentMethodConfig => {
  const method = (paymentMethod || '').toLowerCase();

  const configs: Record<string, PaymentMethodConfig> = {
    // Fiuu payment methods (real money)
    'tng': {
      label: 'Touch n Go eWallet',
      shortLabel: 'TnG',
      icon: WalletIcon,
      color: 'text-blue-700',
      bgColor: 'bg-blue-100'
    },
    'grabpay': {
      label: 'GrabPay',
      shortLabel: 'Grab',
      icon: WalletIcon,
      color: 'text-green-700',
      bgColor: 'bg-green-100'
    },
    'boost': {
      label: 'Boost',
      shortLabel: 'Boost',
      icon: WalletIcon,
      color: 'text-orange-700',
      bgColor: 'bg-orange-100'
    },
    'fpx': {
      label: 'FPX Online Banking',
      shortLabel: 'FPX',
      icon: CreditCard,
      color: 'text-indigo-700',
      bgColor: 'bg-indigo-100'
    },
    'credit': {
      label: 'Credit Card',
      shortLabel: 'Credit',
      icon: CreditCard,
      color: 'text-purple-700',
      bgColor: 'bg-purple-100'
    },
    'debit': {
      label: 'Debit Card',
      shortLabel: 'Debit',
      icon: CreditCard,
      color: 'text-pink-700',
      bgColor: 'bg-pink-100'
    },
    'card': {
      label: 'Card Payment',
      shortLabel: 'Card',
      icon: CreditCard,
      color: 'text-purple-700',
      bgColor: 'bg-purple-100'
    },

    // Internal payment methods
    'wonderstars': {
      label: 'W Balance',
      shortLabel: 'W Bal',
      icon: WalletIcon,
      color: 'text-blue-700',
      bgColor: 'bg-blue-100'
    },
    'stamps': {
      label: 'Stamp Redemption',
      shortLabel: 'Stamps',
      icon: WalletIcon,
      color: 'text-purple-700',
      bgColor: 'bg-purple-100'
    },
    'free_reward': {
      label: 'Free Reward',
      shortLabel: 'Free',
      icon: WalletIcon,
      color: 'text-green-700',
      bgColor: 'bg-green-100'
    }
  };

  return configs[method] || {
    label: 'Unknown',
    shortLabel: '-',
    icon: CreditCard,
    color: 'text-gray-700',
    bgColor: 'bg-gray-100'
  };
};

export const formatDiscountAmount = (amount: number | string): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return numAmount > 0 ? `-${numAmount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '0.00';
};

export const formatCurrency = (amount: number | string): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `RM ${numAmount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
