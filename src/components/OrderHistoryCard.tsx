import React from 'react';
import { Package, User, Calendar, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface OrderHistoryCardProps {
  orderId: string;
  orderNumber: string;
  customerName: string;
  createdAt: string;
  lastScannedAt?: string;
  totalItems: number;
  redeemedItems: number;
  status: 'active' | 'partial' | 'completed';
  onClick: () => void;
}

const OrderHistoryCard: React.FC<OrderHistoryCardProps> = ({
  orderId,
  orderNumber,
  customerName,
  createdAt,
  lastScannedAt,
  totalItems,
  redeemedItems,
  status,
  onClick
}) => {
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle,
          bgColor: 'bg-green-50',
          borderColor: 'border-[#32CC7E]',
          textColor: 'text-black',
          badgeColor: 'bg-[#32CC7E]',
          label: 'Completed'
        };
      case 'partial':
        return {
          icon: AlertCircle,
          bgColor: 'bg-blue-50',
          borderColor: 'border-[#39C0ED]',
          textColor: 'text-black',
          badgeColor: 'bg-[#39C0ED]',
          label: 'Partial'
        };
      default:
        return {
          icon: Clock,
          bgColor: 'bg-red-50',
          borderColor: 'border-[#EA5455]',
          textColor: 'text-black',
          badgeColor: 'bg-[#EA5455]',
          label: 'Active'
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border-2 ${statusConfig.borderColor} ${statusConfig.bgColor} hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md hover:shadow-lg`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-black text-gray-900">#{orderNumber}</p>
            <p className="text-xs text-gray-600 font-medium">{orderId.slice(0, 8)}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${statusConfig.badgeColor}`}>
          <StatusIcon className="w-3 h-3 text-white" />
          <span className="text-xs font-bold text-white">{statusConfig.label}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-900">{customerName}</span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-bold text-gray-900">{formatDateTime(lastScannedAt || createdAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-600">Created: {formatDateTime(createdAt)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <span className="text-xs font-semibold text-gray-600">Items</span>
          <span className={`text-sm font-black ${statusConfig.textColor}`}>
            {redeemedItems}/{totalItems}
          </span>
        </div>
      </div>
    </button>
  );
};

export default OrderHistoryCard;
