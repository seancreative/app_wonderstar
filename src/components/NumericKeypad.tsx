import React from 'react';
import { Delete } from 'lucide-react';

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

const NumericKeypad: React.FC<NumericKeypadProps> = ({
  value,
  onChange,
  maxLength = 4
}) => {
  const handleNumberClick = (num: string) => {
    if (value.length < maxLength) {
      onChange(value + num);
    }
  };

  const handleDelete = () => {
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    onChange('');
  };

  const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-center gap-3 mb-2">
          {Array.from({ length: maxLength }).map((_, index) => (
            <div
              key={index}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black transition-all ${
                index < value.length
                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-glow'
                  : 'bg-gray-100 text-gray-300'
              }`}
            >
              {index < value.length ? '•' : ''}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-600 font-medium">
          Enter {maxLength}-digit passcode
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {numbers.map((num) => (
          <button
            key={num}
            onClick={() => handleNumberClick(num)}
            className="aspect-square bg-white hover:bg-gray-50 active:scale-95 rounded-2xl flex items-center justify-center text-2xl font-black text-gray-900 shadow-md transition-all border-2 border-gray-200 hover:border-primary-300"
          >
            {num}
          </button>
        ))}

        <button
          onClick={handleClear}
          className="aspect-square bg-gray-100 hover:bg-gray-200 active:scale-95 rounded-2xl flex items-center justify-center text-sm font-bold text-gray-700 shadow-md transition-all border-2 border-gray-300"
        >
          Clear
        </button>

        <button
          onClick={() => handleNumberClick('0')}
          className="aspect-square bg-white hover:bg-gray-50 active:scale-95 rounded-2xl flex items-center justify-center text-2xl font-black text-gray-900 shadow-md transition-all border-2 border-gray-200 hover:border-primary-300"
        >
          0
        </button>

        <button
          onClick={handleDelete}
          className="aspect-square bg-red-100 hover:bg-red-200 active:scale-95 rounded-2xl flex items-center justify-center shadow-md transition-all border-2 border-red-300"
        >
          <Delete className="w-6 h-6 text-red-700" />
        </button>
      </div>
    </div>
  );
};

export default NumericKeypad;
