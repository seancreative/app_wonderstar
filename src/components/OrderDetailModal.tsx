import React from 'react';
import { X, Package, User, Calendar, CheckCircle, Clock, MapPin } from 'lucide-react';

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface ItemRedemption {
  id: string;
  item_index: number;
  product_name: string;
  quantity: number;
  redeemed_quantity: number;
  status: 'pending' | 'completed';
  redeemed_at: string | null;
}

interface OrderDetailModalProps {
  orderId: string;
  orderNumber: string;
  customerName: string;
  createdAt: string;
  items: OrderItem[];
  redemptions: ItemRedemption[];
  outletName: string;
  outletLocation: string;
  onClose: () => void;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  orderId,
  orderNumber,
  customerName,
  createdAt,
  items,
  redemptions,
  outletName,
  outletLocation,
  onClose
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const pendingRedemptions = redemptions.filter(r => r.status === 'pending');
  const completedRedemptions = redemptions.filter(r => r.status === 'completed');

  const groupByDate = (redemptions: ItemRedemption[]) => {
    const groups: { [key: string]: ItemRedemption[] } = {};
    redemptions.forEach(redemption => {
      if (redemption.redeemed_at) {
        const date = formatDate(redemption.redeemed_at);
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(redemption);
      }
    });

    Object.keys(groups).forEach(date => {
      groups[date].sort((a, b) => {
        const timeA = a.redeemed_at ? new Date(a.redeemed_at).getTime() : 0;
        const timeB = b.redeemed_at ? new Date(b.redeemed_at).getTime() : 0;
        return timeB - timeA;
      });
    });

    return groups;
  };

  const groupedRedemptions = groupByDate(completedRedemptions);
  const sortedDates = Object.keys(groupedRedemptions).sort((a, b) => {
    const itemsA = groupedRedemptions[a];
    const itemsB = groupedRedemptions[b];
    const latestA = itemsA[0]?.redeemed_at ? new Date(itemsA[0].redeemed_at).getTime() : 0;
    const latestB = itemsB[0]?.redeemed_at ? new Date(itemsB[0].redeemed_at).getTime() : 0;
    return latestB - latestA;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-500 to-indigo-600 p-6 rounded-t-3xl">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">Order #{orderNumber}</h2>
                  <p className="text-sm text-blue-100 font-medium">{orderId.slice(0, 8)}</p>
                </div>
              </div>
              <div className="space-y-1 mt-4">
                <div className="flex items-center gap-2 text-white">
                  <User className="w-4 h-4" />
                  <span className="text-sm font-semibold">{customerName}</span>
                </div>
                <div className="flex items-center gap-2 text-blue-100">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">{formatDateTime(createdAt)}</span>
                </div>
                {outletName && (
                  <div className="flex items-center gap-2 text-blue-100">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm font-medium">{outletName} {outletLocation && `• ${outletLocation}`}</span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {pendingRedemptions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-black text-gray-900">Pending Redemption</h3>
                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold">
                  {pendingRedemptions.length}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((item, index) => {
                  const redemption = redemptions.find(r => r.item_index === index);
                  if (redemption?.status === 'completed') return null;

                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-[#EA5455] border-2 border-[#EA5455] rounded-xl"
                    >
                      <div className="flex-1">
                        <p className="font-bold text-black">{item.product_name}</p>
                        <p className="text-sm text-black font-medium">Quantity: {item.quantity}</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-red-300 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-red-900" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {sortedDates.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <h3 className="text-lg font-black text-gray-900">Redeemed Items</h3>
                <span className="px-2 py-1 bg-[#32CC7E] text-black rounded-lg text-xs font-bold">
                  {completedRedemptions.length}
                </span>
              </div>
              <div className="space-y-4">
                {sortedDates.map((date) => (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px bg-gray-200 flex-1"></div>
                      <p className="text-sm font-black text-gray-600 px-2">Redeemed on {date}</p>
                      <div className="h-px bg-gray-200 flex-1"></div>
                    </div>
                    <div className="space-y-2">
                      {groupedRedemptions[date].map((redemption) => {
                        const item = items[redemption.item_index];
                        return (
                          <div
                            key={redemption.id}
                            className="flex items-center justify-between p-4 bg-[#32CC7E] border-2 border-[#32CC7E] rounded-xl"
                          >
                            <div className="flex-1">
                              <p className="font-bold text-black">{item.product_name}</p>
                              <p className="text-sm text-black font-medium">
                                Quantity: {item.quantity}
                              </p>
                              {redemption.redeemed_at && (
                                <p className="text-xs text-gray-900 font-semibold mt-1">
                                  {formatDateTime(redemption.redeemed_at)}
                                </p>
                              )}
                            </div>
                            <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center">
                              <CheckCircle className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingRedemptions.length === 0 && completedRedemptions.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-semibold">No redemption data available</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 p-4 rounded-b-3xl border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-transform shadow-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailModal;
