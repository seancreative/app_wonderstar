import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Receipt, XCircle } from 'lucide-react';
import { ShopOrder, Outlet, User as UserType, OrderItemRedemption } from '../../types/database';
import { getPaymentMethodConfig, formatDiscountAmount, formatCurrency } from '../../utils/paymentMethodUtils';
import {
  getItemOriginalSubtotal,
  getItemFinalPrice,
  getItemVoucherDiscount,
  getItemTierDiscount,
  getItemTotalDiscount,
  hasItemDiscount,
  getFormattedModifiers
} from '../../utils/orderItemUtils';
import { formatCMSDateTime } from '../../utils/dateTimeUtils';
import ReceiptModal from '../ReceiptModal';

interface OrderWithDetails extends ShopOrder {
  users?: UserType;
  outlets?: Outlet;
  order_item_redemptions?: OrderItemRedemption[];
}

interface OrderNumberLinkProps {
  orderNumber: string;
  className?: string;
}

const OrderNumberLink: React.FC<OrderNumberLinkProps> = ({ orderNumber, className = '' }) => {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const fetchOrderDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shop_orders')
        .select(`
          *,
          users (id, name, email, phone, tier_id),
          outlets (id, name, location),
          order_item_redemptions (*)
        `)
        .eq('order_number', orderNumber)
        .single();

      if (error) throw error;

      setOrder(data as OrderWithDetails);
      setShowModal(true);
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fetchOrderDetails();
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; classes: string }> = {
      pending: { label: 'Pending', classes: 'bg-yellow-100 text-yellow-800' },
      confirmed: { label: 'Confirmed', classes: 'bg-blue-100 text-blue-800' },
      ready: { label: 'Ready', classes: 'bg-purple-100 text-purple-800' },
      completed: { label: 'Completed', classes: 'bg-green-100 text-green-800' },
      cancelled: { label: 'Cancelled', classes: 'bg-red-100 text-red-800' }
    };

    const badge = badges[status] || { label: status, classes: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-bold ${badge.classes}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`text-blue-600 hover:text-blue-800 hover:underline font-mono font-semibold transition-colors disabled:opacity-50 ${className}`}
      >
        {loading ? (
          <span className="flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            {orderNumber}
          </span>
        ) : (
          orderNumber
        )}
      </button>

      {showModal && order && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-2xl font-black text-gray-900">Order Details</h2>
              <div className="flex items-center gap-2">
                {(order.status === 'confirmed' || order.status === 'ready' || order.status === 'completed') && (
                  <button
                    onClick={() => setShowReceiptModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                  >
                    <Receipt className="w-4 h-4" />
                    View Receipt
                  </button>
                )}
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <XCircle className="w-6 h-6 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-semibold text-gray-500 mb-1">Order Number</p>
                  <p className="text-lg font-bold text-gray-900 font-mono">{order.order_number}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-500 mb-1">Status</p>
                  {getStatusBadge(order.status)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-500 mb-1">Customer</p>
                  <p className="text-base font-bold text-gray-900">{order.users?.name || 'N/A'}</p>
                  <p className="text-sm text-gray-600">{order.users?.email}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-500 mb-1">Outlet</p>
                  <p className="text-base font-bold text-gray-900">{order.outlets?.name || 'N/A'}</p>
                  <p className="text-sm text-gray-600">{order.outlets?.location}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-500 mb-1">Order Date</p>
                  <p className="text-base font-bold text-gray-900">{formatCMSDateTime(order.created_at)}</p>
                </div>
                {order.completed_at && (
                  <div>
                    <p className="text-sm font-semibold text-gray-500 mb-1">Completed Date</p>
                    <p className="text-base font-bold text-gray-900">{formatCMSDateTime(order.completed_at)}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg font-black text-gray-900 mb-4">Order Items</h3>
                <div className="space-y-3">
                  {order.items.map((item: any, index: number) => (
                    <div key={index} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900">{item.product_name}</h4>
                          <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                          {getFormattedModifiers(item).length > 0 && (
                            <div className="mt-2 space-y-1">
                              {getFormattedModifiers(item).map((mod: string, modIndex: number) => (
                                <p key={modIndex} className="text-xs text-gray-600 ml-2">+ {mod}</p>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">{formatCurrency(item.total_price)}</p>
                          {hasItemDiscount(item) && (
                            <p className="text-xs text-red-600 font-semibold">
                              Discount: {formatDiscountAmount(getItemTotalDiscount(item))}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="bg-blue-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-base">
                    <span className="font-semibold text-gray-700">Subtotal:</span>
                    <span className="font-bold text-gray-900">{formatCurrency(order.subtotal)}</span>
                  </div>
                  {order.discount_amount > 0 && (
                    <div className="flex justify-between text-base text-red-600">
                      <span className="font-semibold">Voucher Discount:</span>
                      <span className="font-bold">{formatDiscountAmount(order.discount_amount)}</span>
                    </div>
                  )}
                  {order.permanent_discount_amount > 0 && (
                    <div className="flex justify-between text-base text-orange-600">
                      <span className="font-semibold">Tier Discount:</span>
                      <span className="font-bold">{formatDiscountAmount(order.permanent_discount_amount)}</span>
                    </div>
                  )}
                  {order.bonus_discount_amount > 0 && (
                    <div className="flex justify-between text-base text-amber-600">
                      <span className="font-semibold">Bonus Credit:</span>
                      <span className="font-bold">{formatDiscountAmount(order.bonus_discount_amount)}</span>
                    </div>
                  )}
                  <div className="border-t-2 border-blue-200 pt-2 flex justify-between text-xl">
                    <span className="font-black text-gray-900">Total:</span>
                    <span className="font-black text-gray-900">{formatCurrency(order.total_amount)}</span>
                  </div>
                </div>
              </div>

              {order.notes && (
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-lg font-black text-gray-900 mb-2">Notes</h3>
                  <p className="text-base text-gray-700 bg-yellow-50 p-4 rounded-xl">{order.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showReceiptModal && order && (
        <ReceiptModal
          orderId={order.id}
          onClose={() => setShowReceiptModal(false)}
        />
      )}
    </>
  );
};

export default OrderNumberLink;
