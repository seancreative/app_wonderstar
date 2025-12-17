import {
  Clock, CheckCircle, XCircle, Package, Ban, DollarSign,
  AlertCircle, LucideIcon
} from 'lucide-react';

export type PaymentStatus = 'pending' | 'paid' | 'failed';
export type FulfillmentStatus = 'waiting_payment' | 'ready' | 'completed' | 'cancelled' | 'refunded';

export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  icon: LucideIcon;
  description: string;
}

export const paymentStatusConfig: Record<PaymentStatus, StatusConfig> = {
  pending: {
    label: 'Pending',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    icon: Clock,
    description: 'Awaiting payment confirmation'
  },
  paid: {
    label: 'Paid',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: CheckCircle,
    description: 'Payment successfully completed'
  },
  failed: {
    label: 'Failed',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: XCircle,
    description: 'Payment failed or cancelled'
  }
};

export const fulfillmentStatusConfig: Record<FulfillmentStatus, StatusConfig> = {
  waiting_payment: {
    label: 'Waiting Payment',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    icon: Clock,
    description: 'Waiting for payment to be confirmed'
  },
  ready: {
    label: 'Ready',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: Package,
    description: 'Order is ready for pickup/collection'
  },
  completed: {
    label: 'Completed',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: CheckCircle,
    description: 'Order has been collected by customer'
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: Ban,
    description: 'Order has been cancelled'
  },
  refunded: {
    label: 'Refunded',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    icon: DollarSign,
    description: 'Order has been refunded'
  }
};

export function getPaymentStatusConfig(status: PaymentStatus): StatusConfig {
  return paymentStatusConfig[status] || {
    label: status,
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    icon: AlertCircle,
    description: 'Unknown status'
  };
}

export function getFulfillmentStatusConfig(status: FulfillmentStatus): StatusConfig {
  return fulfillmentStatusConfig[status] || {
    label: status,
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    icon: AlertCircle,
    description: 'Unknown status'
  };
}

export const cancellationReasons = [
  'Customer Request',
  'Out of Stock',
  'Duplicate Order',
  'Payment Issue',
  'Store Closed',
  'Unable to Fulfill',
  'Staff Error',
  'Other'
];

export const refundReasons = [
  'Customer Request',
  'Product Issue',
  'Service Issue',
  'Order Error',
  'Duplicate Payment',
  'Promotional Adjustment',
  'Goodwill Gesture',
  'Other'
];

export interface OrderStatusTransition {
  from: FulfillmentStatus[];
  to: FulfillmentStatus;
  requiresReason: boolean;
  label: string;
  description: string;
}

export const allowedStatusTransitions: OrderStatusTransition[] = [
  {
    from: ['waiting_payment', 'ready', 'completed'],
    to: 'cancelled',
    requiresReason: true,
    label: 'Cancel Order',
    description: 'Cancel this order with a reason'
  },
  {
    from: ['ready', 'completed'],
    to: 'refunded',
    requiresReason: true,
    label: 'Refund Order',
    description: 'Refund this order with a reason'
  },
  {
    from: ['waiting_payment'],
    to: 'ready',
    requiresReason: false,
    label: 'Mark as Ready',
    description: 'Manually mark order as ready (usually auto-set by payment)'
  },
  {
    from: ['ready'],
    to: 'completed',
    requiresReason: false,
    label: 'Mark as Completed',
    description: 'Manually mark order as completed (usually auto-set by QR scan)'
  }
];

export function getAvailableTransitions(currentStatus: FulfillmentStatus): OrderStatusTransition[] {
  return allowedStatusTransitions.filter(transition =>
    transition.from.includes(currentStatus)
  );
}

export function canTransitionTo(
  currentStatus: FulfillmentStatus,
  targetStatus: FulfillmentStatus
): boolean {
  return allowedStatusTransitions.some(
    transition => transition.from.includes(currentStatus) && transition.to === targetStatus
  );
}

export function validateStatusChange(
  currentStatus: FulfillmentStatus,
  targetStatus: FulfillmentStatus,
  reason?: string
): { valid: boolean; error?: string } {
  const transition = allowedStatusTransitions.find(
    t => t.from.includes(currentStatus) && t.to === targetStatus
  );

  if (!transition) {
    return {
      valid: false,
      error: `Cannot transition from ${currentStatus} to ${targetStatus}`
    };
  }

  if (transition.requiresReason && !reason) {
    return {
      valid: false,
      error: 'Reason is required for this status change'
    };
  }

  return { valid: true };
}

export interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  errorCode?: string;
  showIcon?: boolean;
  className?: string;
}

export interface FulfillmentStatusBadgeProps {
  status: FulfillmentStatus;
  showIcon?: boolean;
  className?: string;
}
