import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { Product, Currency, SchematicUsage, ProductReview } from '../types';
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
  FileText,
  Sparkles,
  CheckCircle2,
  Layers,
  ArrowRight,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import ViberIcon from './ViberIcon';
import { DEFAULT_EXCHANGE_RATE_UAH_PER_USD } from '../constants';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import SeoHead from './SeoHead';
import { formatCurrency } from '../utils/currency';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AppContext';
import { trackViewItem } from '../utils/analytics';
import { getProductPartType } from '../utils/partType';
import ProductReviews from './ProductReviews';
import {
  appendAlternates,
  displayPartNumbers,
  hyphenatedPartNumber,
  insertAlternates,
  withAlternate,
} from '../utils/partNumbers';
import { PartTypeBadge } from './PartTypeBadge';
import { thumbUrl } from '../utils/imageUrl';
import { mediaUrl } from '../utils/media';

interface ProductPageProps {
  product: Product;
  currency: Currency;
  uahPerUsd: number;
  onAddToCart: (product: Product) => void;
  backUrl: string;
  socialLinks?: { telegram?: string; viber?: string; instagram?: string };
  phoneNumber?: string;
}

/**
 * Дві колонки картки товару вмикаються з md (768px). Відгуки на широкому
 * екрані стоять під фото, на телефоні - після кнопки купівлі, тому потрібно
 * знати поточний режим у JS, а не ховати копію через CSS.
 */
const useWideLayout = (): boolean => {
  const [isWide, setIsWide] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 768px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isWide;
};

/**
 * Широкий екран (>= 1280px): саме з цієї ширини фото в лівій колонці стає
 * достатньо великим, щоб колонка з додатковими фото була вищою за колонку
 * купівлі. Нижче 1280px права колонка вища, тому відгуки там лишаються під
 * фото.
 */
const useXlLayout = (): boolean => {
  const [isXl, setIsXl] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 1280px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const onChange = () => setIsXl(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isXl;
};

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
  // 480px-мініатюра для головного фото: показ ~480 CSS px, тож 1600-піксельний
  // оригінал (100-130 КБ) тут зайвий - він потрібен лише для зуму.
  const mainImage = mediaUrl(selectedImage);
  const mainThumb = thumbUrl(mainImage);
  const [added, setAdded] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  // Свайп по фото на телефоні. Тримаємо старт дотику й прапорець, щоб
  // після свайпу не відкривався лайтбокс від того ж дотику.
  const galleryTouchStart = useRef<{
    x: number;
    y: number;
    at: number;
  } | null>(null);
  const gallerySwiped = useRef(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  // Крос-номери згорнуті: у списку буває 5-6 номерів, і в картці вони
  // займали пів екрана. Розгортаються кнопкою зі стрілкою.
  const [showCrossNumbers, setShowCrossNumbers] = useState(false);
  // Схеми, де використовується ця деталь (зворотний шлях: товар → вузол)
  const [productSchematics, setProductSchematics] = useState<SchematicUsage[]>([]);
  // Відгуки на цю деталь керуються з адмінки, тому вантажимо окремо.
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const isWideLayout = useWideLayout();
  const isXlLayout = useXlLayout();
  // Куди поставити відгуки на ПК: під фото чи під кнопкою купівлі. На
  // широкому екрані з додатковими фото ліва колонка вища за праву - тоді
  // відгуки заповнюють порожнє місце справа, а не розтягують ліву.
  const reviewsOnRight = isXlLayout && allImages.length > 1;
  const [showAllSchematics, setShowAllSchematics] = useState(false);
  // Модель, з якої прийшли в каталог. Раніше передавали ?model=... у URL  - 
  // це псувало SEO-адресу. Тепер модель летить у react-router state, а query
  // лишаємо лише як fallback для старих зовнішніх посилань.
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const stateModel = (location.state as { browseModel?: string } | null)?.browseModel;
  const browseModel = (searchParams.get('model') || stateModel || '').trim();

  useEffect(() => {
    let cancelled = false;
    if (!product?.id) {
      setProductSchematics([]);
      return;
    }
    api
      .getSchematicsByProduct(product.id)
      .then((list) => {
        if (!cancelled) setProductSchematics(list);
      })
      .catch(() => {
        if (!cancelled) setProductSchematics([]);
      });
    return () => {
      cancelled = true;
    };
  }, [product?.id]);
  /**
   * Схеми сортуємо за тим, наскільки вони відповідають моделі, з якої прийшли.
   * Раніше порядок був випадковий: з каталогу Model Y могла відкритись схема
   * Model 3 Highland - а це інший вузол.
   */
  const key = (value?: string | null) => (value || '').trim().toLowerCase();
  /** 0 - точний збіг моделі й покоління, 1 - базова комплектація, 2 - та сама
   *  модель з іншим поколінням, 3 - схожа назва, 4 - інша модель. */
  const schemeScore = (usage: SchematicUsage, want: string) => {
    const model = key(usage.model);
    const gen = key(usage.generation);
    const full = `${model} ${gen}`.trim();
    if (full === want) return 0;
    if (model === want && (gen === '' || gen === 'стандартна')) return 1;
    if (model === want) return 2;
    if (want.includes(model) || model.includes(want)) return 3;
    return 4;
  };

  const sortedSchematics = useMemo(() => {
    if (!browseModel) return productSchematics;
    const want = key(browseModel);
    return [...productSchematics].sort((a, b) => schemeScore(a, want) - schemeScore(b, want));
  }, [productSchematics, browseModel]);

  /** Найкраща схема саме тієї моделі, з якої прийшли (або null) */
  const sameModelScheme = useMemo(() => {
    if (!browseModel) return null;
    const want = key(browseModel);
    const best = [...productSchematics]
      .map((usage) => ({ usage, score: schemeScore(usage, want) }))
      .sort((a, b) => a.score - b.score)[0];
    return best && best.score <= 2 ? best.usage : null;
  }, [productSchematics, browseModel]);

  const hasSchemeForBrowseModel = !browseModel || Boolean(sameModelScheme);

  /**
   * Велика кнопка під «Купити» веде ТІЛЬКИ на схему обраної моделі.
   * Якщо такої схеми ще немає - не підсовуємо чужу модель, а чесно кажемо про це
   * (схеми інших моделей лишаються нижче, у блоці «Є на схемах»).
   */
  const showNoSchemeNotice =
    Boolean(browseModel) && !sameModelScheme && productSchematics.length > 0;

  const effectiveRate =
    uahPerUsd > 0 ? uahPerUsd : DEFAULT_EXCHANGE_RATE_UAH_PER_USD;

  // Clean title: remove part number prefix if it is already displayed
  const cleanTitle = useMemo(() => {
    let name = product.name || '';
    if (
      product.detail_number &&
      name.toLowerCase().startsWith(product.detail_number.toLowerCase())
    ) {
      name = name.substring(product.detail_number.length).replace(/^[\s\-– - :]+/, '');
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

  // GA4 view_item for Google Ads dynamic remarketing.
  // Depends on product.id only: effectiveRate changes once when the exchange
  // rate arrives from the API, and including it would fire a second view_item
  // for the same page view.
  useEffect(() => {
    trackViewItem(product, effectiveRate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  useEffect(() => {
    let alive = true;
    api.getProductReviews(product.id).then((data) => {
      if (alive) setReviews(data);
    });
    return () => {
      alive = false;
    };
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

  const handleGalleryTouchStart = (e: React.TouchEvent) => {
    if (allImages.length < 2) return;
    const touch = e.touches[0];
    galleryTouchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      at: Date.now(),
    };
    gallerySwiped.current = false;
  };

  const handleGalleryTouchEnd = (e: React.TouchEvent) => {
    const start = galleryTouchStart.current;
    galleryTouchStart.current = null;
    if (!start || allImages.length < 2) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const elapsed = Date.now() - start.at;

    // Горизонтальний свайп: достатня довжина, переважає над вертикальним і
    // не перетворився на довге утримання.
    const isSwipe =
      Math.abs(dx) >= 45 &&
      Math.abs(dx) > Math.abs(dy) * 1.2 &&
      elapsed < 800;
    if (!isSwipe) return;

    gallerySwiped.current = true;
    if (dx < 0) {
      handleNextImage();
    } else {
      handlePrevImage();
    }
  };

  const handleGalleryClick = () => {
    // Клік після свайпу не має відкривати лайтбокс.
    if (gallerySwiped.current) {
      gallerySwiped.current = false;
      return;
    }
    openLightbox();
  };

  const openLightbox = () => {
    setIsLightboxOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
    document.body.style.overflow = 'auto';
  };

  const closeLightboxSafely = () => {
    // Після свайпу дотик не має закривати лайтбокс.
    if (gallerySwiped.current) {
      gallerySwiped.current = false;
      return;
    }
    closeLightbox();
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

  const partType = useMemo(() => getProductPartType(product), [product]);

  // Prefilled message for messenger consultation
  const productPath = `/product/${product.slug || product.id}`;
  const productUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}${productPath}`
      : `https://teslapartscenter.com.ua${productPath}`;

  const messageLines = [
    `Доброго дня! Мене цікавить запчастина:`,
    cleanTitle,
    product.detail_number ? `Артикул: ${product.detail_number}` : null,
    `Ціна: ${displayMainPrice}`,
    productUrl,
    ``,
    `Підкажіть, будь ласка, чи є в наявності та коли можлива відправка?`,
  ].filter((line) => line !== null) as string[];

  const rawPrefilledText = messageLines.join('\n');
  const prefilledText = encodeURIComponent(rawPrefilledText);

  const telegramLink = React.useMemo(() => {
    if (!socialLinks?.telegram) return null;
    const cleanTg = socialLinks.telegram.trim();
    const username = cleanTg
      .replace(/^https?:\/\/t\.me\//i, '')
      .replace(/^@/, '')
      .replace(/\/.*$/, '');
    return `https://t.me/${username}?text=${prefilledText}`;
  }, [socialLinks?.telegram, prefilledText]);

  const viberLink = React.useMemo(() => {
    if (!socialLinks?.viber) return null;
    let cleanDigits = socialLinks.viber.replace(/\D/g, '');
    if (cleanDigits.startsWith('0')) {
      cleanDigits = `38${cleanDigits}`;
    }
    return `viber://chat?number=${cleanDigits}&draft=${prefilledText}`;
  }, [socialLinks?.viber, prefilledText]);

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <SeoHead
        title={insertAlternates(product.meta_title?.trim() || product.name, product.detail_number)}
        description={appendAlternates(
          product.meta_description?.trim() ||
            `${product.name}. Ціна ${product.priceUAH} грн, ${product.inStock ? 'в наявності' : 'під замовлення'}. Доставка по Україні.`,
          product.detail_number,
          product.cross_number
        )}
        fallbackTitle={product.name}
        image={product.image}
        canonicalUrl={`https://teslapartscenter.com.ua${productPath}`}
        type="product"
        sku={product.detail_number || product.id}
        mpn={hyphenatedPartNumber(product.detail_number)}
        price={product.priceUAH}
        currency="UAH"
        availability={product.inStock}
      />

      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
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

      </div>

      {/* Main Product Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xs border border-gray-100 overflow-hidden mb-8">
        <div className="flex flex-col md:flex-row">
          {/* Left Column: Image Gallery */}
          <div className="md:w-1/2 p-3 sm:px-6 sm:pt-5 sm:pb-6 bg-[#fafafa] flex flex-col justify-between border-b md:border-b-0 md:border-r border-gray-100">
            <div>
              <div
                className="relative group cursor-zoom-in rounded-2xl overflow-hidden bg-white p-2 sm:p-4 border border-gray-100 shadow-2xs flex items-center justify-center aspect-[5/4] sm:aspect-square touch-pan-y"
                onClick={handleGalleryClick}
                onTouchStart={handleGalleryTouchStart}
                onTouchEnd={handleGalleryTouchEnd}
              >
                <img
                  src={mainThumb || mainImage}
                  srcSet={
                    mainThumb
                      ? `${mainThumb} 480w, ${mainImage.replace(/\.webp$/i, '-720.webp')} 720w, ${mainImage.replace(/\.webp$/i, '-1200.webp')} 1200w, ${mainImage} 1600w`
                      : undefined
                  }
                  sizes="(min-width: 768px) 480px, 100vw"
                  fetchPriority="high"
                  alt={product.name}
                  width={480}
                  height={480}
                  className="max-h-full max-w-full object-contain transition-transform duration-500"
                />

                {/* Badges on photo: Stock & Part Type together in top-left */}
                <div className="absolute top-3 left-3 z-10 pointer-events-none flex flex-wrap items-center gap-1.5">
                  {product.inStock ? (
                    <span className="inline-flex items-center gap-1.5 bg-white/95 backdrop-blur-xs text-gray-800 text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-200 shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      В наявності
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-white/95 backdrop-blur-xs text-gray-500 text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200 shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                      Під замовлення
                    </span>
                  )}
                  {partType && (
                    <PartTypeBadge type={partType} variant="floating" size="md" />
                  )}
                </div>

                {/* На телефоні додаткові фото - маленькі кружечки поверх
                    головного: ряд мініатюр під фото зсував ціну й кнопку
                    купівлі за межі першого екрана. */}
                {allImages.length > 1 && (
                  <div className="sm:hidden absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-lg bg-white/75 backdrop-blur-xs p-1 shadow-xs">
                    {allImages.slice(0, 4).map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedImage(img);
                        }}
                        aria-label={`Фото ${idx + 1}`}
                        aria-pressed={selectedImage === img}
                        className={`w-7 h-7 rounded overflow-hidden border transition-colors cursor-pointer ${
                          selectedImage === img
                            ? 'border-tesla-red'
                            : 'border-white/80 opacity-80'
                        }`}
                      >
                        <img
                          src={thumbUrl(mediaUrl(img))}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover rounded-[3px]"
                        />
                      </button>
                    ))}
                    {allImages.length > 4 && (
                      <span className="text-[10px] font-bold text-gray-700 bg-white/90 backdrop-blur-xs rounded px-1.5 py-1">
                        +{allImages.length - 4}
                      </span>
                    )}
                  </div>
                )}

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
                <div className="hidden sm:flex gap-2.5 overflow-x-auto pt-3 pb-1 custom-scrollbar">
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
                        src={thumbUrl(mediaUrl(img)) || mediaUrl(img)}
                        srcSet={
                          thumbUrl(mediaUrl(img))
                            ? `${thumbUrl(mediaUrl(img))} 480w, ${mediaUrl(img)} 1600w`
                            : undefined
                        }
                        sizes="80px"
                        alt=""
                        width={100}
                        height={100}
                        loading="lazy"
                        className="w-full h-full object-contain"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* На широкому екрані відгуки стоять під фото: правий стовпчик
                коротший, і картка виглядає рівніше. */}
            {isWideLayout && !reviewsOnRight && (
              <ProductReviews reviews={reviews} productId={product.id} />
            )}
          </div>

          {/* Right Column: Product Details & Purchase */}
          <div className="md:w-1/2 p-4 pt-3 sm:p-6 sm:pt-4 md:px-8 md:pt-5 md:pb-8 flex flex-col justify-between">
            <div>
              {/* Сумісність одним рядком: список моделей замість пігулки на
                  кожну модель. На вузькому екрані модельний ряд — це довгий
                  «шум», тому тут лише тихий підпис із машиною. */}
              {models.length > 0 && (
                <div className="flex items-start gap-1.5 mb-1 sm:mb-1.5">
                  <Car size={13} className="text-gray-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed line-clamp-2">
                    <span className="text-gray-400">Tesla</span>{' '}
                    {models.join(' · ')}
                  </p>
                </div>
              )}

              {/* Product Title (Clean, human-readable) */}
              <h1 className="text-[17px] sm:text-xl md:text-[22px] font-bold text-gray-900 tracking-tight leading-snug mb-2 sm:mb-3">
                {cleanTitle}
              </h1>

              {/* Артикули: два тихі рядки замість великих пігулок. Текст
                  можна виділити й скопіювати вручну; окрема кнопка копіювання
                  є лише в артикула, бо крос-номери копіюють поштучно. */}
              {(product.detail_number || crossNumbers.length > 0) && (
                <div className="mb-3 sm:mb-4 rounded-xl border border-gray-200/80 divide-y divide-gray-100 overflow-hidden">
                  {product.detail_number && (
                    <div className="w-full flex items-start gap-2.5 px-3 py-1.5 sm:py-2">
                      <span className="w-[52px] sm:w-[64px] shrink-0 pt-px text-[10px] uppercase tracking-wide font-semibold text-gray-400">
                        Артикул
                      </span>
                      <span className="flex-1 min-w-0 flex items-start gap-2">
                        <span className="select-text font-mono text-[11px] sm:text-xs font-medium text-gray-900 leading-snug break-words">
                          {displayPartNumbers(product.detail_number)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(product.detail_number, 'part')}
                          className="p-1.5 -m-1.5 rounded text-gray-300 hover:text-gray-700 transition-colors shrink-0 cursor-pointer"
                          aria-label="Скопіювати артикул"
                          title="Скопіювати артикул"
                        >
                          {copiedField === 'part' ? (
                            <Check size={14} className="text-emerald-600" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </span>
                    </div>
                  )}

                  {crossNumbers.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowCrossNumbers((open) => !open)}
                        aria-expanded={showCrossNumbers}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 sm:py-2 text-left hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <span className="w-[52px] sm:w-[64px] shrink-0 text-[10px] uppercase tracking-wide font-semibold text-gray-400">
                          Крос
                        </span>
                        <span className="flex-1 min-w-0 text-[11px] sm:text-xs text-gray-600">
                          {crossNumbers.length}{' '}
                          {crossNumbers.length === 1
                            ? 'номер'
                            : crossNumbers.length < 5
                              ? 'номери'
                              : 'номерів'}
                          {!showCrossNumbers && (
                            <span className="hidden sm:inline text-gray-400">
                              {' '}· натисніть, щоб показати
                            </span>
                          )}
                        </span>
                        <ChevronDown
                          size={14}
                          className={`text-gray-400 shrink-0 transition-transform ${
                            showCrossNumbers ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {showCrossNumbers && (
                        <div className="px-3 pb-2.5 flex items-start gap-2.5">
                          <span className="w-[52px] sm:w-[64px] shrink-0" aria-hidden="true" />
                          <span className="flex-1 min-w-0 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] sm:text-xs text-gray-600 leading-snug">
                            {crossNumbers.map((number, index) => (
                              <span key={`${number}-${index}`} className="select-text whitespace-nowrap">
                                {withAlternate(number)}
                              </span>
                            ))}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Price Block */}
              <div className="bg-gray-50/90 rounded-2xl p-3 sm:p-4 border border-gray-100 mb-3 sm:mb-4">
                <div className="flex items-baseline justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-xs text-gray-600 font-medium mb-0.5">Ціна:</div>
                    <div className="flex items-baseline gap-3">
                      {original > final && (
                        <span className="text-lg line-through text-gray-400 font-medium">
                          {formatCurrency(original, currency)}
                        </span>
                      )}
                      <span className="text-2xl sm:text-3xl font-bold text-tesla-dark tracking-tight">
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
              <div className="space-y-2.5 mb-4">
                <button
                  onClick={handleAddToCart}
                  disabled={!product.inStock}
                  className={`w-full py-3 sm:py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2.5 transition-all duration-200 shadow-md transform active:scale-[0.98] cursor-pointer ${
                    added
                      ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                      : product.inStock
                        ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/25 hover:shadow-lg'
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

                {/* Обіцянка відправки: показуємо лише для товарів у наявності,
                    для «під замовлення» вона була б неправдою. */}
                {product.inStock && (
                  <div className="flex items-center justify-center gap-1.5 pt-0.5 text-[11px] sm:text-xs font-medium text-gray-500">
                    <Clock size={13} className="text-gray-400 shrink-0" />
                    <span>Замовте до 15:00 - відправимо сьогодні</span>
                  </div>
                )}

                {/* Другорядні дії зібрані в один нейтральний блок: схеми й
                    месенджери. Один стиль на всі, акцент лишається тільки на
                    червоній кнопці купівлі. */}
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  {sortedSchematics.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        document.getElementById('product-schemes')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-gray-50 transition-colors text-left group cursor-pointer"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Layers size={16} className="text-gray-400 shrink-0" />
                        <span className="text-xs font-semibold text-gray-900 truncate">
                          {sortedSchematics.length === 1
                            ? `Ця деталь є на схемі (${sortedSchematics[0].model})`
                            : `Ця деталь є на ${sortedSchematics.length} схемах`}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400 shrink-0">
                        <span>Дивитись внизу</span>
                        <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" />
                      </span>
                    </button>
                  )}

                  <div
                    className={`grid ${
                      telegramLink && (viberLink || phoneNumber)
                        ? 'grid-cols-2 divide-x divide-gray-100'
                        : 'grid-cols-1'
                    } ${sortedSchematics.length > 0 ? 'border-t border-gray-100' : ''}`}
                  >
                    {telegramLink && (
                      <a
                        href={telegramLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Send size={15} className="text-[#229ED9]" />
                        <span>Telegram</span>
                      </a>
                    )}

                    {viberLink ? (
                      <a
                        href={viberLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <ViberIcon size={15} color="#7360F2" />
                        <span>Viber</span>
                      </a>
                    ) : phoneNumber ? (
                      <a
                        href={`tel:${phoneNumber.replace(/\s+/g, '')}`}
                        className="flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Phone size={14} className="text-emerald-500" />
                        <span>Зателефонувати</span>
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Trust Badges Grid */}
              <div className="grid grid-cols-2 gap-2.5 pt-4 border-t border-gray-100 text-[11px] sm:text-xs text-gray-600">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-gray-50/70">
                  <ShieldCheck size={16} className="text-gray-400 flex-shrink-0" />
                  <span>Гарантія</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-gray-50/70">
                  <Truck size={16} className="text-gray-400 flex-shrink-0" />
                  <span>Нова Пошта (1-2 дні)</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-gray-50/70">
                  <CreditCard size={16} className="text-gray-400 flex-shrink-0" />
                  <span>Оплата при отриманні</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-gray-50/70">
                  <Clock size={16} className="text-gray-400 flex-shrink-0" />
                  <span>Швидка відправка</span>
                </div>
              </div>

              {/* На телефоні відгуки лишаються під кнопкою купівлі: не
                  відсуваємо ціну й кнопку вниз. */}
              {(!isWideLayout || reviewsOnRight) && (
                <ProductReviews reviews={reviews} productId={product.id} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Product Details Specifications & Description */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Characteristics Specifications Table (2 cols) */}
        <div className="md:col-span-3 bg-white rounded-2xl shadow-xs border border-gray-100 p-5 sm:p-7">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100 flex items-center gap-2">
            <span>Технічні характеристики</span>
          </h2>

          <div className="divide-y divide-gray-100 text-sm">
            {partType && (
              <div className="py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-gray-500 font-medium">Тип запчастини:</span>
                <span className="font-semibold inline-flex items-center gap-1.5 text-gray-900">
                  {partType === 'original' ? (
                    <>
                      <ShieldCheck size={15} className="text-blue-600" />
                      Оригінал Tesla (OEM)
                    </>
                  ) : (
                    <>
                      <Layers size={15} className="text-amber-600" />
                      Якісний аналог
                    </>
                  )}
                </span>
              </div>
            )}

            <div className="py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
              <span className="text-gray-500 font-medium">Стан:</span>
              <span className="text-gray-900 font-medium">
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
                Гарантія виробника
              </span>
            </div>
          </div>

          {/* Опис деталі - перед схемами: спершу що це за деталь, потім
              де вона стоїть. */}
          {product.description && (
            <div className="mt-8 pt-8 border-t border-gray-100">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <FileText size={18} className="text-gray-400" />
                Опис деталі
              </h3>
              <div className="text-gray-600 leading-relaxed text-sm sm:text-base whitespace-pre-line bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                {product.description}
              </div>
            </div>
          )}

          {/* Схеми, де стоїть ця деталь - шлях «від деталі до вузла» */}
          {productSchematics.length > 0 && (
            <div id="product-schemes" className="mt-8 pt-8 border-t border-gray-100 scroll-mt-20">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Layers size={18} className="text-gray-400" />
                  Де стоїть на схемі ({sortedSchematics.length})
                </h3>
                <span className="text-xs text-gray-400 font-manrope">
                  {sortedSchematics.length === 1 ? '1 схема' : `${sortedSchematics.length} схем`}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 font-manrope mb-4">
                Оберіть схему вашої моделі для перегляду вузла та суміжних кріплень у каталозі:
              </p>

              {!hasSchemeForBrowseModel && browseModel && (
                <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-manrope text-amber-900">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    Для <strong>Tesla {browseModel}</strong> схеми цього вузла ще немає - нижче
                    наведено схеми для інших моделей Tesla, де застосовується ця деталь.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {(showAllSchematics ? sortedSchematics : sortedSchematics.slice(0, 4)).map((usage, index) => (
                  <Link
                    key={`${usage.schematic_id}-${usage.number}-${index}`}
                    to={`/schemes/${usage.schematic_id}`}
                    className="group flex flex-col bg-white border border-gray-200/90 hover:border-gray-300 rounded-2xl overflow-hidden hover:shadow-md transition-all duration-200"
                  >
                    {/* Visual schematic preview */}
                    <div className="relative aspect-[4/3] w-full bg-gray-50/70 p-2.5 flex items-center justify-center border-b border-gray-100 overflow-hidden">
                      {usage.image_url ? (
                        <img
                          src={mediaUrl(usage.image_url)}
                          alt={`${usage.model} - ${usage.title}`}
                          loading="lazy"
                          className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Layers size={32} />
                        </div>
                      )}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-xs text-gray-500 font-montserrat font-bold text-[10px] sm:text-xs shadow-2xs border border-gray-200">
                        № {usage.number}
                      </span>
                    </div>

                    {/* Card Content */}
                    <div className="p-3 flex flex-col flex-grow justify-between">
                      <div>
                        <div className="font-montserrat font-bold text-xs sm:text-sm text-gray-900 group-hover:text-tesla-red transition-colors line-clamp-1">
                          {usage.model} {usage.generation && usage.generation !== 'Стандартна' ? usage.generation : ''}
                        </div>
                        <div className="text-[11px] sm:text-xs text-gray-500 font-manrope line-clamp-1 mt-0.5">
                          {usage.title || usage.subsystem || usage.section}
                        </div>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-gray-100/80 flex items-center justify-between text-[11px] font-semibold text-gray-500 group-hover:text-tesla-red transition-colors">
                        <span>Перейти до схеми</span>
                        <ArrowRight size={13} className="text-gray-400 group-hover:text-tesla-red group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {sortedSchematics.length > 4 && (
                <button
                  type="button"
                  onClick={() => setShowAllSchematics(!showAllSchematics)}
                  className="mt-4 w-full py-2.5 px-4 text-xs font-semibold text-gray-600 bg-white hover:bg-gray-50 hover:text-tesla-red border border-gray-200 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>
                    {showAllSchematics
                      ? 'Згорнути список схем'
                      : `Показати всі ${sortedSchematics.length} схем (+${sortedSchematics.length - 4})`}
                  </span>
                  {showAllSchematics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 md:p-8 animate-fade-in touch-pan-y"
          onClick={closeLightboxSafely}
          onTouchStart={handleGalleryTouchStart}
          onTouchEnd={handleGalleryTouchEnd}
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
              width={1200}
              height={1200}
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
