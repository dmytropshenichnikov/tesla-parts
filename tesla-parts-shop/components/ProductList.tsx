import React, { useState } from 'react';
import { Product, Currency } from '../types';
import { ShoppingBag, AlertCircle, Copy, Check } from 'lucide-react';
import { DEFAULT_EXCHANGE_RATE_UAH_PER_USD } from '../constants';
import { formatCurrency } from '../utils/currency';
import { useAuth } from '../context/AppContext';
import { Link } from 'react-router-dom';
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
  const [copiedType, setCopiedType] = useState<'part' | 'full' | null>(null);

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

  const handleCopyProductInfo = (
    e: React.MouseEvent,
    product: Product,
    cleanName: string,
    finalPrice: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const formattedPrice = formatCurrency(finalPrice, currency);
    const partInfo = product.detail_number ? ` (#${product.detail_number})` : '';
    const url = `${window.location.origin}/product/${product.id}`;
    const text = `${cleanName}${partInfo} — ${formattedPrice}\n${url}`;
    navigator.clipboard.writeText(text);
    setCopiedId(product.id);
    setCopiedType('full');
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
            <Link
              key={product.id}
              to={`/product/${product.id}`}
              onClick={(e) => {
                const selection = window.getSelection();
                if (selection && selection.toString().trim().length > 0) {
                  e.preventDefault();
                }
              }}
              className="bg-white rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 ease-out border border-gray-100 flex flex-col cursor-pointer group overflow-hidden"
              style={{
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* Product Photo & Stock Badge */}
              <div className="relative w-full aspect-square bg-[#fbfbfb] p-3 flex items-center justify-center overflow-hidden border-b border-gray-50">
                <img
                  src={product.image}
                  alt={product.name}
                  loading="lazy"
                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
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
              </div>

              {/* Product Information */}
              <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between select-text cursor-default">
                <div>
                  {/* Car Models Tags */}
                  {models.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {models.map((model, idx) => (
                        <span
                          key={idx}
                          className="bg-gray-100 text-gray-700 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        >
                          {model}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Full Product Title (Selectable & clickable) */}
                  <h3
                    className="font-medium text-xs sm:text-sm text-gray-900 leading-snug group-hover:text-tesla-red transition-colors mb-2 select-text"
                  >
                    {cleanName}
                  </h3>

                  {/* Part Numbers & Cross Block */}
                  {(product.detail_number || crossNumbers.length > 0) && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-1 text-[11px]">
                      {product.detail_number && (
                        <button
                          type="button"
                          onClick={(e) =>
                            handleCopyPartNumber(
                              e,
                              product.detail_number!,
                              product.id
                            )
                          }
                          className={`font-mono text-[10px] sm:text-[11px] font-medium border px-1.5 py-0.5 rounded flex-shrink-0 flex items-center gap-1 transition-all duration-200 cursor-pointer ${
                            copiedId === product.id && copiedType === 'part'
                              ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs scale-105'
                              : 'text-gray-700 bg-gray-100 hover:bg-gray-200/80 border-gray-200/80 active:scale-95'
                          }`}
                          title="Натисніть, щоб скопіювати номер деталі"
                        >
                          <span>#{product.detail_number}</span>
                          {copiedId === product.id && copiedType === 'part' ? (
                            <Check size={11} className="text-white stroke-[2.5] animate-in zoom-in-75 duration-200" />
                          ) : (
                            <Copy size={10} className="text-gray-400 group-hover:text-gray-600" />
                          )}
                        </button>
                      )}
                      {crossNumbers.length > 0 && (
                        <span
                          className="text-[10px] sm:text-[11px] font-mono text-gray-500 truncate"
                          title={`Аналоги: ${crossNumbers.join(', ')}`}
                        >
                          Cross: {crossNumbers[0]}{crossNumbers.length > 1 ? ` (+${crossNumbers.length - 1})` : ''}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Price & Action Buttons */}
                <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    {original > final && (
                      <span className="text-[11px] line-through text-gray-400 font-normal">
                        {formatCurrency(original, currency)}
                      </span>
                    )}
                    <span className="text-base sm:text-lg font-bold text-tesla-dark tracking-tight whitespace-nowrap">
                      {formatCurrency(final, currency)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* 1-click Copy for client (Title + Part # + Price + Link) */}
                    <button
                      type="button"
                      onClick={(e) =>
                        handleCopyProductInfo(e, product, cleanName, final)
                      }
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 border cursor-pointer ${
                        copiedId === product.id && copiedType === 'full'
                          ? 'bg-emerald-500 border-emerald-500 text-white scale-105 shadow-sm shadow-emerald-500/30'
                          : 'bg-gray-50 border-gray-200/80 text-gray-500 hover:text-gray-900 hover:bg-gray-100 active:scale-95'
                      }`}
                      title={
                        copiedId === product.id && copiedType === 'full'
                          ? 'Скопійовано!'
                          : 'Скопіювати назву, артикул і ціну для клієнта'
                      }
                      aria-label="Скопіювати інформацію для клієнта"
                    >
                      {copiedId === product.id && copiedType === 'full' ? (
                        <Check size={17} className="text-white stroke-[2.5] animate-in zoom-in-75 duration-200" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onAddToCart(product);
                      }}
                      disabled={!product.inStock}
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all shadow-xs ${
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
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default ProductList;
