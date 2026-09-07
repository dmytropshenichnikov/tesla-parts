import React, { useState, useEffect } from 'react';
import { Phone, CircleDollarSign, Menu, MessageCircle, X } from 'lucide-react';

interface FloatingContactButtonProps {
  isOpen?: boolean;
  onClick: () => void;
}

const ROTATING_ICONS = [
  { id: 'phone', label: 'Телефон', Icon: Phone },
  { id: 'currency', label: 'Валюта', Icon: CircleDollarSign },
  { id: 'menu', label: 'Меню', Icon: Menu },
  { id: 'chat', label: 'Чат', Icon: MessageCircle },
];

export const FloatingContactButton: React.FC<FloatingContactButtonProps> = ({
  isOpen = false,
  onClick,
}) => {
  const [iconIndex, setIconIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    if (isOpen) return;

    const interval = setInterval(() => {
      setIsFlipping(true);
      setTimeout(() => {
        setIconIndex((prev) => (prev + 1) % ROTATING_ICONS.length);
        setIsFlipping(false);
      }, 300);
    }, 2400);

    return () => clearInterval(interval);
  }, [isOpen]);

  const CurrentIcon = ROTATING_ICONS[iconIndex].Icon;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end pointer-events-auto">
      <div className="relative group">
        {/* Soft Radar Pulse Ring */}
        {!isOpen && (
          <div className="absolute -inset-1.5 rounded-full bg-emerald-500/35 animate-ping opacity-75 pointer-events-none" />
        )}

        {/* Orbiting Rotating Dashed Border */}
        {!isOpen && (
          <div
            className="absolute -inset-1 rounded-full border-2 border-dashed border-emerald-400/60 pointer-events-none"
            style={{ animation: 'spin 8s linear infinite' }}
          />
        )}

        {/* Main Floating Trigger Button */}
        <button
          onClick={onClick}
          className={`relative rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform active:scale-90 ${
            isOpen
              ? 'w-13 h-13 bg-gray-950 text-white rotate-90 shadow-gray-900/50'
              : 'w-14 h-14 bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-500/40 hover:scale-105'
          }`}
          style={{ width: '54px', height: '54px' }}
          aria-label="Відкрити меню сайту"
          title="Меню, валюта, зв'язок"
        >
          {isOpen ? (
            <X size={24} />
          ) : (
            <div
              className={`transition-all duration-300 transform flex items-center justify-center ${
                isFlipping
                  ? 'rotate-180 scale-50 opacity-0'
                  : 'rotate-0 scale-100 opacity-100'
              }`}
            >
              <CurrentIcon size={24} className="text-white drop-shadow-xs" />
            </div>
          )}

          {/* Active Red Dot Badge */}
          {!isOpen && (
            <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-tesla-red rounded-full border-2 border-white shadow-xs animate-pulse" />
          )}
        </button>
      </div>
    </div>
  );
};

export default FloatingContactButton;
