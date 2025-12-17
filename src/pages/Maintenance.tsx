import React, { useEffect, useState } from 'react';
import { Settings, Wrench, Sparkles } from 'lucide-react';

const Maintenance: React.FC = () => {
  const [animationStep, setAnimationStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationStep((prev) => (prev + 1) % 3);
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center">
        <div className="relative mb-12 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <Settings
                className="w-32 h-32 text-blue-200 animate-spin"
                style={{ animationDuration: '8s' }}
              />
            </div>

            <div className="relative z-10 w-40 h-40 rounded-full bg-white shadow-2xl flex items-center justify-center border-4 border-blue-100">
              <div className="relative">
                <Wrench className="w-20 h-20 text-blue-600" />

                <Sparkles
                  className={`absolute -top-2 -right-2 w-6 h-6 text-yellow-500 transition-opacity duration-500 ${
                    animationStep === 0 ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <Sparkles
                  className={`absolute -bottom-2 -left-2 w-6 h-6 text-blue-500 transition-opacity duration-500 ${
                    animationStep === 1 ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <Sparkles
                  className={`absolute top-0 -left-3 w-5 h-5 text-green-500 transition-opacity duration-500 ${
                    animationStep === 2 ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
            We're Upgrading!
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 font-medium mb-6">
            We are upgrading the system to serve you better
          </p>
          <p className="text-lg text-gray-500">
            Our team is working hard to bring you an enhanced experience.
            <br className="hidden md:block" />
            We'll be back shortly!
          </p>
        </div>

        <div className="mb-12">
          <div className="flex justify-center gap-2 mb-4">
            {[0, 1, 2].map((step) => (
              <div
                key={step}
                className={`h-2 rounded-full transition-all duration-500 ${
                  step === animationStep
                    ? 'w-12 bg-blue-600'
                    : 'w-2 bg-blue-200'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-500 font-medium">
            System maintenance in progress...
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            What's happening?
          </h2>
          <ul className="space-y-3 text-left">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0" />
              <p className="text-gray-600">
                <span className="font-semibold text-gray-900">Performance improvements</span> - Faster loading times and smoother navigation
              </p>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0" />
              <p className="text-gray-600">
                <span className="font-semibold text-gray-900">New features</span> - Exciting updates to enhance your experience
              </p>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0" />
              <p className="text-gray-600">
                <span className="font-semibold text-gray-900">Security updates</span> - Keeping your data safe and secure
              </p>
            </li>
          </ul>
        </div>

        <div className="mt-12">
          <p className="text-sm text-gray-500">
            Thank you for your patience and understanding
          </p>
          <p className="text-xs text-gray-400 mt-4">
            © {new Date().getFullYear()} WonderStars. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Maintenance;
