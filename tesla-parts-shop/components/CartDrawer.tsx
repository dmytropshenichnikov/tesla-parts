import React, { useState, useEffect } from 'react';
import { CartItem, Currency } from '../types';
import { X, ArrowLeft, Trash2, Plus, Minus } from 'lucide-react';
import { DEFAULT_EXCHANGE_RATE_UAH_PER_USD } from '../constants';
import { formatCurrency } from '../utils/currency';
import { getProductPartType } from '../utils/partType';
import { PartTypeBadge } from './PartTypeBadge';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  currency: Currency;
  uahPerUsd: number;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onCheckout: () => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  currency,
  uahPerUsd,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}) => {
  const effectiveRate =
    uahPerUsd > 0 ? uahPerUsd : DEFAULT_EXCHANGE_RATE_UAH_PER_USD;

  const getItemUsdPrice = (item: CartItem) => {
    if (item.priceUSD && item.priceUSD > 0) return item.priceUSD;
    if (item.priceUAH && item.priceUAH > 0 && effectiveRate > 0) {
      return item.priceUAH / effectiveRate;
    }
    return 0;
  };

  const formatAmount = (amount: number) => {
    return formatCurrency(amount, currency);
  };

  const formatPrice = (item: CartItem, quantity = 1) => {
    const usdPrice = getItemUsdPrice(item) * quantity;
    const amount =
      currency === Currency.USD ? usdPrice : usdPrice * effectiveRate;
    return formatAmount(amount);
  };

  const totalUSD = items.reduce(
    (sum, item) => sum + getItemUsdPrice(item) * item.quantity,
    0
  );
  const totalDisplay =
    currency === Currency.USD ? totalUSD : totalUSD * effectiveRate;

  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
    } else if (isRendered) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setIsClosing(false);
      }, 260);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isRendered]);

  const handleAnimatedClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 260);
  };

  if (!isRendered && !isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-xs cursor-pointer ${
          isClosing ? 'animate-backdrop-fade-out' : 'animate-backdrop-fade'
        }`}
        onClick={handleAnimatedClose}
      />

      <div className="absolute inset-y-0 right-0 max-w-md w-full flex">
        <div
          className={`flex-1 flex flex-col bg-white shadow-2xl ${
            isClosing ? 'animate-drawer-slide-out' : 'animate-drawer-slide'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-5 border-b border-gray-100">
            <button
              onClick={handleAnimatedClose}
              className="p-1.5 px-3 hover:bg-gray-100 active:scale-95 rounded-full transition-all duration-200 cursor-pointer group flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-tesla-dark"
            >
              <ArrowLeft size={18} className="text-gray-500 group-hover:text-tesla-dark transition-transform duration-200 group-hover:-translate-x-1" />
              <span>Назад</span>
            </button>
            <h2 className="text-base sm:text-lg font-bold text-gray-900">
              Кошик ({items.length})
            </h2>
            <button
              onClick={handleAnimatedClose}
              className="p-1.5 text-gray-400 hover:text-gray-800 rounded-full hover:bg-gray-100 active:scale-85 transition-all duration-200 hover:rotate-90 cursor-pointer"
              aria-label="Закрити кошик"
            >
              <X size={20} />
            </button>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
            {items.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>Ваш кошик порожній</p>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
                        {item.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {item.category && (
                          <span className="text-xs text-gray-500">
                            {item.category}
                          </span>
                        )}
                        {getProductPartType(item) && (
                          <PartTypeBadge type={getProductPartType(item)} variant="subtle" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border rounded-lg overflow-hidden">
                        <button
                          onClick={() => onUpdateQuantity(item.id, -1)}
                          className="p-1.5 hover:bg-gray-100 text-gray-600 disabled:opacity-40 active:scale-90 transition-transform"
                          disabled={item.quantity <= 1}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="px-2 text-sm font-semibold w-8 text-center select-none">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.id, 1)}
                          className="p-1.5 hover:bg-gray-100 text-gray-600 active:scale-90 transition-transform"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="text-sm font-bold">
                        {formatPrice(item, item.quantity)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="text-gray-400 hover:text-red-500 hover:scale-110 active:scale-90 self-start p-1.5 transition-all duration-200 cursor-pointer"
                    title="Видалити"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-6 bg-gray-50/80">
              <div className="flex justify-between items-center mb-4 text-lg font-bold text-gray-900">
                <span>Всього</span>
                <span className="text-xl text-tesla-dark font-extrabold">{formatAmount(totalDisplay)}</span>
              </div>
              <p className="text-xs text-gray-500 mb-4 text-center">
                Вартість доставки розраховується за тарифами перевізника
              </p>
              <button
                onClick={() => {
                  handleAnimatedClose();
                  setTimeout(() => {
                    onCheckout();
                  }, 150);
                }}
                className="w-full bg-tesla-red text-white py-3.5 rounded-xl font-bold hover:bg-red-700 active:scale-[0.98] transition-all duration-200 shadow-md hover:shadow-xl cursor-pointer"
              >
                Оформити замовлення
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CartDrawer;
