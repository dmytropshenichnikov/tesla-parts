import React, { useState } from 'react';
import { MessageCircle, Phone, Send, X } from 'lucide-react';
import ViberIcon from './ViberIcon';

interface FloatingContactButtonProps {
  phoneNumber?: string;
  telegram?: string;
  viber?: string;
}

const FloatingContactButton: React.FC<FloatingContactButtonProps> = ({
  phoneNumber,
  telegram,
  viber,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const cleanPhone = phoneNumber ? phoneNumber.replace(/\s+/g, '') : '';

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end">
      {/* Expanded Quick Contact Menu */}
      {isOpen && (
        <div className="mb-3 flex flex-col gap-2 bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-gray-100 transition-all animate-in fade-in slide-in-from-bottom-3 duration-200">
          {telegram && (
            <a
              href={telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-gray-800 hover:bg-blue-50 hover:text-[#229ED9] transition"
            >
              <div className="w-8 h-8 rounded-full bg-[#229ED9] text-white flex items-center justify-center">
                <Send size={16} />
              </div>
              <span>Telegram</span>
            </a>
          )}

          {viber && (
            <a
              href={`viber://chat?number=${encodeURIComponent(viber)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-gray-800 hover:bg-purple-50 hover:text-[#7360F2] transition"
            >
              <div className="w-8 h-8 rounded-full bg-[#7360F2] text-white flex items-center justify-center">
                <ViberIcon size={16} color="white" />
              </div>
              <span>Viber</span>
            </a>
          )}

          {cleanPhone && (
            <a
              href={`tel:${cleanPhone}`}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-gray-800 hover:bg-emerald-50 hover:text-emerald-600 transition"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                <Phone size={16} />
              </div>
              <span>Зателефонувати</span>
            </a>
          )}
        </div>
      )}

      {/* Main Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 transform active:scale-95 ${
          isOpen
            ? 'bg-gray-900 text-white rotate-90'
            : 'bg-emerald-500 hover:bg-emerald-600 text-white hover:scale-105 shadow-emerald-500/30'
        }`}
        style={{ width: '52px', height: '52px' }}
        aria-label="Швидкий зв'язок"
        title="Швидкий зв'язок"
      >
        {isOpen ? (
          <X size={24} />
        ) : (
          <MessageCircle size={26} className="animate-pulse" />
        )}
      </button>
    </div>
  );
};

export default FloatingContactButton;
