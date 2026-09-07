import React, { useState, useMemo, useEffect } from 'react';
import { Product, Currency } from '../types';
import {
  ShoppingCart,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Truck,
  X,
} from 'lucide-react';
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
}

const ProductPage: React.FC<ProductPageProps> = ({
  product,
  currency,
  uahPerUsd,
  onAddToCart,
  backUrl,
}) => {
  const navigate = useNavigate();
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
  const effectiveRate =
    uahPerUsd > 0 ? uahPerUsd : DEFAULT_EXCHANGE_RATE_UAH_PER_USD;

  useEffect(() => {
    const fetchDeliveryInfo = async () => {
      const page = await api.getPage('delivery');
      if (page && page.content) {
        setDeliveryInfo(page.content);
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
    setTimeout(() => setAdded(false), 2000);
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

    return { original: originalAmount, final: finalAmount };
  };

  return (
    <div className="max-w-6xl mx-auto page-transition">
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
      <button
        onClick={() => {
          if (window.history.length > 1) {
            navigate(-1);
          } else {
            navigate(backUrl);
          }
        }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 hover:text-tesla-dark mb-6 text-sm font-medium shadow-xs transition-all duration-200 hover:-translate-x-0.5 active:scale-95 group cursor-pointer"
        title="Повернутися назад"
      >
        <ArrowLeft size={16} className="transition-transform duration-200 group-hover:-translate-x-1 text-gray-400 group-hover:text-tesla-dark" />
        <span>Назад</span>
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* Image Gallery */}
          <div className="md:w-1/2 p-6 bg-gray-50">
            <div
              className="relative group cursor-zoom-in"
              onClick={openLightbox}
            >
              <div className="aspect-square rounded-xl overflow-hidden bg-white mb-4 shadow-sm">
                <img
                  src={selectedImage}
                  alt={product.name}
                  className="w-full h-full object-contain hover:scale-[1.05] transition-transform duration-500"
                />
              </div>
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={handlePrevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/50 backdrop-blur-sm rounded-full p-2 text-gray-700 hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={handleNextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/50 backdrop-blur-sm rounded-full p-2 text-gray-700 hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}
            </div>

            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(img)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${
                      selectedImage === img
                        ? 'border-tesla-red'
                        : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={img}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="md:w-1/2 p-8 md:p-12 flex flex-col">
            <div className="mb-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                    {product.category}
                  </span>
                  {product.detail_number && (
                    <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                      Part #: {product.detail_number}
                    </span>
                  )}
                  {product.cross_number && (
                    <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                      Cross #: {product.cross_number}
                    </span>
                  )}
                </div>
                {product.inStock ? (
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap flex-shrink-0">
                    В наявності
                  </span>
                ) : (
                  <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap flex-shrink-0">
                    Немає в наявності
                  </span>
                )}
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {product.name}
              </h1>

              <div className="mb-8">
                <div className="flex flex-col">
                  {getDisplayPrice().original > getDisplayPrice().final && (
                    <span className="text-xl line-through text-gray-400">
                      {formatCurrency(getDisplayPrice().original, currency)}
                    </span>
                  )}
                  <span className="text-3xl font-bold text-tesla-dark">
                    {formatCurrency(getDisplayPrice().final, currency)}
                  </span>
                </div>
              </div>

              <div className="prose prose-sm text-gray-600 mb-8">
                <h3 className="text-gray-900 font-semibold mb-2">Опис</h3>
                <p className="whitespace-pre-line">{product.description}</p>
              </div>
            </div>

            <div className="pt-8 border-t border-gray-100">
              <button
                onClick={handleAddToCart}
                disabled={!product.inStock}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] ${
                  added
                    ? 'bg-green-600 text-white'
                    : product.inStock
                      ? 'bg-tesla-red text-white hover:bg-red-700 shadow-lg hover:shadow-xl'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {added ? (
                  <>
                    <Check size={24} />
                    Додано в кошик
                  </>
                ) : (
                  <>
                    <ShoppingCart size={24} />
                    {product.inStock ? 'Купити' : 'Немає в наявності'}
                  </>
                )}
              </button>

              {deliveryInfo && (
                <div className="mt-8 bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <div className="flex items-center gap-2 mb-3 text-tesla-dark font-bold">
                    <Truck size={20} />
                    <h3>Доставка та оплата</h3>
                  </div>
                  <div className="prose prose-sm text-gray-600 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    <p className="whitespace-pre-line text-xs">
                      {deliveryInfo}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-fade-in"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-tesla-red transition-colors p-2 z-[110]"
            onClick={closeLightbox}
          >
            <X size={32} />
          </button>

          {allImages.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-tesla-red transition-colors p-2 z-[110] bg-black/20 rounded-full"
                onClick={handlePrevImage}
              >
                <ChevronLeft size={48} />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-tesla-red transition-colors p-2 z-[110] bg-black/20 rounded-full"
                onClick={handleNextImage}
              >
                <ChevronRight size={48} />
              </button>
            </>
          )}

          <div className="max-w-full max-h-full flex items-center justify-center">
            <img
              src={selectedImage}
              alt={product.name}
              className="max-w-full max-h-[90vh] object-contain shadow-2xl animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPage;
