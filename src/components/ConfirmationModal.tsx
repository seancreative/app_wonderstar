import React from 'react';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'success' | 'info';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          icon: <AlertCircle className="w-16 h-16 text-red-500" />,
          gradient: 'from-red-500 to-red-600',
          buttonBg: 'bg-red-500 hover:bg-red-600',
        };
      case 'success':
        return {
          icon: <CheckCircle className="w-16 h-16 text-green-500" />,
          gradient: 'from-green-500 to-green-600',
          buttonBg: 'bg-green-500 hover:bg-green-600',
        };
      case 'info':
        return {
          icon: <AlertCircle className="w-16 h-16 text-blue-500" />,
          gradient: 'from-blue-500 to-blue-600',
          buttonBg: 'bg-blue-500 hover:bg-blue-600',
        };
      default:
        return {
          icon: <AlertCircle className="w-16 h-16 text-yellow-500" />,
          gradient: 'from-yellow-500 to-yellow-600',
          buttonBg: 'bg-yellow-500 hover:bg-yellow-600',
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm glass rounded-3xl shadow-2xl animate-scale-in overflow-hidden">
        <div className={`h-2 bg-gradient-to-r ${styles.gradient}`} />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-xl transition-colors"
        >
          <X className="w-5 h-5 text-gray-700" />
        </button>

        <div className="p-6 space-y-4">
          <div className="flex justify-center">
            {styles.icon}
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            <p className="text-gray-600 leading-relaxed">{message}</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-all active:scale-95"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={`flex-1 py-3 px-4 ${styles.buttonBg} text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
