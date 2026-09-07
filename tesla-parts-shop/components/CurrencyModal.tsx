import React, { useState, useEffect } from 'react';
import { Currency } from '../types';
import teslaLogo from '../static/tesla-logo.png';
import { X } from 'lucide-react';

interface CurrencyModalProps {
  currentCurrency: Currency;
  onSelectCurrency: (currency: Currency) => void;
}

export const CurrencyModal: React.FC<CurrencyModalProps> = ({
  onSelectCurrency,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if user has already chosen currency
    const storedChoice = localStorage.getItem('tesla_currency_choice');
    if (!storedChoice) {
      // Small delay for smooth entry
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleChoose = (cur: Currency) => {
    localStorage.setItem('tesla_currency_choice', cur);
    onSelectCurrency(cur);
    setIsOpen(false);
  };

  const handleClose = () => {
    localStorage.setItem('tesla_currency_choice', Currency.UAH);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-sm w-full p-6 relative overflow-hidden text-center animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition"
          aria-label="Закрити"
        >
          <X size={20} />
        </button>

        {/* Logo */}
        <div className="flex justify-center mb-3">
          <img src={teslaLogo} alt="Tesla" className="h-10 w-auto object-contain" />
        </div>

        {/* Heading */}
        <h3 className="text-xl font-bold text-gray-950 mb-1">
          Оберіть валюту
        </h3>
        <p className="text-xs text-gray-500 mb-6">
          У якій валюті вам зручніше переглядати ціни на запчастини?
        </p>

        {/* Currency Options */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleChoose(Currency.UAH)}
            className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-gray-200 hover:border-tesla-red hover:bg-red-50/40 transition group active:scale-95"
          >
            <span className="text-2xl font-black text-gray-900 group-hover:text-tesla-red transition-colors mb-1">
              ₴ UAH
            </span>
            <span className="text-xs font-semibold text-gray-600">
              Гривня
            </span>
          </button>

          <button
            onClick={() => handleChoose(Currency.USD)}
            className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-gray-200 hover:border-tesla-red hover:bg-red-50/40 transition group active:scale-95"
          >
            <span className="text-2xl font-black text-gray-900 group-hover:text-tesla-red transition-colors mb-1">
              $ USD
            </span>
            <span className="text-xs font-semibold text-gray-600">
              Долар США
            </span>
          </button>
        </div>

        <div className="mt-4 text-[11px] text-gray-400">
          Ви зможете змінити валюту в будь-який момент у меню сайту
        </div>
      </div>
    </div>
  );
};

export default CurrencyModal;
