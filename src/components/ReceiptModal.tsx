import React, { useState, useEffect } from 'react';
import { X, Printer, Loader2, AlertCircle } from 'lucide-react';
import OrderReceipt from './OrderReceipt';
import type { ReceiptData } from '../types/database';
import { getOrGenerateReceipt } from '../services/receiptService';

interface ReceiptModalProps {
  orderId: string;
  onClose: () => void;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ orderId, onClose }) => {
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReceipt();
  }, [orderId]);

  const loadReceipt = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getOrGenerateReceipt(orderId);
      setReceiptData(data);
    } catch (err: any) {
      console.error('Error loading receipt:', err);
      setError(err.message || 'Failed to load receipt. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between print:hidden">
          <h2 className="text-xl font-black text-gray-900">Order Receipt</h2>
          <div className="flex items-center gap-2">
            {receiptData && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print Receipt
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-gray-600 font-semibold">Generating receipt...</p>
              <p className="text-sm text-gray-500 mt-2">Please wait a moment</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 max-w-md">
                <div className="flex items-center gap-3 mb-3">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                  <h3 className="text-lg font-black text-red-900">Error Loading Receipt</h3>
                </div>
                <p className="text-red-800 mb-4">{error}</p>
                <button
                  onClick={loadReceipt}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {receiptData && !loading && !error && (
            <OrderReceipt receiptData={receiptData} />
          )}
        </div>
      </div>

      <style>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }

          body {
            margin: 0;
            padding: 0;
          }

          .fixed {
            position: static;
          }

          .overflow-y-auto {
            overflow: visible;
          }

          .rounded-2xl {
            border-radius: 0;
          }

          .shadow-2xl {
            box-shadow: none;
          }

          .max-w-4xl {
            max-width: 100%;
          }

          .max-h-\\[90vh\\] {
            max-height: none;
          }
        }
      `}</style>
    </div>
  );
};

export default ReceiptModal;
