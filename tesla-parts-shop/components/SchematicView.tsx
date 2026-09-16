import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Share2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ShieldCheck,
  PackageCheck,
  Layers,
  ArrowLeft
} from 'lucide-react';
import { api } from '../services/api';
import { Schematic, SchematicHotspot, HotspotVariant, Currency, Product, SavedCar } from '../types';
import { formatCurrency } from '../utils/currency';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

interface SchematicViewProps {
  currency: Currency;
  uahPerUsd: number;
  onAddToCart: (product: Product) => void;
}

export const SchematicView: React.FC<SchematicViewProps> = ({
  currency,
  uahPerUsd,
  onAddToCart
}) => {
  const { id } = useParams<{ id: string }>();
  const [schematic, setSchematic] = useState<Schematic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active highlighted hotspot pin / part
  const [activeHotspotId, setActiveHotspotId] = useState<number | null>(null);

  // Collapsed / Expanded state for variants (map of hotspot.id -> boolean)
  const [expandedVariants, setExpandedVariants] = useState<Record<number, boolean>>({});

  // Added to cart feedback message
  const [addedToast, setAddedToast] = useState<string | null>(null);

  // Active garage car
  const [activeCar, setActiveCar] = useState<SavedCar | null>(null);

  // Refs for auto-scrolling
  const partRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (id) {
      loadSchematic(parseInt(id));
    }
    loadActiveCar();
  }, [id]);

  const loadActiveCar = () => {
    try {
      const saved = localStorage.getItem('tesla_garage_active_car');
      if (saved) {
        setActiveCar(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadSchematic = async (schematicId: number) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getSchematic(schematicId);
      setSchematic(data);
      // Expand the first hotspot with variants by default
      if (data.hotspots.length > 0) {
        const firstWithVars = data.hotspots.find(h => (h.variants && h.variants.length > 1) || (h.variants && h.variants.length > 0));
        if (firstWithVars) {
          setExpandedVariants({ [firstWithVars.id]: true });
          setActiveHotspotId(firstWithVars.id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Помилка завантаження схеми');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHotspot = (hotspot: SchematicHotspot) => {
    setActiveHotspotId(hotspot.id);
    // Expand its variants
    setExpandedVariants(prev => ({ ...prev, [hotspot.id]: true }));

    // Scroll corresponding part card into view
    const cardEl = partRefs.current[hotspot.id];
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const toggleVariants = (hotspotId: number) => {
    setExpandedVariants(prev => ({
      ...prev,
      [hotspotId]: !prev[hotspotId]
    }));
  };

  /** «1 варіант / 2 варіанти / 5 варіантів» */
  const pluralVariants = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'варіант';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'варіанти';
    return 'варіантів';
  };

  /**
   * Позиція продається лише тоді, коли вона привʼязана до товару каталогу і той
   * є в наявності. Якщо деталь на схемі є, а товару в каталозі немає — показуємо
   * «Немає в наявності», без ціни й без кнопки «В кошик».
   */
  const isVariantAvailable = (hotspot: SchematicHotspot, variant?: HotspotVariant) => {
    // Привʼязка живе на конкретному варіанті — у кожного своя ціна й наявність.
    // Посилання на рівні ТОЧКИ — це застаріле поле (у нинішній адмінці його
    // вже не виставляють), тому воно має силу лише коли варіант у точки один.
    const variantCount = (hotspot.variants || []).length;
    const linkedProductId =
      variant?.product_id || (variantCount <= 1 ? hotspot.product_id : null);
    if (!linkedProductId) return false;
    if (!variant) return true;
    return variant.inStock !== false;
  };

  const handleAddToCart = (hotspot: SchematicHotspot, variant?: HotspotVariant) => {
    const rate = uahPerUsd > 0 ? uahPerUsd : 40;
    const priceUAH = variant ? variant.priceUAH : (hotspot.variants?.[0]?.priceUAH || 1000);
    const priceUSD = variant?.priceUSD || (priceUAH / rate);

    const cartProduct: Product = {
      id: variant?.product_id || hotspot.product_id || `schematic_${hotspot.id}_${variant?.name || 'default'}`,
      name: `${hotspot.name}${variant ? ` (${variant.name})` : ''}`,
      category: `${schematic?.model || 'Tesla'}, Схеми запчастин`,
      priceUAH: priceUAH,
      priceUSD: priceUSD,
      image: hotspot.product?.image || getFullImageUrl(schematic?.image_url || ''),
      description: `Оригінальний парт-номер: ${hotspot.part_number || 'н/д'}. Вузол: ${schematic?.title || ''}`,
      inStock: variant?.inStock ?? true,
      detail_number: hotspot.part_number || undefined,
      part_type: variant?.type || 'original'
    };

    onAddToCart(cartProduct);

    setAddedToast(`"${cartProduct.name}" додано до кошика!`);
    setTimeout(() => setAddedToast(null), 3000);
  };

  const getFullImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const convertPrice = (priceUAH: number) => {
    const rate = uahPerUsd > 0 ? uahPerUsd : 40;
    if (currency === Currency.USD) {
      return formatCurrency(priceUAH / rate, Currency.USD);
    }
    return formatCurrency(priceUAH, Currency.UAH);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 text-center max-w-7xl">
        <div className="text-gray-400 font-manrope">Завантаження схеми вузла...</div>
      </div>
    );
  }

  if (error || !schematic) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-2xl">
        <AlertCircle size={48} className="mx-auto text-red-600 mb-4" />
        <h2 className="text-xl font-bold font-montserrat text-gray-900 mb-2">
          Схему не знайдено
        </h2>
        <p className="text-sm text-gray-500 font-manrope mb-6">
          {error || 'Запитувана схема не існує або була переміщена.'}
        </p>
        <Link
          to="/schemes"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-tesla-red text-white rounded-xl font-montserrat font-bold text-sm"
        >
          <ArrowLeft size={16} /> Повернутися до каталогу схем
        </Link>
      </div>
    );
  }

  // Count stock details
  const totalVariantsCount = schematic.hotspots.reduce(
    (acc, h) => acc + (h.variants && h.variants.length > 0 ? h.variants.length : 1),
    0
  );
  const inStockCount = schematic.hotspots.reduce((acc, h) => {
    const variants = h.variants && h.variants.length > 0 ? h.variants : [undefined];
    return acc + variants.filter((v) => isVariantAvailable(h, v)).length;
  }, 0);

  const isCompatibleWithGarageCar = activeCar && (
    activeCar.model.toLowerCase() === schematic.model.toLowerCase()
  );

  // Крихти не мають повторювати одне й те саме: у схемах назва вузла часто
  // збігається з назвою підсистеми чи розділу. Прибираємо пропущене, але
  // поточний вузол лишаємо останнім пунктом (жирним).
  const crumbKey = (value?: string | null) =>
    (value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const shopQuery = `model=${encodeURIComponent(schematic.model)}&generation=${encodeURIComponent(schematic.generation)}`;
  const crumbChain = [
    { label: `${schematic.model} ${schematic.generation}`, to: `/schemes?${shopQuery}` },
    schematic.section
      ? {
          label: schematic.section,
          to: `/schemes?${shopQuery}&section=${encodeURIComponent(schematic.section)}`,
        }
      : null,
    schematic.subsystem
      ? {
          label: schematic.subsystem,
          to: `/schemes?${shopQuery}&section=${encodeURIComponent(schematic.section)}&subsystem=${encodeURIComponent(schematic.subsystem)}`,
        }
      : null,
    { label: schematic.title, to: null },
  ].filter(Boolean) as { label: string; to: string | null }[];
  const breadcrumbs = crumbChain.filter((item, idx) => {
    const next = crumbChain[idx + 1];
    return !next || crumbKey(item.label) !== crumbKey(next.label);
  });

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 max-w-7xl">
      {/* Toast Notification */}
      {addedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 size={18} className="text-green-400" />
          <span className="text-sm font-manrope font-medium">{addedToast}</span>
        </div>
      )}

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-gray-500 font-manrope mb-4 overflow-x-auto whitespace-nowrap pb-1">
        <Link to="/" className="hover:text-tesla-red transition-colors">
          Каталог
        </Link>
        <ChevronRight size={12} className="text-gray-400 shrink-0" />
        <Link to="/schemes" className="hover:text-tesla-red transition-colors">
          Схеми запчастин Tesla
        </Link>
        {breadcrumbs.map((crumb, idx) => (
          <span
            key={`crumb-${idx}-${crumb.label}`}
            className="flex items-center gap-1.5 sm:gap-2 shrink-0"
          >
            <ChevronRight size={12} className="text-gray-400 shrink-0" />
            {crumb.to ? (
              <Link to={crumb.to} className="hover:text-tesla-red transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-gray-900 font-semibold">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Header Info */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black font-montserrat text-tesla-dark tracking-tight flex flex-wrap items-center gap-2">
            <span>{schematic.title}</span>
            <span className="text-gray-400 font-light">•</span>
            <span className="text-gray-700 font-semibold text-xl sm:text-2xl">
              {schematic.model} {schematic.generation}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-manrope mt-1">
            Номер на схемі та у списку — посилання на деталь.
          </p>
        </div>

        {/* Compatibility badge */}
        {activeCar && isCompatibleWithGarageCar && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-green-50 border border-green-200/80 rounded-full text-xs font-montserrat font-bold text-green-700 shadow-2xs">
            <ShieldCheck size={16} className="text-green-600 shrink-0" />
            <span>Сумісно з вашим авто: Tesla {activeCar.model} ({activeCar.year})</span>
          </div>
        )}
      </div>

      {/* Two-column layout: Left = Diagram, Right = Parts list */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* LEFT: Schematic diagram with hotspots */}
        <div className="lg:col-span-6 xl:col-span-7 bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm lg:sticky lg:top-24">
          <div className="flex items-center justify-between mb-2 lg:hidden">
            <span className="font-montserrat font-bold text-xs text-gray-800">
              Схема вузла ({schematic.hotspots.length} деталей)
            </span>
            <span className="text-[11px] text-gray-400 font-manrope">
              Клікніть номер для вибору
            </span>
          </div>

          <div className="relative w-full border border-gray-100 rounded-xl sm:rounded-2xl overflow-hidden bg-[#fafafa] flex items-center justify-center select-none min-h-[220px] sm:min-h-[400px]">
            {schematic.image_url ? (
              <img
                src={getFullImageUrl(schematic.image_url)}
                alt={schematic.title}
                className="w-full h-auto object-contain pointer-events-none max-h-[340px] sm:max-h-[500px]"
              />
            ) : (
              <div className="text-gray-400 text-sm font-manrope p-8">Зображення схеми відсутнє</div>
            )}

            {/* Red Hotspot Pins */}
            {schematic.hotspots.map((h) => {
              const isActive = activeHotspotId === h.id;
              return (
                <button
                  key={h.id}
                  style={{
                    left: `${h.x}%`,
                    top: `${h.y}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  onClick={() => handleSelectHotspot(h)}
                  title={`#${h.number}: ${h.name}`}
                  className={`absolute w-5 h-5 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-montserrat font-black text-[9px] sm:text-xs transition-all duration-200 cursor-pointer shadow-sm ${
                    isActive
                      ? 'bg-tesla-red text-white ring-3 ring-red-300 ring-offset-1 scale-120 z-20 shadow-red-500/40'
                      : 'bg-tesla-red text-white hover:scale-110 z-10 hover:shadow'
                  }`}
                >
                  {h.number}
                </button>
              );
            })}
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-gray-400 font-manrope px-1">
            <span>Клікніть на червоний номер, щоб підсвітити деталь у списку</span>
            <span className="font-semibold text-gray-600 hidden sm:inline">{schematic.hotspots.length} деталей на схемі</span>
          </div>
        </div>

        {/* RIGHT: Parts List (Деталі вузла) */}
        <div className="lg:col-span-6 xl:col-span-5 space-y-4">
          {/* Header of parts list */}
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-black font-montserrat text-gray-900">
              Деталі вузла
            </h2>
            <span className="text-xs font-manrope text-gray-500">
              <strong className="text-gray-800">{inStockCount}</strong> в наявності •{' '}
              <strong className="text-gray-800">{totalVariantsCount - inStockCount}</strong> немає в наявності
            </span>
          </div>

          {/* Cards List */}
          <div className="space-y-3">
            {schematic.hotspots.map((h) => {
              const isActive = activeHotspotId === h.id;
              const isExpanded = expandedVariants[h.id] ?? false;
              const variants = h.variants || [];
              const hasMultipleVariants = variants.length > 1;

              // Ціну показуємо лише для позицій, які реально є в каталозі
              const availableVariants = variants.filter((v) => isVariantAvailable(h, v));
              const hotspotAvailable = isVariantAvailable(h, variants[0]);
              const hasAvailable = availableVariants.length > 0;
              const minPrice = hasAvailable
                ? Math.min(...availableVariants.map((v) => v.priceUAH))
                : null;

              return (
                <div
                  key={h.id}
                  ref={(el) => (partRefs.current[h.id] = el)}
                  onClick={() => setActiveHotspotId(h.id)}
                  className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xs ${
                    isActive
                      ? 'border-tesla-red ring-2 ring-tesla-red/15 shadow-md'
                      : 'border-gray-200/90 hover:border-gray-300'
                  }`}
                >
                  {/* Top row of part item */}
                  <div className="p-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Number badge */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectHotspot(h);
                        }}
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-montserrat font-bold text-xs shrink-0 cursor-pointer transition-all ${
                          isActive
                            ? 'bg-tesla-red text-white ring-2 ring-red-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {h.number}
                      </div>

                      <div>
                        {/* Part Number */}
                        {h.part_number && (
                          <div className="font-mono text-xs font-bold text-gray-400 tracking-wider">
                            {h.part_number}
                          </div>
                        )}

                        {/* Name */}
                        <h3 className="font-montserrat font-bold text-sm text-gray-900 mt-0.5 leading-snug">
                          {h.name}
                        </h3>

                        {/* Variants summary badge */}
                        <div className="mt-1.5 flex items-center gap-2">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${
                              hasAvailable ? 'bg-emerald-500' : 'bg-gray-300'
                            }`}
                          ></span>
                          <span className="text-xs text-gray-500 font-manrope">
                            {variants.length > 0
                              ? `${variants.length} ${pluralVariants(variants.length)}`
                              : '1 варіант'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Price & Action Button */}
                    <div className="text-right shrink-0 flex flex-col items-end">
                      {hasAvailable && minPrice !== null ? (
                        <div className="text-xs text-gray-400 font-manrope">
                          {hasMultipleVariants ? 'від ' : ''}
                          <strong className="text-base font-black font-montserrat text-gray-900">
                            {convertPrice(minPrice)}
                          </strong>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 text-[11px] font-manrope font-semibold whitespace-nowrap">
                          Немає в наявності
                        </span>
                      )}

                      {hasMultipleVariants ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleVariants(h.id);
                          }}
                          className={`mt-2 inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-montserrat font-bold transition-all cursor-pointer ${
                            isExpanded
                              ? 'bg-tesla-red text-white shadow-xs'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                          }`}
                        >
                          <span>Обрати</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      ) : hotspotAvailable ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCart(h, variants[0]);
                          }}
                          className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-900 hover:bg-tesla-red text-white rounded-xl text-xs font-montserrat font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                        >
                          <ShoppingCart size={13} />
                          В кошик
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Collapsible Variants List */}
                  {isExpanded && variants.length > 0 && (
                    <div className="bg-gray-50/70 border-t border-gray-100 p-3 space-y-2 animate-in fade-in duration-150">
                      {variants.map((v, vIdx) => (
                        <div
                          key={vIdx}
                          className="bg-white p-3 rounded-xl border border-gray-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                        >
                          {/* Badges & Name */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-montserrat font-bold ${
                                v.type === 'analog'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200/80'
                              }`}
                            >
                              {v.type === 'analog' ? 'Аналог' : 'Оригінал'}
                            </span>

                            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-manrope font-medium">
                              {v.condition === 'used' ? 'Б/В' : 'Новий'}
                            </span>

                            {isVariantAvailable(h, v) ? (
                              <span className="text-[11px] font-manrope text-emerald-600 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                В наявності
                              </span>
                            ) : (
                              <span className="text-[11px] font-manrope text-gray-500 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                Немає в наявності
                              </span>
                            )}

                            {v.name && (
                              <span className="text-xs text-gray-600 font-manrope ml-1">
                                {v.name}
                              </span>
                            )}
                          </div>

                          {/* Price & Add to Cart button */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-center">
                            {isVariantAvailable(h, v) ? (
                              <>
                                <span className="font-montserrat font-black text-sm text-gray-900">
                                  {convertPrice(v.priceUAH)}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddToCart(h, v);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-tesla-red hover:bg-red-700 text-white rounded-xl text-xs font-montserrat font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                                >
                                  <ShoppingCart size={13} />
                                  В кошик
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] font-manrope text-gray-400 font-semibold">
                                Немає в наявності
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
