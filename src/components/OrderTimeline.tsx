import React from 'react';
import { ShopOrder } from '../types/database';

interface TimelineEvent {
  timestamp: string;
  text: string;
}

interface OrderTimelineProps {
  order: ShopOrder;
}

const OrderTimeline: React.FC<OrderTimelineProps> = ({ order }) => {
  const events: TimelineEvent[] = [];

  events.push({
    timestamp: order.created_at,
    text: 'The order is pending payment.'
  });

  if (order.payment_status === 'paid' && order.confirmed_at) {
    events.push({
      timestamp: order.confirmed_at,
      text: 'The order has been paid.'
    });
  }

  if ((order.status === 'ready' || order.status === 'completed') && order.confirmed_at) {
    const staffName = order.staff_name_last_action;
    events.push({
      timestamp: order.confirmed_at,
      text: staffName
        ? `${staffName} changed the order status to: Ready`
        : 'Order status changed to: Ready'
    });
  }

  if (order.status === 'completed' && order.completed_at) {
    const staffName = order.staff_name_last_action;
    events.push({
      timestamp: order.completed_at,
      text: staffName
        ? `${staffName} scanned MyQR and changed the order status to: Completed`
        : 'Order status changed to: Completed'
    });
  }

  if (order.status === 'cancelled' && order.cancelled_at) {
    const reason = order.cancellation_reason || 'No reason provided';
    events.push({
      timestamp: order.cancelled_at,
      text: `Order cancelled. Reason: ${reason}`
    });
  }

  if (order.status === 'refunded' && order.refunded_at) {
    const reason = order.refund_reason || 'No reason provided';
    events.push({
      timestamp: order.refunded_at,
      text: `Order refunded. Reason: ${reason}`
    });
  }

  if (order.payment_status === 'failed' && order.payment_error_code) {
    events.push({
      timestamp: order.updated_at,
      text: `Payment failed: ${order.payment_error_code}`
    });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(',', ' |');
  };

  return (
    <div className="space-y-3">
      {events.map((event, index) => (
        <div key={index} className="flex gap-4">
          <div className="text-sm text-gray-600 font-medium whitespace-nowrap min-w-[180px]">
            {formatTimestamp(event.timestamp)}
          </div>
          <div className="text-sm text-gray-900">
            {event.text}
          </div>
        </div>
      ))}
    </div>
  );
};

export default OrderTimeline;
