import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
  ShieldCheck,
  PackageCheck,
  Layers,
  ArrowLeft,
  ExternalLink,
  Plus,
  Minus,
  RotateCcw,
  Maximize2
} from 'lucide-react';
import { api } from '../services/api';
import { Schematic, SchematicHotspot, HotspotVariant, Currency, Product, SavedCar, SchematicSubsystem } from '../types';
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
  const navigate = useNavigate();
  const [schematic, setSchematic] = useState<Schematic | null>(null);
  // Сусідні підсистеми того самого розділу — щоб перемкнутись на «ЗАХИСТИ ЗАДНІ»
  // одним кліком прямо зі схеми, не повертаючись у список.
  const [siblingSubsystems, setSiblingSubsystems] = useState<SchematicSubsystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active highlighted hotspot pin / part
  const [activeHotspotId, setActiveHotspotId] = useState<number | null>(null);

  // --- Зум креслення (як в оригінальному каталозі Tesla) ---
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 8;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const frameRef = useRef<HTMLDivElement | null>(null);
  // Роздільність самого файлу та ширина, у якій він показаний при 100%:
  // співвідношення = межа, до якої збільшення лишається різким (1 піксель = 1 піксель)
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [baseWidth, setBaseWidth] = useState(0);
  const crispLimit = naturalWidth && baseWidth ? naturalWidth / baseWidth : 2;
  const overCrisp = zoom > crispLimit + 0.02;
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  /** Не даємо витягнути креслення за межі кадру */
  const clampPan = (next: { x: number; y: number }, z: number) => {
    const el = frameRef.current;
    const w = el?.clientWidth || 600;
    const h = el?.clientHeight || 400;
    const maxX = ((z - 1) * w) / 2;
    const maxY = ((z - 1) * h) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  };

  const applyZoom = (nextZoom: number) => {
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
    if (z <= 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    setZoom(z);
    setPan((prev) => clampPan(prev, z));
  };

  const zoomIn = () => applyZoom(zoom * 1.5);
  const zoomOut = () => applyZoom(zoom / 1.5);
  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Коліщатко / пінч: на 1x не чіпаємо — сторінка гортається як звично
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && zoom <= 1) return;
      e.preventDefault();
      applyZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const onPanStart = (e: React.PointerEvent) => {
    if (zoom <= 1) return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      originX: pan.x,
      originY: pan.y,
    };
  };

  const onPanMove = (e: React.PointerEvent) => {
    const st = dragRef.current;
    if (!st.active) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.moved && Math.hypot(dx, dy) > 4) st.moved = true;
    if (st.moved) setPan(clampPan({ x: st.originX + dx, y: st.originY + dy }, zoom));
  };

  const onPanEnd = () => {
    const st = dragRef.current;
    st.active = false;
    window.setTimeout(() => {
      st.moved = false;
    }, 0);
  };

  const suppressClickAfterPan = (e: React.MouseEvent) => {
    if (dragRef.current.moved) {
      e.stopPropagation();
      e.preventDefault();
    }
  };
  // «1 деталь / 2 деталі / 5 деталей»
  const pluralParts = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `${n} деталь`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} деталі`;
    return `${n} деталей`;
  };

  // Наведення працює в обидва боки: навів на номер на схемі — підсвітилась
  // деталь у списку; навів на деталь у списку — підсвітився номер на схемі.
  // Наведення зберігаємо КЛЮЧЕМ ГРУПИ (номер деталі на схемі), а не id точки:
  // однакова деталь може стояти на кількох позиціях під одним номером.
  const [hoveredGroupKey, setHoveredGroupKey] = useState<string | null>(null);

  // Деталі з ОДНАКОВИМ номером на схемі — це одна позиція (кронштейн під
  // номером 7 стоїть у двох місцях), тому в списку показуємо їх одним рядком.
  const hotspotGroups = useMemo(() => {
    const list = schematic?.hotspots || [];
    const map = new Map<string, {
      key: string;
      number: number;
      hotspots: SchematicHotspot[];
      lead: SchematicHotspot;
      variants: HotspotVariant[];
    }>();

    list.forEach((h) => {
      const key = `n${h.number}`;
      const existing = map.get(key);
      if (existing) {
        existing.hotspots.push(h);
        (h.variants || []).forEach((v) => {
          const signature = v.product_id || v.name;
          if (!existing.variants.some((x) => (x.product_id || x.name) === signature)) {
            existing.variants.push(v);
          }
        });
        return;
      }
      map.set(key, {
        key,
        number: h.number,
        hotspots: [h],
        lead: h,
        variants: [...(h.variants || [])],
      });
    });

    return Array.from(map.values()).sort((a, b) => a.number - b.number);
  }, [schematic]);

  const groupKeyByHotspotId = useMemo(() => {
    const map: Record<number, string> = {};
    hotspotGroups.forEach((group) => {
      group.hotspots.forEach((h) => {
        map[h.id] = group.key;
      });
    });
    return map;
  }, [hotspotGroups]);

  const activeGroupKey =
    activeHotspotId !== null ? groupKeyByHotspotId[activeHotspotId] ?? null : null;


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
      // Жодну точку не вибираємо й не розкриваємо автоматично: усе біле, поки
      // користувач сам не натисне номер або «Обрати» (клієнт просив саме так).
      setActiveHotspotId(null);
      setExpandedVariants({});
    } catch (err: any) {
      setError(err.message || 'Помилка завантаження схеми');
    } finally {
      setLoading(false);
    }
  };

  // Сусідні підсистеми розділу цієї схеми: дають перемкнутись на інший вузол
  // («ЗАХИСТИ ЗАДНІ») одним кліком, не виходячи зі схеми.
  useEffect(() => {
    if (!schematic?.model || !schematic?.section) {
      setSiblingSubsystems([]);
      return;
    }
    let cancelled = false;
    api
      .getSchematicSections({ model: schematic.model })
      .then((list) => {
        if (cancelled) return;
        const group = list.find((g) => g.section === schematic.section);
        setSiblingSubsystems(group?.subsystems || []);
      })
      .catch(() => {
        if (!cancelled) setSiblingSubsystems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [schematic?.model, schematic?.section]);

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

  /**
   * Куди веде клік по деталі: картка товару в каталозі. Привʼязка та сама, що
   * для кошика — варіант має свій product_id, а посилання рівня точки діє лише
   * коли варіант один (у нинішній адмінці його вже не виставляють).
   */
  const productPathFor = (hotspot: SchematicHotspot, variant?: HotspotVariant) => {
    const variantCount = (hotspot.variants || []).length;
    const linkedProductId =
      variant?.product_id || (variantCount <= 1 ? hotspot.product_id : null);
    return linkedProductId ? `/product/${linkedProductId}` : null;
  };

  const handleAddToCart = (hotspot: SchematicHotspot, variant?: HotspotVariant) => {
    const rate = uahPerUsd > 0 ? uahPerUsd : 40;
    const priceUAH = variant ? variant.priceUAH : (hotspot.variants?.[0]?.priceUAH || 1000);
    const priceUSD = variant?.priceUSD || (priceUAH / rate);

    // Для варіанта, привʼязаного до каталогу, це вже конкретний товар: беремо
    // його назву й фото. Креслення лишається тільки як крайній варіант.
    const linkedToCatalog = Boolean(variant?.product_id || hotspot.product_id);
    const productImage = getFullImageUrl(
      variant?.image || hotspot.product?.image || ''
    );

    const cartProduct: Product = {
      id: variant?.product_id || hotspot.product_id || `schematic_${hotspot.id}_${variant?.name || 'default'}`,
      name: linkedToCatalog
        ? (variant?.name || hotspot.name)
        : `${hotspot.name}${variant ? ` (${variant.name})` : ''}`,
      category: `${schematic?.model || 'Tesla'}, Схеми запчастин`,
      priceUAH: priceUAH,
      priceUSD: priceUSD,
      image: productImage || getFullImageUrl(schematic?.image_url || ''),
      description: `Оригінальний парт-номер: ${hotspot.part_number || 'н/д'}. Вузол: ${schematic?.title || ''}`,
      inStock: variant?.inStock ?? true,
      detail_number: hotspot.part_number || undefined,
      part_type: hotspot.product?.part_type || variant?.type || 'original'
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

  // Count stock details — по унікальних позиціях, а не по точках на кресленні
  const totalVariantsCount = hotspotGroups.reduce(
    (acc, g) => acc + (g.variants.length > 0 ? g.variants.length : 1),
    0
  );
  const inStockCount = hotspotGroups.reduce((acc, g) => {
    const variants = g.variants.length > 0 ? g.variants : [undefined];
    return acc + variants.filter((v) => isVariantAvailable(g.lead, v)).length;
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
  // Фіксовані шляхи повернення: підсистеми розділу (крок, де обирають вузол) та
  // всі схеми розділу. Обидва не залежать від історії браузера.
  const backToPath = schematic.section
    ? `/schemes?${shopQuery}&section=${encodeURIComponent(schematic.section)}`
    : `/schemes?${shopQuery}`;
  const allSchemesPath = schematic.section
    ? `/schemes?${shopQuery}&section=${encodeURIComponent(schematic.section)}&subsystem=all`
    : `/schemes?${shopQuery}&all=1`;
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

      {/* Повернення до вибору підсистеми: велика кнопка — на телефоні легко влучити.
          Раніше тут був navigate(-1), тобто крок у ДОВІЛЬНЕ місце історії — через
          це зі схеми можна було вилетіти аж на вибір моделі («повертає на Model 3»).
          Тепер це фіксоване посилання: підсистеми того самого розділу — саме те
          місце, де обирають «ЗАХИСТИ ПЕРЕДНІ / ЗАХИСТИ ЗАДНІ». */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Link
          to={backToPath}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:border-tesla-red hover:text-tesla-red font-montserrat font-bold text-xs sm:text-sm transition-colors cursor-pointer shadow-2xs"
        >
          <ArrowLeft size={16} />
          {schematic.section ? 'До підсистем розділу' : 'До вибору розділу'}
        </Link>
        {schematic.section && (
          <Link
            to={allSchemesPath}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-gray-500 hover:border-tesla-red hover:text-tesla-red font-manrope font-medium text-xs sm:text-sm transition-colors"
          >
            Усі схеми розділу
          </Link>
        )}
      </div>

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

      {/* Швидке перемикання підсистем: зі схеми одразу видно сусідні вузли цього
          розділу, тож «ЗАХИСТИ ПЕРЕДНІ» → «ЗАХИСТИ ЗАДНІ» — один клік. */}
      {siblingSubsystems.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-[11px] font-montserrat font-bold uppercase tracking-wider text-gray-400 shrink-0">
            Підсистеми розділу
          </span>
          {siblingSubsystems.map((sub) => {
            const isCurrent = crumbKey(sub.subsystem) === crumbKey(schematic.subsystem);
            return isCurrent ? (
              <span
                key={sub.subsystem}
                className="px-3 py-1.5 rounded-xl bg-tesla-red text-white text-xs font-montserrat font-bold"
              >
                {sub.subsystem}
              </span>
            ) : (
              <Link
                key={sub.subsystem}
                to={`/schemes?${shopQuery}&section=${encodeURIComponent(schematic.section)}&subsystem=${encodeURIComponent(sub.subsystem)}`}
                className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:border-tesla-red hover:text-tesla-red text-xs font-montserrat font-bold transition-colors"
              >
                {sub.subsystem}
              </Link>
            );
          })}
        </div>
      )}

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
              Схема вузла ({pluralParts(hotspotGroups.length)})
            </span>
            <span className="text-[11px] text-gray-400 font-manrope">
              Клікніть номер для вибору
            </span>
          </div>

          <div
            ref={frameRef}
            className={`relative w-full border border-gray-100 rounded-xl sm:rounded-2xl overflow-hidden bg-[#fafafa] select-none min-h-[220px] sm:min-h-[400px] ${
              zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
            onPointerDown={onPanStart}
            onPointerMove={onPanMove}
            onPointerUp={onPanEnd}
            onPointerLeave={onPanEnd}
            onDoubleClick={(e) => {
              // Подвійний клік по кнопках (тулбар, повний екран, точки) не має
              // скидати масштаб — реагуємо лише на подвійний клік по кресленню
              if ((e.target as HTMLElement).closest('button')) return;
              if (zoom > 1) resetZoom();
              else applyZoom(3);
            }}
            style={{ touchAction: zoom > 1 ? 'none' : 'auto' }}
          >
            {/* Тулбар масштабу — як в оригінальному каталозі Tesla.
                stopPropagation важливий: інакше два швидкі кліки по «+» летять
                у полотно як dblclick і скидають масштаб на 100 %. */}
            <div
              className="absolute left-2 top-2 z-30 flex flex-col items-center gap-0.5 rounded-2xl bg-white/95 backdrop-blur border border-gray-200 shadow-md p-1"
              onDoubleClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); zoomIn(); }}
                disabled={zoom >= MAX_ZOOM}
                title="Збільшити"
                className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${
                  zoom >= MAX_ZOOM ? 'text-gray-300' : 'text-gray-700 hover:bg-red-50 hover:text-tesla-red cursor-pointer'
                }`}
              >
                <Plus size={18} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); resetZoom(); }}
                title="Скинути масштаб"
                className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-500 hover:bg-red-50 hover:text-tesla-red transition-colors cursor-pointer"
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); zoomOut(); }}
                disabled={zoom <= MIN_ZOOM}
                title="Зменшити"
                className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${
                  zoom <= MIN_ZOOM ? 'text-gray-300' : 'text-gray-700 hover:bg-red-50 hover:text-tesla-red cursor-pointer'
                }`}
              >
                <Minus size={18} />
              </button>
              <span
                className={`text-[10px] font-montserrat font-bold pb-0.5 ${
                  overCrisp ? 'text-amber-600' : 'text-gray-500'
                }`}
                title={
                  overCrisp
                    ? `Файл схеми ${naturalWidth}px — до ${Math.round(crispLimit * 100)}% збільшення різке, далі зображення розтягується понад оригінал. Щоб наближати без втрат, завантажте більшу картинку в адмінці.`
                    : `Різке збільшення до ${Math.round(crispLimit * 100)}%`
                }
              >
                {Math.round(zoom * 100)}%
              </span>
            </div>

            {/* На весь екран */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const el = frameRef.current?.parentElement;
                if (!el) return;
                if (document.fullscreenElement) document.exitFullscreen();
                else el.requestFullscreen?.().catch(() => {});
              }}
              title="На весь екран"
              onDoubleClick={(e) => e.stopPropagation()}
              className="absolute right-2 top-2 z-30 w-8 h-8 flex items-center justify-center rounded-xl bg-white/95 backdrop-blur border border-gray-200 shadow-md text-gray-600 hover:text-tesla-red transition-colors cursor-pointer"
            >
              <Maximize2 size={15} />
            </button>

            {/* Все, що масштабується разом: креслення + точки деталей */}
            <div
              className="relative w-full"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: dragRef.current.active ? 'none' : 'transform 120ms ease-out',
              }}
              onClickCapture={suppressClickAfterPan}
            >
            {schematic.image_url ? (
              <img
                src={getFullImageUrl(schematic.image_url)}
                alt={schematic.title}
                draggable={false}
                onLoad={(e) => {
                  setNaturalWidth(e.currentTarget.naturalWidth);
                  setBaseWidth(e.currentTarget.clientWidth);
                }}
                className="block w-full h-auto object-contain pointer-events-none"
              />
            ) : (
              <div className="text-gray-400 text-sm font-manrope p-8">Зображення схеми відсутнє</div>
            )}

            {/* Red Hotspot Pins */}
            {schematic.hotspots.map((h) => {
              const groupKey = groupKeyByHotspotId[h.id];
              const isActive = activeGroupKey === groupKey;
              const isHovered = hoveredGroupKey === groupKey;
              return (
                <button
                  key={h.id}
                  style={{
                    left: `${h.x}%`,
                    top: `${h.y}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  onClick={() => handleSelectHotspot(h)}
                  onMouseEnter={() => setHoveredGroupKey(groupKey)}
                  onMouseLeave={() => setHoveredGroupKey((prev) => (prev === groupKey ? null : prev))}
                  onFocus={() => setHoveredGroupKey(groupKey)}
                  onBlur={() => setHoveredGroupKey((prev) => (prev === groupKey ? null : prev))}
                  title={`#${h.number}: ${h.name}`}
                  className={`absolute w-5 h-5 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-montserrat font-black text-[9px] sm:text-xs transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-white text-tesla-red ring-4 sm:ring-[5px] ring-tesla-red scale-[1.45] z-40 shadow-lg shadow-red-500/50 animate-pulse'
                      : isHovered
                        ? 'bg-tesla-red text-white ring-4 ring-red-200 scale-125 z-30 shadow-lg shadow-red-500/40'
                        : 'bg-tesla-red text-white hover:scale-110 z-10 shadow-sm hover:shadow'
                  }`}
                >
                  {h.number}
                </button>
              );
            })}
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-gray-400 font-manrope px-1">
            <span className="hidden sm:inline">
              Наведіть на номер — підсвітиться деталь у списку (і навпаки). Клік закріплює вибір
              • масштаб: +/− , коліщатко з Ctrl або подвійний клік, тягніть мишкою щоб рухати
            </span>
            <span className="sm:hidden">
              Натисніть на червоний номер — деталь підсвітиться у списку
            </span>
            <span className="font-semibold text-gray-600 hidden sm:inline">
              {pluralParts(hotspotGroups.length)} на схемі
            </span>
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
            {hotspotGroups.map((group) => {
              const h = group.lead;
              const isActive = activeGroupKey === group.key;
              const isHovered = hoveredGroupKey === group.key;
              const isExpanded = expandedVariants[h.id] ?? false;
              const variants = group.variants;
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
                  key={group.key}
                  ref={(el) => (partRefs.current[h.id] = el)}
                  onClick={() => handleSelectHotspot(h)}
                  onMouseEnter={() => setHoveredGroupKey(group.key)}
                  onMouseLeave={() => setHoveredGroupKey((prev) => (prev === group.key ? null : prev))}
                  className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xs ${
                    isActive
                      ? 'border-tesla-red ring-2 ring-tesla-red/15 shadow-md'
                      : isHovered
                        ? 'border-tesla-red/60 bg-red-50/40 ring-1 ring-red-100 shadow-sm'
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
                          isActive || isHovered
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
                          {productPathFor(h) ? (
                            <Link
                              to={productPathFor(h) as string}
                              onClick={(e) => e.stopPropagation()}
                              title="Відкрити картку товару"
                              className="hover:text-tesla-red underline decoration-gray-300 decoration-dotted underline-offset-2 transition-colors"
                            >
                              {h.name}
                            </Link>
                          ) : (
                            h.name
                          )}
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
                              productPathFor(h, v) ? (
                                <Link
                                  to={productPathFor(h, v) as string}
                                  onClick={(e) => e.stopPropagation()}
                                  title="Відкрити картку товару"
                                  className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-tesla-red font-manrope ml-1 underline decoration-dotted underline-offset-2 transition-colors"
                                >
                                  {v.name}
                                  <ExternalLink size={12} className="shrink-0 opacity-70" />
                                </Link>
                              ) : (
                                <span className="text-xs text-gray-600 font-manrope ml-1">
                                  {v.name}
                                </span>
                              )
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
