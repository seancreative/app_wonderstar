import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { aiGeniusTranslations } from '../translations/aiGenius';
import { Tag, Copy, Check } from 'lucide-react';

const SpecialVoucher: React.FC = () => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const copyVoucherCode = () => {
    navigator.clipboard.writeText(aiGeniusTranslations.specialVoucher.voucherCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 md:p-8 shadow-2xl border border-yellow-400/30">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Tag className="w-6 h-6 text-red-600" />
            <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 text-center">
              {t(aiGeniusTranslations.specialVoucher.title)}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-700/50 rounded-xl p-6 text-center relative overflow-hidden border border-gray-600">
              <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                {t(aiGeniusTranslations.specialVoucher.discount)}
              </div>
              <p className="text-sm text-gray-400 mb-2">
                {t(aiGeniusTranslations.specialVoucher.normalPrice)}
              </p>
              <p className="text-4xl font-black text-gray-500 line-through">
                RM40
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-center text-white shadow-lg transform scale-105">
              <p className="text-sm mb-2 font-semibold">
                {t(aiGeniusTranslations.specialVoucher.discountedPrice).split(' ')[0]}
              </p>
              <p className="text-5xl font-black mb-1">
                RM20
              </p>
              <p className="text-sm font-bold">
                {t(aiGeniusTranslations.specialVoucher.discountedPrice).split(' ').slice(1).join(' ')}
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl p-4 mb-4 border border-yellow-400/30">
            <p className="text-sm text-gray-300 mb-2 text-center font-semibold">
              Use Voucher Code:
            </p>
            <div className="flex items-center justify-center gap-2">
              <div className="bg-gray-900 px-6 py-3 rounded-lg border-2 border-yellow-400 border-dashed">
                <code className="text-2xl font-black text-yellow-400 tracking-wider">
                  {aiGeniusTranslations.specialVoucher.voucherCode}
                </code>
              </div>
              <button
                onClick={copyVoucherCode}
                className="bg-yellow-600 hover:bg-yellow-700 text-gray-900 p-3 rounded-lg transition-colors font-bold"
                title="Copy code"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <p className="text-base text-gray-300 text-center mb-4">
            {t(aiGeniusTranslations.specialVoucher.description)}
          </p>

          <div className="bg-yellow-500/10 border-l-4 border-yellow-400 p-4 rounded backdrop-blur-sm">
            <p className="text-sm text-yellow-200 italic text-center">
              "{t(aiGeniusTranslations.specialVoucher.testimonial)}"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpecialVoucher;
