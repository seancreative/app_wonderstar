import React, { useState } from 'react';
import { X, IceCream, UtensilsCrossed, Check } from 'lucide-react';
import QRCodeDisplay from './QRCodeDisplay';

interface RedemptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  redemptionType: 'ice_cream' | 'ramen';
  onConfirm: (flavor: string) => Promise<void>;
}

const RedemptionModal: React.FC<RedemptionModalProps> = ({
  isOpen,
  onClose,
  redemptionType,
  onConfirm,
}) => {
  const [selectedFlavor, setSelectedFlavor] = useState<string>('');
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');

  const iceCreamFlavors = [
    { id: 'vanilla', name: 'Vanilla', emoji: '🍦' },
    { id: 'chocolate', name: 'Chocolate', emoji: '🍫' },
    { id: 'strawberry', name: 'Strawberry', emoji: '🍓' },
    { id: 'mint', name: 'Mint Chocolate Chip', emoji: '🍃' },
    { id: 'cookies', name: 'Cookies & Cream', emoji: '🍪' },
    { id: 'mango', name: 'Mango', emoji: '🥭' },
  ];

  const ramenFlavors = [
    { id: 'shoyu', name: 'Shoyu Ramen', emoji: '🍜' },
    { id: 'miso', name: 'Miso Ramen', emoji: '🍲' },
    { id: 'tonkotsu', name: 'Tonkotsu Ramen', emoji: '🥢' },
    { id: 'spicy', name: 'Spicy Ramen', emoji: '🌶️' },
    { id: 'vegetarian', name: 'Vegetarian Ramen', emoji: '🥗' },
    { id: 'seafood', name: 'Seafood Ramen', emoji: '🦐' },
  ];

  const flavors = redemptionType === 'ice_cream' ? iceCreamFlavors : ramenFlavors;
  const Icon = redemptionType === 'ice_cream' ? IceCream : UtensilsCrossed;
  const title = redemptionType === 'ice_cream' ? 'Free Ice Cream' : 'Free Ramen Bowl';
  const stampsRequired = redemptionType === 'ice_cream' ? 5 : 10;

  const handleConfirm = async () => {
    if (!selectedFlavor) return;

    setConfirming(true);
    try {
      await onConfirm(selectedFlavor);
      const mockQrCode = `${redemptionType.toUpperCase()}-${Date.now()}`;
      setQrCode(mockQrCode);
      setSuccess(true);
    } catch (error) {
      console.error('Redemption failed:', error);
      alert('Failed to process redemption. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const handleClose = () => {
    setSelectedFlavor('');
    setSuccess(false);
    setQrCode('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative glass rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in">
        {!success ? (
          <>
            <div className="sticky top-0 glass p-6 border-b border-gray-200/50 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl shadow-glow">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">{title}</h2>
                  <p className="text-sm text-gray-600">{stampsRequired} stamps</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="glass p-4 rounded-2xl bg-gradient-to-r from-primary-50 to-blue-50">
                <p className="text-sm text-gray-700 font-medium text-center">
                  Select your favorite flavor to redeem your reward
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold text-gray-900">Choose Flavor:</p>
                <div className="grid grid-cols-2 gap-3">
                  {flavors.map((flavor) => (
                    <button
                      key={flavor.id}
                      onClick={() => setSelectedFlavor(flavor.id)}
                      className={`p-4 rounded-2xl border-2 transition-all hover:scale-105 ${
                        selectedFlavor === flavor.id
                          ? 'border-primary-600 bg-primary-50 shadow-lg'
                          : 'border-gray-200 bg-white hover:border-primary-300'
                      }`}
                    >
                      <div className="text-3xl mb-2">{flavor.emoji}</div>
                      <p className="text-sm font-bold text-gray-900 leading-tight">
                        {flavor.name}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleConfirm}
                disabled={!selectedFlavor || confirming}
                className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all ${
                  selectedFlavor && !confirming
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:scale-105 shadow-glow'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {confirming ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  `Redeem ${title}`
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="p-8 space-y-6 text-center">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-glow animate-bounce-soft">
              <Check className="w-12 h-12 text-white" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-gray-900">Success!</h3>
              <p className="text-gray-600">
                Your {title.toLowerCase()} is ready to claim
              </p>
            </div>

            <div className="glass p-6 rounded-2xl space-y-4">
              <QRCodeDisplay
                value={qrCode}
                size={200}
                level="H"
                showValue={true}
                allowEnlarge={true}
                className="mx-auto"
              />
              <div className="glass p-3 rounded-xl bg-amber-50">
                <p className="text-xs text-gray-700 font-medium text-center">
                  Show this QR code at the counter to claim your reward within 30 days
                </p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-full py-3 gradient-primary text-white rounded-2xl font-bold hover:scale-105 transition-transform"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RedemptionModal;
