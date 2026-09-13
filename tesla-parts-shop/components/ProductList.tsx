import React, { useState } from 'react';
import { Product, Currency } from '../types';
import { ShoppingBag, AlertCircle, Copy, Check } from 'lucide-react';
import { DEFAULT_EXCHANGE_RATE_UAH_PER_USD } from '../constants';
import { formatCurrency } from '../utils/currency';
import { useAuth } from '../context/AppContext';
import { Link, useNavigate } from 'react-router-dom';
import { getProductPartType } from '../utils/partType';
import { PartTypeBadge } from './PartTypeBadge';

interface ProductListProps {
  products: Product[];
  currency: Currency;
  uahPerUsd: number;
  onAddToCart: (product: Product) => void;
  title?: string;
}

const ProductList: React.FC<ProductListProps> = ({
  products,
  currency,
  uahPerUsd,
  onAddToCart,
  title,
}) => {
  const navigate = useNavigate();
  const { customerProfile } = useAuth();
  const effectiveRate =
    uahPerUsd > 0 ? uahPerUsd : DEFAULT_EXCHANGE_RATE_UAH_PER_USD;

  const getUsdPrice = (product: Product) => {
    if (product.priceUSD && product.priceUSD > 0) return product.priceUSD;
    if (product.priceUAH && product.priceUAH > 0 && effectiveRate > 0) {
      return product.priceUAH / effectiveRate;
    }
    return 0;
  };

  const getDiscountedPriceInfo = (product: Product) => {
    const usd = getUsdPrice(product);
    const originalAmount = currency === Currency.USD ? usd : usd * effectiveRate;
    let finalAmount = originalAmount;

    const discountType = customerProfile?.discount_type;
    const discountValue = customerProfile?.discount_value;

    if (discountType && discountValue) {
      if (discountType === 'percent') {
        finalAmount = originalAmount * (1 - discountValue / 100);
      } else if (discountType === 'usd') {
        const discountInCurrent = currency === Currency.UAH ? discountValue * effectiveRate : discountValue;
        finalAmount = Math.max(0, originalAmount - discountInCurrent);
      } else if (discountType === 'uah') {
        const discountInCurrent = currency === Currency.USD ? discountValue / effectiveRate : discountValue;
        finalAmount = Math.max(0, originalAmount - discountInCurrent);
      }
    }
    return { original: originalAmount, final: finalAmount };
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'part' | null>(null);

  const handleCardClick = (e: React.MouseEvent, productId: string) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea')) {
      return;
    }
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      return;
    }
    navigate(`/product/${productId}`);
  };

  const handleCopyPartNumber = (
    e: React.MouseEvent,
    partNum: string,
    productId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(partNum);
    setCopiedId(productId);
    setCopiedType('part');
    setTimeout(() => {
      setCopiedId(null);
      setCopiedType(null);
    }, 1800);
  };

  if (products.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-lg shadow-sm">
        <div className="text-gray-400 mb-4 flex justify-center">
          <AlertCircle size={48} />
        </div>
        <h3 className="text-xl font-medium text-gray-900">
          Товарів не знайдено
        </h3>
        <p className="text-gray-500 mt-2">
          Спробуйте змінити параметри пошуку або обрати іншу категорію.
        </p>
      </div>
    );
  }

  return (
    <div className="py-8">
      {title && (
        <h2 className="text-2xl font-bold mb-6 text-tesla-dark border-l-4 border-tesla-red pl-4">
          {title}
        </h2>
      )}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 sm:gap-6">
        {products.map((product, index) => {
          const { original, final } = getDiscountedPriceInfo(product);
          const partType = getProductPartType(product);

          // Clean title: remove part number prefix if it is already displayed
          let cleanName = product.name;
          if (product.detail_number && cleanName.toLowerCase().startsWith(product.detail_number.toLowerCase())) {
            cleanName = cleanName.substring(product.detail_number.length).replace(/^[\s\-–—:]+/, '');
          }

          // Parse categories / car models into badges
          const models = product.category
            ? product.category
                .split(',')
                .map((m) => m.trim())
                .filter(Boolean)
            : [];

          // Cross numbers preview
          const crossNumbers = product.cross_number
            ? product.cross_number
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean)
            : [];

          return (
            <div
              key={product.id}
              onClick={(e) => handleCardClick(e, product.id)}
              className="bg-white rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 ease-out border border-gray-100 flex flex-col cursor-pointer group overflow-hidden select-text"
              style={{
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* Product Photo & Stock Badge */}
              <Link
                to={`/product/${product.id}`}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                className="relative w-full aspect-square bg-[#fbfbfb] p-3 flex items-center justify-center overflow-hidden border-b border-gray-50 cursor-pointer block"
              >
                <img
                  src={product.image}
                  alt={product.name}
                  loading="lazy"
                  draggable={false}
                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                />
                
                {/* Badges on photo: Stock status & Part type together in one corner */}
                <div className="absolute top-2 left-2 right-2 z-10 pointer-events-none flex flex-wrap items-center gap-1">
                  {product.inStock ? (
                    <span className="inline-flex items-center gap-1 bg-emerald-600/90 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                      В наявності
                    </span>
                  ) : (
                    <span className="inline-flex items-center bg-gray-700/90 backdrop-blur-xs text-gray-200 text-[10px] font-medium px-2 py-0.5 rounded-full shadow-xs">
                      Під замовлення
                    </span>
                  )}

                  {partType && (
                    <PartTypeBadge type={partType} variant="floating" size="sm" />
                  )}
                </div>
              </Link>

              {/* Product Information */}
              <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between select-text cursor-default">
                <div>
                  {/* Car Models Tags */}
                  {models.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2 select-text">
                      {models.map((model, idx) => (
                        <span
                          key={idx}
                          className="bg-gray-100 text-gray-700 text-[10px] font-semibold px-1.5 py-0.5 rounded select-text"
                        >
                          {model}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Full Product Title (Selectable & clickable) */}
                  <h3 className="font-medium text-xs sm:text-sm text-gray-900 leading-snug group-hover:text-tesla-red transition-colors mb-2 select-text">
                    <Link
                      to={`/product/${product.id}`}
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      className="hover:text-tesla-red select-text"
                    >
                      {cleanName}
                    </Link>
                  </h3>

                  {/* Part Numbers & Cross Block */}
                  {(product.detail_number || crossNumbers.length > 0) && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-1 text-[11px] select-text">
                      {product.detail_number && (
                        <div
                          className="font-mono text-[10px] sm:text-[11px] font-semibold text-gray-800 bg-gray-100 border border-gray-200/80 px-1.5 py-0.5 rounded flex-shrink-0 flex items-center gap-1 select-text"
                          title="Номер деталі OEM"
                        >
                          <span className="select-text">#{product.detail_number}</span>
                          <button
                            type="button"
                            onClick={(e) =>
                              handleCopyPartNumber(
                                e,
                                product.detail_number!,
                                product.id
                              )
                            }
                            className="text-gray-400 hover:text-gray-700 p-0.5 rounded transition cursor-pointer"
                            title="Скопіювати артикул"
                          >
                            {copiedId === product.id && copiedType === 'part' ? (
                              <Check size={11} className="text-emerald-600 stroke-[2.5]" />
                            ) : (
                              <Copy size={10} />
                            )}
                          </button>
                        </div>
                      )}
                      {crossNumbers.length > 0 && (
                        <span
                          className="text-[10px] sm:text-[11px] font-mono text-gray-500 truncate select-text"
                          title={`Аналоги: ${crossNumbers.join(', ')}`}
                        >
                          Cross: {crossNumbers[0]}{crossNumbers.length > 1 ? ` (+${crossNumbers.length - 1})` : ''}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Price & Action Buttons */}
                <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2 select-text">
                  <div className="flex flex-col min-w-0 select-text">
                    {original > final && (
                      <span className="text-[11px] line-through text-gray-400 font-normal select-text">
                        {formatCurrency(original, currency)}
                      </span>
                    )}
                    <span className="text-base sm:text-lg font-bold text-tesla-dark tracking-tight whitespace-nowrap select-text">
                      {formatCurrency(final, currency)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onAddToCart(product);
                      }}
                      disabled={!product.inStock}
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all shadow-xs cursor-pointer ${
                        product.inStock
                          ? 'bg-tesla-red text-white hover:bg-red-700 active:scale-95 shadow-red-600/20'
                          : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      }`}
                      aria-label="Додати в кошик"
                      title={product.inStock ? "Додати в кошик" : "Немає в наявності"}
                    >
                      <ShoppingBag size={17} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProductList;
