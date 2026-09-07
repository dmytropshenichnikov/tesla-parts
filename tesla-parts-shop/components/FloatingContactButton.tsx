import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Send, X, User, ChevronRight, Menu } from 'lucide-react';
import ViberIcon from './ViberIcon';
import { Currency } from '../types';
import { useAuth } from '../context/AppContext';

interface FloatingContactButtonProps {
  phoneNumber?: string;
  telegram?: string;
  viber?: string;
  currency: Currency;
  onSelectCurrency: (c: Currency) => void;
}

const FloatingContactButton: React.FC<FloatingContactButtonProps> = ({
  phoneNumber,
  telegram,
  viber,
  currency,
  onSelectCurrency,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { isCustomerLoggedIn, customerProfile } = useAuth();

  const cleanPhone = phoneNumber ? phoneNumber.replace(/\s+/g, '') : '';

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Backdrop for closing */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-40 transition-opacity animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end pointer-events-auto">
        {/* Expanded Quick Menu Popover */}
        {isOpen && (
          <div className="mb-3 w-[290px] sm:w-[320px] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 slide-in-from-bottom-3 duration-200">
            {/* Header */}
            <div className="p-3.5 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-bold text-xs tracking-wide uppercase">
                  Швидке меню та зв'язок
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-white rounded-lg transition"
                aria-label="Закрити"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 space-y-3.5 max-h-[75vh] overflow-y-auto">
              {/* Currency Selector Section */}
              <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Валюта цін
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {currency === Currency.UAH ? 'Гривня' : 'USD'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-white rounded-lg border border-gray-200/70">
                  <button
                    onClick={() => {
                      onSelectCurrency(Currency.UAH);
                      localStorage.setItem('tesla_currency_choice', Currency.UAH);
                    }}
                    className={`py-1.5 px-3 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      currency === Currency.UAH
                        ? 'bg-tesla-red text-white shadow-xs'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>₴</span>
                    <span>UAH</span>
                  </button>
                  <button
                    onClick={() => {
                      onSelectCurrency(Currency.USD);
                      localStorage.setItem('tesla_currency_choice', Currency.USD);
                    }}
                    className={`py-1.5 px-3 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      currency === Currency.USD
                        ? 'bg-tesla-red text-white shadow-xs'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>$</span>
                    <span>USD</span>
                  </button>
                </div>
              </div>

              {/* Account / Profile Quick Link */}
              <Link
                to="/profile"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-red-50/40 hover:border-red-100 transition group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center group-hover:bg-tesla-red transition-colors">
                    <User size={16} />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-gray-900">
                      {isCustomerLoggedIn
                        ? (customerProfile?.name || 'Особистий кабінет')
                        : 'Особистий кабінет'}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {isCustomerLoggedIn
                        ? 'Мої замовлення та дані'
                        : 'Увійти або зареєструватися'}
                    </div>
                  </div>
                </div>
                <ChevronRight
                  size={16}
                  className="text-gray-400 group-hover:text-tesla-red transition"
                />
              </Link>

              {/* Reviews Quick Link */}
              <Link
                to="/reviews"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-amber-50/40 hover:border-amber-200 transition group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center text-sm font-bold">
                    ⭐
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-gray-900">
                      Відгуки покупців
                    </div>
                    <div className="text-[10px] text-gray-500">
                      Реальний досвід клієнтів
                    </div>
                  </div>
                </div>
                <ChevronRight
                  size={16}
                  className="text-gray-400 group-hover:text-amber-600 transition"
                />
              </Link>

              {/* Direct Support & Messengers */}
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                  Зв'язатися з нами
                </div>

                {cleanPhone && (
                  <a
                    href={`tel:${cleanPhone}`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs mb-2 group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Phone size={15} />
                      </div>
                      <div className="text-left">
                        <div className="text-[10px] text-emerald-100 uppercase font-semibold">
                          Дзвінок менеджеру
                        </div>
                        <div className="text-xs font-bold font-mono tracking-tight">
                          {phoneNumber}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                      Виклик
                    </span>
                  </a>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {telegram && (
                    <a
                      href={telegram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#229ED9]/10 hover:bg-[#229ED9]/20 text-[#0088cc] border border-[#229ED9]/20 text-xs font-semibold transition"
                    >
                      <Send size={14} />
                      <span>Telegram</span>
                    </a>
                  )}

                  {viber && (
                    <a
                      href={`viber://chat?number=${encodeURIComponent(viber)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#7360F2]/10 hover:bg-[#7360F2]/20 text-[#6250e0] border border-[#7360F2]/20 text-xs font-semibold transition"
                    >
                      <ViberIcon size={14} color="#6250e0" />
                      <span>Viber</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Floating Trigger Button with Ripple & Animation */}
        <div className="relative group">
          {/* Animated Glow / Radar Pulse Ring */}
          {!isOpen && (
            <div className="absolute -inset-1 rounded-full bg-emerald-500/40 animate-ping opacity-60 pointer-events-none" />
          )}

          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`relative rounded-full flex items-center justify-center shadow-xl transition-all duration-300 transform active:scale-90 ${
              isOpen
                ? 'w-12 h-12 bg-gray-900 text-white rotate-90 shadow-gray-900/40'
                : 'w-13 h-13 bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-500/40 hover:scale-105'
            }`}
            style={{ width: isOpen ? '48px' : '54px', height: isOpen ? '48px' : '54px' }}
            aria-label="Швидке меню та зв'язок"
            title="Швидке меню та зв'язок"
          >
            {isOpen ? (
              <X size={22} />
            ) : (
              <div className="flex items-center justify-center">
                <Menu size={24} className="group-hover:rotate-12 transition-transform duration-200" />
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-tesla-red rounded-full border-2 border-white shadow-xs" />
              </div>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default FloatingContactButton;
