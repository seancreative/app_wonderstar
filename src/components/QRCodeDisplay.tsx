import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  className?: string;
  showValue?: boolean;
  allowEnlarge?: boolean;
  bgColor?: string;
  fgColor?: string;
}

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  size = 200,
  level = 'M',
  className = '',
  showValue = true,
  allowEnlarge = true,
  bgColor = '#ffffff',
  fgColor = '#000000'
}) => {
  const [isEnlarged, setIsEnlarged] = useState(false);

  if (!value) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-xl ${className}`}>
        <p className="text-sm text-gray-500 font-medium">No QR code data</p>
      </div>
    );
  }

  const handleToggleEnlarge = () => {
    if (allowEnlarge) {
      setIsEnlarged(!isEnlarged);
    }
  };

  return (
    <>
      <div className={`relative ${className}`}>
        <div
          className={`bg-white p-4 rounded-xl shadow-sm flex flex-col items-center justify-center ${
            allowEnlarge ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
          }`}
          onClick={handleToggleEnlarge}
        >
          <QRCodeSVG
            value={value}
            size={size}
            level={level}
            bgColor={bgColor}
            fgColor={fgColor}
            includeMargin={false}
          />
          {allowEnlarge && (
            <button
              className="absolute top-2 right-2 p-2 bg-white/90 rounded-lg shadow-md hover:bg-white transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleEnlarge();
              }}
            >
              <Maximize2 className="w-4 h-4 text-gray-700" />
            </button>
          )}
        </div>
        {showValue && (
          <div className="mt-2 text-center">
            <p className="text-xs font-mono text-gray-600 break-all px-2">
              {value}
            </p>
          </div>
        )}
      </div>

      {isEnlarged && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={handleToggleEnlarge}
        >
          <div
            className="relative bg-white p-8 rounded-3xl shadow-2xl animate-scale-in max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              onClick={handleToggleEnlarge}
            >
              <Minimize2 className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex flex-col items-center space-y-4">
              <h3 className="text-xl font-bold text-gray-900">Scan QR Code</h3>
              <div className="bg-white p-6 rounded-2xl">
                <QRCodeSVG
                  value={value}
                  size={300}
                  level="H"
                  bgColor={bgColor}
                  fgColor={fgColor}
                  includeMargin={true}
                />
              </div>
              {showValue && (
                <div className="max-w-full">
                  <p className="text-sm font-mono text-gray-700 break-all text-center px-4">
                    {value}
                  </p>
                </div>
              )}
              <p className="text-sm text-gray-600 text-center max-w-sm">
                Tap outside or press the button to close
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default QRCodeDisplay;
