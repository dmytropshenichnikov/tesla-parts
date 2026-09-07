import React, { useState, useEffect } from 'react';
import { Phone, Send, X, MessageSquare } from 'lucide-react';
import ViberIcon from './ViberIcon';

interface ConsultationBannerProps {
  phoneNumber?: string;
  telegram?: string;
  viber?: string;
}

export const ConsultationBanner: React.FC<ConsultationBannerProps> = ({
  phoneNumber,
  telegram,
  viber,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if dismissed in this session
    const dismissed = sessionStorage.getItem('tesla_consult_closed');
    if (dismissed === 'true') return;

    // Show after 6 seconds
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 6000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem('tesla_consult_closed', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const cleanPhone = phoneNumber ? phoneNumber.replace(/\s+/g, '') : '';

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:right-auto sm:left-6 sm:max-w-md z-40 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 relative overflow-hidden backdrop-blur-md">
        {/* Top bar accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-tesla-red via-red-500 to-tesla-dark" />

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition"
          aria-label="Закрити"
        >
          <X size={16} />
        </button>

        {/* Header Content */}
        <div className="flex items-start gap-3 pr-6 mb-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 text-tesla-red flex items-center justify-center flex-shrink-0">
            <MessageSquare size={18} />
          </div>
          <div>
            <h4 className="font-bold text-sm text-gray-900 leading-tight">
              Потрібна допомога з вибором деталі?
            </h4>
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">
              Швидко підберемо запчастину за VIN-кодом або фото
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {telegram && (
            <a
              href={telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-[#229ED9] hover:bg-[#1e8cc1] text-white text-xs font-semibold shadow-xs transition"
            >
              <Send size={13} />
              <span>Telegram</span>
            </a>
          )}

          {viber && (
            <a
              href={`viber://chat?number=${encodeURIComponent(viber)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-[#7360F2] hover:bg-[#6250e0] text-white text-xs font-semibold shadow-xs transition"
            >
              <ViberIcon size={13} color="white" />
              <span>Viber</span>
            </a>
          )}

          {cleanPhone && (
            <a
              href={`tel:${cleanPhone}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
            >
              <Phone size={13} />
              <span>Дзвінок</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConsultationBanner;
