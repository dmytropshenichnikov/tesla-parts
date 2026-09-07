import React, { useState, useEffect } from 'react';
import { Phone, CircleDollarSign, Menu, MessageCircle, X } from 'lucide-react';

interface FloatingContactButtonProps {
  isOpen?: boolean;
  onClick: () => void;
}

const ROTATING_ICONS = [
  { id: 'menu', label: 'Каталог та меню', Icon: Menu },
  { id: 'phone', label: 'Консультація та дзвінок', Icon: Phone },
  { id: 'currency', label: 'Зміна валюти ₴ / $', Icon: CircleDollarSign },
  { id: 'chat', label: 'Швидкий зв’язок', Icon: MessageCircle },
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
      }, 250);
    }, 3200);

    return () => clearInterval(interval);
  }, [isOpen]);

  const currentItem = ROTATING_ICONS[iconIndex];
  const CurrentIcon = currentItem.Icon;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex items-center pointer-events-auto select-none">
      <div className="relative flex items-center group">
        {/* Sleek Tooltip Pill (Desktop) */}
        {!isOpen && (
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-950/85 hover:bg-neutral-900 text-white text-xs font-medium border border-neutral-700/60 shadow-xl backdrop-blur-md mr-3 transition-all duration-300 opacity-90 group-hover:opacity-100 group-hover:scale-105 pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-tesla-red animate-pulse" />
            <span
              key={currentItem.id}
              className="animate-in fade-in slide-in-from-right-1 duration-200 whitespace-nowrap tracking-wide"
            >
              {currentItem.label}
            </span>
          </div>
        )}

        {/* Ambient Breathing Radial Aura */}
        {!isOpen && (
          <div className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-tesla-red/30 via-neutral-600/20 to-tesla-red/20 blur-md animate-aura pointer-events-none" />
        )}

        {/* Main Floating Action Button */}
        <button
          onClick={onClick}
          className={`relative rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ease-out transform active:scale-90 cursor-pointer ${
            isOpen
              ? 'w-14 h-14 bg-neutral-950 text-white rotate-90 border border-tesla-red/60 shadow-tesla-red/20'
              : 'w-14 h-14 bg-gradient-to-b from-neutral-800 via-neutral-900 to-neutral-950 hover:from-neutral-750 hover:to-neutral-900 text-white border border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.45)] hover:shadow-[0_12px_35px_rgba(232,33,39,0.35)] hover:scale-105'
          }`}
          style={{ width: '56px', height: '56px' }}
          aria-label="Відкрити меню сайту"
          title="Меню, валюта, зв'язок"
        >
          {isOpen ? (
            <X size={22} className="text-white transition-transform duration-200" />
          ) : (
            <div
              className={`transition-all duration-250 ease-out flex items-center justify-center ${
                isFlipping
                  ? '-translate-y-2 opacity-0 scale-90'
                  : 'translate-y-0 opacity-100 scale-100'
              }`}
            >
              <CurrentIcon size={22} className="text-white drop-shadow-xs" />
            </div>
          )}

          {/* Active Online Status Badge */}
          {!isOpen && (
            <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-neutral-900 shadow-xs animate-pulse" />
          )}
        </button>
      </div>
    </div>
  );
};

export default FloatingContactButton;
