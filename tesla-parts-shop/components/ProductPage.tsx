import React, { useState, useMemo, useEffect, useLayoutEffect } from 'react';
import { Product, Currency } from '../types';
import {
  ShoppingCart,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Truck,
  X,
  Copy,
  Send,
  Phone,
  ShieldCheck,
  Car,
  ZoomIn,
  CreditCard,
  Clock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import ViberIcon from './ViberIcon';
import { DEFAULT_EXCHANGE_RATE_UAH_PER_USD } from '../constants';
import SeoHead from './SeoHead';
import { formatCurrency } from '../utils/currency';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AppContext';
import { trackViewItem } from '../utils/analytics';

interface ProductPageProps {
  product: Product;
  currency: Currency;
  uahPerUsd: number;
  onAddToCart: (product: Product) => void;
  backUrl: string;
  socialLinks?: { telegram?: string; viber?: string; instagram?: string };
  phoneNumber?: string;
}

const ProductPage: React.FC<ProductPageProps> = ({
  product,
  currency,
  uahPerUsd,
  onAddToCart,
  backUrl,
  socialLinks,
  phoneNumber,
}) => {
  const navigate = useNavigate();

  // Instant scroll to the top so product photo starts at the top
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [product.id]);

  // Combine main image with additional images and remove duplicates
  const allImages = useMemo(
    () =>
      Array.from(
        new Set([product.image, ...(product.images || [])].filter(Boolean))
      ),
    [product.image, product.images]
  );
  const [selectedImage, setSelectedImage] = useState(allImages[0]);
  const [added, setAdded] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const effectiveRate =
    uahPerUsd > 0 ? uahPerUsd : DEFAULT_EXCHANGE_RATE_UAH_PER_USD;

  // Clean title: remove part number prefix if it is already displayed
  const cleanTitle = useMemo(() => {
    let name = product.name || '';
    if (
      product.detail_number &&
      name.toLowerCase().startsWith(product.detail_number.toLowerCase())
    ) {
      name = name.substring(product.detail_number.length).replace(/^[\s\-–—:]+/, '');
    }
    return name.trim() || product.name;
  }, [product.name, product.detail_number]);

  // Parse compatible car models
  const models = useMemo(() => {
    if (!product.category) return [];
    return product.category
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
  }, [product.category]);

  // Parse cross numbers
  const crossNumbers = useMemo(() => {
    if (!product.cross_number) return [];
    return product.cross_number
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
  }, [product.cross_number]);

  useEffect(() => {
    const fetchDeliveryInfo = async () => {
      try {
        const page = await api.getPage('delivery');
        if (page && page.content) {
          setDeliveryInfo(page.content);
        }
      } catch (e) {
        console.error('Failed to load delivery info', e);
      }
    };
    fetchDeliveryInfo();
  }, []);

  // GA4 view_item for Google Ads dynamic remarketing.
  // Depends on product.id only: effectiveRate changes once when the exchange
  // rate arrives from the API, and including it would fire a second view_item
  // for the same page view.
  useEffect(() => {
    trackViewItem(product, effectiveRate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const handleAddToCart = () => {
    onAddToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  };

  const handleCopy = (text: string, field: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handlePrevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const currentIndex = allImages.indexOf(selectedImage);
    const prevIndex = (currentIndex - 1 + allImages.length) % allImages.length;
    setSelectedImage(allImages[prevIndex]);
  };

  const handleNextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const currentIndex = allImages.indexOf(selectedImage);
    const nextIndex = (currentIndex + 1) % allImages.length;
    setSelectedImage(allImages[nextIndex]);
  };

  const openLightbox = () => {
    setIsLightboxOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
    document.body.style.overflow = 'auto';
  };

  const { customerProfile } = useAuth();
  const getDisplayPrice = () => {
    const priceUSD =
      product.priceUSD && product.priceUSD > 0
        ? product.priceUSD
        : product.priceUAH && product.priceUAH > 0 && effectiveRate > 0
          ? product.priceUAH / effectiveRate
          : 0;
    const originalAmount =
      currency === Currency.USD ? priceUSD : priceUSD * effectiveRate;
      
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

    return { original: originalAmount, final: finalAmount, priceUSD };
  };

  const { original, final, priceUSD } = getDisplayPrice();
  const displayMainPrice = formatCurrency(final, currency);
  const secondaryPrice =
    currency === Currency.UAH
      ? `≈ ${formatCurrency(priceUSD, Currency.USD)}`
      : `≈ ${formatCurrency(priceUSD * effectiveRate, Currency.UAH)}`;

  // Prefilled message for messenger consultation
  const prefilledText = encodeURIComponent(
    `Доброго дня! Мене цікавить запчастина: ${cleanTitle} (Артикул: ${product.detail_number || product.id}). Чи є в наявності?`
  );

  const telegramLink = socialLinks?.telegram
    ? `${socialLinks.telegram.replace(/\/+$/, '')}?text=${prefilledText}`
    : null;

  const viberLink = socialLinks?.viber
    ? `viber://chat?number=${encodeURIComponent(socialLinks.viber)}`
    : null;

  return (
    <div className="max-w-6xl mx-auto page-transition pb-12">
      <SeoHead
        title={product.meta_title || product.name}
        description={product.meta_description}
        fallbackTitle={product.name}
        fallbackDescription={`Купити ${product.name} за ціною ${product.priceUAH} грн`}
        image={product.image}
        type="product"
        price={product.priceUAH}
        currency="UAH"
        availability={product.inStock}
        deliveryInfo={deliveryInfo}
      />

      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <button
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate(backUrl);
            }
          }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 hover:text-tesla-dark text-xs sm:text-sm font-medium shadow-2xs transition-all duration-200 hover:-translate-x-0.5 active:scale-95 group cursor-pointer"
          title="Повернутися назад"
        >
          <ArrowLeft
            size={15}
            className="transition-transform duration-200 group-hover:-translate-x-1 text-gray-400 group-hover:text-tesla-dark"
          />
          <span>Назад</span>
        </button>

        {/* Model tags on desktop */}
        {models.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-end">
            {models.map((model, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-200/60"
              >
                <Car size={12} className="text-gray-400" />
                {model}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Main Product Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xs border border-gray-100 overflow-hidden mb-8">
        <div className="flex flex-col md:flex-row">
          {/* Left Column: Image Gallery */}
          <div className="md:w-1/2 p-3 sm:p-6 bg-[#fafafa] flex flex-col justify-between border-b md:border-b-0 md:border-r border-gray-100">
            <div>
              <div
                className="relative group cursor-zoom-in rounded-2xl overflow-hidden bg-white p-2 sm:p-4 border border-gray-100 shadow-2xs flex items-center justify-center aspect-square"
                onClick={openLightbox}
              >
                <img
                  src={selectedImage}
                  alt={product.name}
                  className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105"
                />

                {/* Tap to zoom hint */}
                <div className="absolute bottom-2.5 right-2.5 bg-black/60 hover:bg-black/80 backdrop-blur-xs text-white text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 pointer-events-none transition-opacity opacity-80 group-hover:opacity-100">
                  <ZoomIn size={13} />
                  <span className="hidden sm:inline">Збільшити</span>
                </div>

                {/* Arrow navigation on image (if multiple images) */}
                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 p-2 rounded-full shadow-md backdrop-blur-xs transition-all active:scale-90"
                      aria-label="Попереднє фото"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={handleNextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 p-2 rounded-full shadow-md backdrop-blur-xs transition-all active:scale-90"
                      aria-label="Наступне фото"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnails row */}
              {allImages.length > 1 && (
                <div className="flex gap-2.5 overflow-x-auto pt-3 pb-1 custom-scrollbar">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(img)}
                      className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 bg-white p-1 transition-all ${
                        selectedImage === img
                          ? 'border-tesla-red shadow-xs scale-[1.02]'
                          : 'border-transparent hover:border-gray-300 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={img}
                        alt=""
                        className="w-full h-full object-contain"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Delivery Guarantee Note */}
            <div className="mt-4 pt-3 border-t border-gray-200/60 hidden sm:flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1.5 text-gray-600">
                <Truck size={15} className="text-tesla-red" />
                Відправка Новою Поштою по Україні
              </span>
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <ShieldCheck size={15} />
                Гарантія 14 днів
              </span>
            </div>
          </div>

          {/* Right Column: Product Details & Purchase */}
          <div className="md:w-1/2 p-4 sm:p-6 md:p-8 flex flex-col justify-between">
            <div>
              {/* Status & Badges */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {product.inStock ? (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/70 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold tracking-wide shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    В наявності
                  </span>
                ) : (
                  <span className="inline-flex items-center bg-gray-100 border border-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
                    Під замовлення
                  </span>
                )}

                {/* Mobile models tags */}
                {models.map((model, idx) => (
                  <span
                    key={idx}
                    className="sm:hidden inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  >
                    <Car size={11} className="text-gray-400" />
                    {model}
                  </span>
                ))}
              </div>

              {/* Product Title (Clean, human-readable) */}
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight leading-snug mb-3">
                {cleanTitle}
              </h1>

              {/* Part # & Cross # Copyable Chips */}
              <div className="flex flex-wrap items-center gap-2 mb-6">
                {product.detail_number && (
                  <button
                    onClick={() => handleCopy(product.detail_number, 'part')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200/80 transition-all active:scale-95 cursor-pointer text-xs font-mono font-medium group"
                    title="Натисніть, щоб скопіювати артикул"
                  >
                    <span className="text-gray-500 font-sans font-normal text-[11px]">
                      Артикул OEM:
                    </span>
                    <span className="font-bold">{product.detail_number}</span>
                    {copiedField === 'part' ? (
                      <Check size={13} className="text-emerald-600" />
                    ) : (
                      <Copy
                        size={13}
                        className="text-gray-400 group-hover:text-gray-700 transition-colors"
                      />
                    )}
                  </button>
                )}

                {crossNumbers.length > 0 && (
                  <button
                    onClick={() => handleCopy(crossNumbers.join(', '), 'cross')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200/70 transition-all active:scale-95 cursor-pointer text-xs font-mono group"
                    title="Натисніть, щоб скопіювати крос-номери"
                  >
                    <span className="text-gray-500 font-sans font-normal text-[11px]">
                      Крос:
                    </span>
                    <span className="font-medium truncate max-w-[140px] sm:max-w-[200px]">
                      {crossNumbers.join(', ')}
                    </span>
                    {copiedField === 'cross' ? (
                      <Check size={13} className="text-emerald-600" />
                    ) : (
                      <Copy
                        size={13}
                        className="text-gray-400 group-hover:text-gray-700 transition-colors"
                      />
                    )}
                  </button>
                )}
              </div>

              {/* Price Block */}
              <div className="bg-gray-50/90 rounded-2xl p-4 sm:p-5 border border-gray-100 mb-6">
                <div className="flex items-baseline justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-xs text-gray-400 font-medium mb-0.5">Ціна:</div>
                    <div className="flex items-baseline gap-3">
                      {original > final && (
                        <span className="text-lg line-through text-gray-400 font-medium">
                          {formatCurrency(original, currency)}
                        </span>
                      )}
                      <span className="text-2xl sm:text-3xl md:text-4xl font-black text-tesla-dark tracking-tight">
                        {displayMainPrice}
                      </span>
                    </div>
                  </div>

                  {/* Cross-Currency Secondary Price */}
                  <div className="text-right">
                    <span className="inline-block text-xs font-semibold text-gray-500 bg-white border border-gray-200 px-2.5 py-1 rounded-lg shadow-2xs">
                      {secondaryPrice}
                    </span>
                  </div>
                </div>

                {original > final && (
                  <div className="mt-2 text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <Sparkles size={14} />
                    Спеціальна ціна зі знижкою клієнта
                  </div>
                )}
              </div>

              {/* Action Buttons: Add to Cart & Buy */}
              <div className="space-y-3 mb-6">
                <button
                  onClick={handleAddToCart}
                  disabled={!product.inStock}
                  className={`w-full py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg flex items-center justify-center gap-2.5 transition-all duration-200 shadow-md transform active:scale-[0.98] cursor-pointer ${
                    added
                      ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                      : product.inStock
                        ? 'bg-tesla-red text-white hover:bg-red-700 shadow-red-600/25 hover:shadow-lg'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  {added ? (
                    <>
                      <CheckCircle2 size={22} className="animate-in zoom-in-50" />
                      <span>Додано в кошик!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={20} />
                      <span>{product.inStock ? 'Купити / Додати в кошик' : 'Немає в наявності'}</span>
                    </>
                  )}
                </button>

                {/* Quick Consultation Messengers */}
                <div className="grid grid-cols-2 gap-2">
                  {telegramLink && (
                    <a
                      href={telegramLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#229ED9]/10 hover:bg-[#229ED9]/20 text-[#0088cc] border border-[#229ED9]/20 text-xs sm:text-sm font-semibold transition active:scale-95"
                    >
                      <Send size={15} />
                      <span>Запитати в Telegram</span>
                    </a>
                  )}

                  {viberLink ? (
                    <a
                      href={viberLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#7360F2]/10 hover:bg-[#7360F2]/20 text-[#6250e0] border border-[#7360F2]/20 text-xs sm:text-sm font-semibold transition active:scale-95"
                    >
                      <ViberIcon size={15} color="#6250e0" />
                      <span>Запитати у Viber</span>
                    </a>
                  ) : phoneNumber ? (
                    <a
                      href={`tel:${phoneNumber.replace(/\s+/g, '')}`}
                      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 text-xs sm:text-sm font-semibold transition active:scale-95"
                    >
                      <Phone size={14} className="text-emerald-500" />
                      <span>Зателефонувати</span>
                    </a>
                  ) : null}
                </div>
              </div>

              {/* Trust Badges Grid */}
              <div className="grid grid-cols-2 gap-2.5 pt-4 border-t border-gray-100 text-[11px] sm:text-xs text-gray-600">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-gray-50/70">
                  <ShieldCheck size={16} className="text-emerald-500 flex-shrink-0" />
                  <span>Гарантія 14 днів</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-gray-50/70">
                  <Truck size={16} className="text-tesla-red flex-shrink-0" />
                  <span>Нова Пошта (1-2 дні)</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-gray-50/70">
                  <CreditCard size={16} className="text-blue-500 flex-shrink-0" />
                  <span>Оплата при отриманні</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-gray-50/70">
                  <Clock size={16} className="text-amber-500 flex-shrink-0" />
                  <span>Швидка відправка</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Details Specifications & Description */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Characteristics Specifications Table (2 cols) */}
        <div className="md:col-span-2 bg-white rounded-2xl shadow-xs border border-gray-100 p-5 sm:p-7">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
            <span>Технічні характеристики</span>
          </h2>

          <div className="divide-y divide-gray-100 text-sm">
            {product.detail_number && (
              <div className="py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-gray-500 font-medium">Оригінальний номер (OEM):</span>
                <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2.5 py-0.5 rounded-md inline-block self-start sm:self-auto">
                  {product.detail_number}
                </span>
              </div>
            )}

            {crossNumbers.length > 0 && (
              <div className="py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-gray-500 font-medium">Крос-номери / Аналоги:</span>
                <span className="font-mono text-gray-800 text-xs sm:text-sm">
                  {crossNumbers.join(', ')}
                </span>
              </div>
            )}

            {models.length > 0 && (
              <div className="py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-gray-500 font-medium">Сумісність з Tesla:</span>
                <span className="font-semibold text-gray-900">
                  {models.join(', ')}
                </span>
              </div>
            )}

            <div className="py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
              <span className="text-gray-500 font-medium">Стан:</span>
              <span className="text-emerald-700 font-semibold">
                Нова деталь
              </span>
            </div>

            <div className="py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
              <span className="text-gray-500 font-medium">Наявність на складі:</span>
              <span className="text-gray-900">
                {product.inStock ? 'В наявності в Україні' : 'Під замовлення'}
              </span>
            </div>

            <div className="py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
              <span className="text-gray-500 font-medium">Гарантія:</span>
              <span className="text-gray-900 font-medium">
                14 днів на перевірку та встановлення
              </span>
            </div>
          </div>

          {/* Description Text */}
          {product.description && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="text-base font-bold text-gray-900 mb-3">Опис деталі</h3>
              <div className="text-gray-600 leading-relaxed text-sm sm:text-base whitespace-pre-line bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                {product.description}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Delivery & Payment Details */}
        <div className="bg-white rounded-2xl shadow-xs border border-gray-100 p-5 sm:p-7 flex flex-col justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
              <Truck size={20} className="text-tesla-red" />
              <span>Доставка та оплата</span>
            </h2>

            <div className="space-y-4 text-xs sm:text-sm text-gray-600">
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-tesla-red"></span>
                  Нова Пошта
                </div>
                <p className="text-gray-500 text-xs">
                  Доставка у будь-яке відділення чи поштомат України за 1-2 дні.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-tesla-red"></span>
                  Способи оплати
                </div>
                <p className="text-gray-500 text-xs">
                  Накладений платіж при отриманні або оплата на рахунок ФОП.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Гарантія повернення
                </div>
                <p className="text-gray-500 text-xs">
                  14 днів з моменту отримання товару відповідно до Закону України.
                </p>
              </div>
            </div>
          </div>

          {deliveryInfo && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="text-[11px] text-gray-400 max-h-36 overflow-y-auto pr-1 custom-scrollbar whitespace-pre-line">
                {deliveryInfo}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 md:p-8 animate-fade-in"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-tesla-red transition-colors p-2 z-[110] cursor-pointer"
            onClick={closeLightbox}
            aria-label="Закрити фото"
          >
            <X size={32} />
          </button>

          {allImages.length > 1 && (
            <>
              <button
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white hover:text-tesla-red transition-colors p-2 z-[110] bg-black/30 rounded-full cursor-pointer"
                onClick={handlePrevImage}
                aria-label="Попереднє"
              >
                <ChevronLeft size={40} />
              </button>
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white hover:text-tesla-red transition-colors p-2 z-[110] bg-black/30 rounded-full cursor-pointer"
                onClick={handleNextImage}
                aria-label="Наступне"
              >
                <ChevronRight size={40} />
              </button>
            </>
          )}

          <div className="max-w-full max-h-full flex items-center justify-center p-2">
            <img
              src={selectedImage}
              alt={product.name}
              className="max-w-full max-h-[85vh] object-contain shadow-2xl rounded-lg animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPage;
