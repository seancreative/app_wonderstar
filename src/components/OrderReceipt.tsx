import React from 'react';
import type { ReceiptData } from '../types/database';

interface OrderReceiptProps {
  receiptData: ReceiptData;
}

const OrderReceipt: React.FC<OrderReceiptProps> = ({ receiptData }) => {
  const { company, customer, outlet, order, items, pricing, payment } = receiptData;

  const formatCurrency = (amount: number) => `RM ${amount.toFixed(2)}`;
  const formatDiscount = (amount: number) => `-RM ${Math.abs(amount).toFixed(2)}`;

  return (
    <div className="receipt-container bg-white p-8 max-w-[210mm] mx-auto text-black font-mono text-sm leading-relaxed">
      <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
        <h1 className="text-xl font-bold mb-2">{company.name}</h1>
        {company.registration_no && (
          <p className="text-[10px] text-gray-600 mb-1">{company.registration_no}</p>
        )}
        <p className="text-xs whitespace-pre-line">{company.address}</p>
        <p className="text-xs mt-1">Tel: {company.phone}</p>
        <p className="text-xs">Email: {company.email}</p>
        <p className="text-xs">Web: {company.website}</p>
      </div>

      <div className="text-center mb-6 border-b border-gray-400 pb-4">
        <h2 className="text-lg font-bold">OFFICIAL RECEIPT</h2>
      </div>

      <div className="mb-6 space-y-1 text-xs border-b border-gray-400 pb-4">
        <div className="flex justify-between">
          <span className="font-bold">Receipt No:</span>
          <span>{receiptData.receipt_number}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold">Order ID:</span>
          <span>{order.order_number}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold">Date:</span>
          <span>{order.date}, {order.time}</span>
        </div>
      </div>

      <div className="mb-6 text-xs border-b border-gray-400 pb-4">
        <p className="font-bold mb-1">Outlet:</p>
        <p className="ml-2">{outlet.name}</p>
        {outlet.location && <p className="ml-2">{outlet.location}</p>}
      </div>

      <div className="mb-6 text-xs border-b border-gray-400 pb-4">
        <p className="font-bold mb-1">Customer:</p>
        <p className="ml-2">{customer.name}</p>
        {customer.phone && <p className="ml-2">Phone: {customer.phone}</p>}
        {customer.email && <p className="ml-2">Email: {customer.email}</p>}
      </div>

      <div className="mb-6 border-b-2 border-gray-800 pb-4">
        <h3 className="font-bold mb-3 text-center border-b border-gray-400 pb-2">ITEMS</h3>

        {items.map((item, index) => (
          <div key={index} className="mb-4 text-xs">
            <div className="flex justify-between font-bold">
              <span className="flex-1">{item.name}</span>
              <span className="w-12 text-right">{item.quantity}</span>
              <span className="w-20 text-right">{formatCurrency(item.item_subtotal)}</span>
            </div>

            {item.modifiers.length > 0 && (
              <div className="ml-4 mt-1 space-y-1">
                {item.modifiers.map((mod, modIndex) => (
                  <div key={modIndex} className="flex justify-between text-gray-600">
                    <span className="flex-1">+ {mod.option_name}</span>
                    <span className="w-20 text-right">{formatCurrency(mod.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between mt-1 font-bold">
              <span>Item Total:</span>
              <span className="w-20 text-right">{formatCurrency(item.item_total)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6 text-xs space-y-2 border-b-2 border-gray-800 pb-4">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span className="font-bold">{formatCurrency(pricing.subtotal)}</span>
        </div>

        {pricing.voucher_discount > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Voucher Discount {pricing.voucher_code ? `(${pricing.voucher_code})` : ''}:</span>
            <span className="font-bold">{formatDiscount(pricing.voucher_discount)}</span>
          </div>
        )}

        {pricing.tier_discount > 0 && (
          <div className="flex justify-between text-orange-600">
            <span>Tier Discount {pricing.tier_name ? `(${pricing.tier_name})` : ''}:</span>
            <span className="font-bold">{formatDiscount(pricing.tier_discount)}</span>
          </div>
        )}

        {pricing.bonus_discount > 0 && (
          <div className="flex justify-between text-amber-600">
            <span>Bonus Credit Applied:</span>
            <span className="font-bold">{formatDiscount(pricing.bonus_discount)}</span>
          </div>
        )}
      </div>

      <div className="mb-6 text-base border-b-2 border-gray-800 pb-4">
        <div className="flex justify-between font-bold">
          <span>TOTAL PAID:</span>
          <span>{formatCurrency(pricing.total_amount)}</span>
        </div>
      </div>

      <div className="mb-6 text-xs border-b border-gray-400 pb-4">
        <div className="flex justify-between">
          <span className="font-bold">Payment Method:</span>
          <span>{payment.method}</span>
        </div>
      </div>

      <div className="text-center text-xs space-y-2 mb-4">
        <p className="font-bold">Thank you for your purchase!</p>
        <p>Visit us again at Kiddo Heritage</p>
      </div>

      <div className="text-center text-xs text-gray-500 border-t border-gray-400 pt-4">
        <p>This is a computer-generated receipt</p>
        <p className="text-xs mt-1">Generated on {new Date(receiptData.generated_at).toLocaleString('en-MY')}</p>
      </div>

      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }

          .receipt-container {
            max-width: 100%;
            margin: 0;
            padding: 20mm;
            font-size: 11pt;
            line-height: 1.4;
          }

          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default OrderReceipt;
