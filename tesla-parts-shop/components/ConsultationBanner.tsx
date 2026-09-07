import React, { useState, useEffect, useRef } from 'react';
import { Phone, Send, X, MessageSquare } from 'lucide-react';
import ViberIcon from './ViberIcon';

interface ConsultationBannerProps {
  phoneNumber?: string;
  telegram?: string;
  viber?: string;
  displayDurationMs?: number;
}

export const ConsultationBanner: React.FC<ConsultationBannerProps> = ({
  phoneNumber,
  telegram,
  viber,
  displayDurationMs = 8000,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progressWidth, setProgressWidth] = useState(100);

  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if dismissed in this session
    const dismissed = sessionStorage.getItem('tesla_consult_closed');
    if (dismissed === 'true') return;

    // Show after 4.5 seconds
    const showTimer = setTimeout(() => {
      setIsVisible(true);
      // Trigger smooth progress shrink
      requestAnimationFrame(() => {
        setProgressWidth(0);
      });
    }, 4500);

    return () => clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (!isVisible || isPaused) return;

    dismissTimerRef.current = setTimeout(() => {
      handleDismiss();
    }, displayDurationMs);

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [isVisible, isPaused, displayDurationMs]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      sessionStorage.setItem('tesla_consult_closed', 'true');
      setIsVisible(false);
    }, 350);
  };

  if (!isVisible) return null;

  const cleanPhone = phoneNumber ? phoneNumber.replace(/\s+/g, '') : '';

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`fixed bottom-22 left-4 right-4 sm:right-auto sm:left-6 sm:max-w-md z-40 transition-all duration-350 ease-out ${
        isExiting
          ? 'opacity-0 translate-y-6 scale-95 pointer-events-none'
          : 'opacity-100 translate-y-0 scale-100 animate-in fade-in slide-in-from-bottom-5'
      }`}
    >
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100/90 p-4 relative overflow-hidden">
        {/* Top bar accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-tesla-red via-red-500 to-rose-400" />

        {/* Live Notification Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Підбір деталей • щойно
            </span>
          </div>

          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-700 p-1 -mr-1 rounded-full hover:bg-gray-100 transition"
            aria-label="Закрити"
          >
            <X size={15} />
          </button>
        </div>

        {/* Header Content */}
        <div className="flex items-start gap-3 mb-3">
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

        {/* Auto-dismiss progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-tesla-red to-red-400 transition-all ease-linear"
            style={{
              width: `${progressWidth}%`,
              transitionDuration: isPaused ? '0s' : `${displayDurationMs}ms`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ConsultationBanner;
