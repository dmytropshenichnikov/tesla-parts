import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  ArrowLeft,
  Upload,
  Layers,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Search,
  ExternalLink,
  DollarSign,
  Target,
  Info,
  X,
  Check,
  Link as LinkIcon,
  Unlink,
  Package,
  Sparkles,
  Copy
} from 'lucide-react';
import { api } from '../services/api';
import { Schematic, SchematicSummary, SchematicHotspot, HotspotVariant, Product, SchematicModelOption, SchematicSectionOption, CatalogTreeCategory } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-1.5 align-middle">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => {
          e.preventDefault();
          setShow(!show);
        }}
        className="text-gray-400 hover:text-red-600 transition-colors p-0.5 rounded-full hover:bg-gray-100 cursor-pointer"
        aria-label="Інформація"
      >
        <Info size={13} />
      </button>
      {show && (
        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3 bg-gray-950 text-white text-[11px] font-manrope font-normal normal-case rounded-xl shadow-2xl z-50 pointer-events-none leading-relaxed border border-gray-800 animate-in fade-in zoom-in-95 duration-150">
          <span className="relative z-10 block text-gray-200">{text}</span>
          <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-5 border-x-transparent border-t-5 border-t-gray-950" />
        </span>
      )}
    </span>
  );
};

/** Скільки пікселів курсор має відійти, щоб це вважалось перетягуванням, а не кліком. */
const DRAG_THRESHOLD_PX = 5;

/**
 * Незбережена чернетка схеми в localStorage.
 * Якщо сесія обірвалась або вкладка закрилась — роботу можна відновити.
 */
const DRAFT_PREFIX = 'schematicDraft:';
/** Пункт списку, який перемикає на ручне введення */
const CUSTOM_OPTION = '__custom__';
const draftKeyFor = (id?: number) => `${DRAFT_PREFIX}${id && id > 0 ? id : 'new'}`;

/**
 * Моделі та покоління більше не дублюються тут хардкодом — вони приходять
 * з категорій каталогу через `/schematics/model-options`. Так адмінка,
 * магазин і каталог завжди показують один і той самий набір.
 */
const pickDefaultOption = (options: SchematicModelOption[]): SchematicModelOption | null => {
  if (options.length === 0) return null;
  return (
    options.find((o) => o.category.toLowerCase() === 'model 3 highland') ||
    options.find((o) => !o.is_accessory) ||
    options[0]
  );
};

/** Знаходить категорію, під якою збережено схему (модель + покоління). */
const resolveOption = (
  options: SchematicModelOption[],
  model?: string,
  generation?: string
): SchematicModelOption | null => {
  if (!model || options.length === 0) return null;
  const sameModel = options.filter((o) => o.model.toLowerCase() === model.toLowerCase());
  if (sameModel.length === 0) return null;
  if (generation) {
    // Спершу конкретна категорія-варіант (напр. «Model 3 Highland»)
    const variant = sameModel.find(
      (o) => o.category !== o.model && o.generations.includes(generation)
    );
    if (variant) return variant;
    const byList = sameModel.find((o) => o.generations.includes(generation));
    if (byList) return byList;
  }
  return sameModel.find((o) => o.category === o.model) || sameModel[0];
};

export const SchematicManager: React.FC = () => {
  const [schematics, setSchematics] = useState<SchematicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter state for list
  const [filterModel, setFilterModel] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Моделі/покоління — з категорій каталогу (єдине джерело істини)
  const [modelOptions, setModelOptions] = useState<SchematicModelOption[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  // Категорія, обрана у формі (назва категорії, а не значення schematic.model)
  const [formCategory, setFormCategory] = useState<string>('');

  // Editing state
  const [editingSchematic, setEditingSchematic] = useState<Schematic | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Selected hotspot for editing
  const [selectedHotspotIdx, setSelectedHotspotIdx] = useState<number | null>(null);

  // Reposition mode and Drag state for Hotspot Pins
  const [isRepositioningMode, setIsRepositioningMode] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const hasDragged = useRef<boolean>(false);
  // Зсув курсора відносно центру піна на момент натискання
  const pinDragOffset = useRef<{ dx: number; dy: number } | null>(null);

  // Структура каталогу: id підкатегорії → id категорії (моделі) і назад.
  // Саме вона робить фільтр товарів точним, а не по вільному тексту `category`.
  const [catalogTree, setCatalogTree] = useState<CatalogTreeCategory[]>([]);

  /** id підкатегорії → місце в каталозі (модель, розділ, підсистема) */
  const subcategoryIndex = useMemo(() => {
    const byId = new Map<
      number,
      { categoryId: number; categoryName: string; name: string; parentId: number | null }
    >();
    for (const category of catalogTree) {
      for (const sub of category.subcategories || []) {
        byId.set(sub.id, {
          categoryId: category.id,
          categoryName: category.name,
          name: sub.name,
          parentId: sub.parent_id ?? null,
        });
      }
    }
    return byId;
  }, [catalogTree]);

  /**
   * Де товар лежить у каталозі: модель, розділ і підсистема.
   * Це і є «тягнеться з каталогу» — і для фільтра, і для розділу схеми.
   */
  const resolveProductPlacement = (product: Product) => {
    const ids = [
      ...(product.subcategory_ids || []),
      ...(product.subcategory_id ? [product.subcategory_id] : []),
    ];
    for (const id of ids) {
      const entry = subcategoryIndex.get(id);
      if (!entry) continue;
      const parent = entry.parentId ? subcategoryIndex.get(entry.parentId) : null;
      return {
        categoryName: entry.categoryName,
        section: parent ? parent.name : entry.name,
        subsystem: parent ? entry.name : '',
        subcategoryName: entry.name,
      };
    }
    return null;
  };


  // Розділи/підсистеми з каталогу для обраної моделі
  const [sectionOptions, setSectionOptions] = useState<SchematicSectionOption[]>([]);
  const [sectionMode, setSectionMode] = useState<'catalog' | 'custom'>('catalog');
  const [subsystemMode, setSubsystemMode] = useState<'catalog' | 'custom'>('catalog');

  // Чернетка: знімок схеми на момент відкриття + пропозиція відновити
  const loadedSnapshot = useRef<string>('');
  const [draftToRestore, setDraftToRestore] = useState<{ savedAt: string; schematic: Schematic } | null>(null);

  // Catalog products for linking
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState<string>('');

  // Буфер обміну для точок: одна деталь може стояти у кількох місцях схеми,
  // тому точку можна скопіювати (⌘C) і вставити (⌘V).
  const [pointClipboard, setPointClipboard] = useState<SchematicHotspot | null>(null);

  // Add/Link Variant Modal state
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [variantModalTarget, setVariantModalTarget] = useState<'new' | { hotspotIdx: number; varIdx: number }>('new');
  const [variantModalStep, setVariantModalStep] = useState<'choice' | 'search'>('choice');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [filterBySchematicModel, setFilterBySchematicModel] = useState(true);

  // Image canvas ref
  const imageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadModelOptions();
    api.getCategoriesTree().then(setCatalogTree).catch(() => setCatalogTree([]));
  }, []);

  // Після повторного входу (сесія протухла) підтягуємо дані заново —
  // щоб не лишались банери помилок від невдалих запитів
  useEffect(() => {
    const handleTokensRefreshed = () => {
      loadModelOptions();
      loadSchematics();
    };
    window.addEventListener('admin-tokens-refreshed', handleTokensRefreshed);
    return () => window.removeEventListener('admin-tokens-refreshed', handleTokensRefreshed);
  }, []);

  useEffect(() => {
    loadSchematics();
  }, [filterModel, searchQuery]);

  // Каталог товарів вантажимо один раз: раніше він перезавантажувався на кожен
  // символ у пошуку списку схем, через що модалка «прив'язати товар» висла.
  useEffect(() => {
    loadCatalogProducts();
  }, []);

  const loadModelOptions = async () => {
    try {
      const options = await api.getSchematicModelOptions();
      setModelOptions(options);
      setOptionsError(null);
      return options;
    } catch (err: any) {
      setOptionsError(err.message || 'Не вдалося завантажити моделі з категорій');
      return [];
    }
  };

  const loadSchematics = async () => {
    try {
      setLoading(true);
      const data = await api.getSchematics({
        model: filterModel || undefined,
        q: searchQuery || undefined
      });
      setSchematics(data);
    } catch (err: any) {
      setError(err.message || 'Помилка завантаження схем');
    } finally {
      setLoading(false);
    }
  };

  const loadCatalogProducts = async () => {
    try {
      setCatalogLoading(true);
      const products = await api.getProducts();
      setCatalogProducts(products || []);
    } catch (err) {
      console.error('Failed to load products for link:', err);
    } finally {
      setCatalogLoading(false);
    }
  };

  /**
   * Товар підходить під схему? `category` у товару — список моделей через кому.
   * Приймаємо кілька варіантів: і точну категорію схеми («Model 3 Highland»),
   * і базову модель («Model 3») — товар для всієї лінійки теж підходить.
   */
  const productMatchesModel = (product: Product, models: string[]) => {
    const wanted = models.map((m) => (m || '').trim().toLowerCase()).filter(Boolean);
    if (wanted.length === 0) return true;
    const tokens = (product.category || '')
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean);
    if (tokens.length > 0) return tokens.some((token) => wanted.includes(token));
    // Якщо модель у товару не заповнена — шукаємо в назві
    const name = (product.name || '').toLowerCase();
    return wanted.some((model) => name.includes(model));
  };

  /**
   * Точна перевірка за КАТАЛОГОМ: товар лежить у підкатегорії, підкатегорія —
   * у категорії-моделі. Це надійніше за вільний текст `product.category`,
   * який міг розходитись із реальним деревом каталогу.
   */
  const productMatchesModelExact = (product: Product, models: string[]) => {
    const wanted = models.map((m) => (m || '').trim().toLowerCase()).filter(Boolean);
    if (wanted.length === 0) return true;
    const placement = resolveProductPlacement(product);
    if (!placement) return false;
    return wanted.includes(placement.categoryName.toLowerCase());
  };

  /**
   * Прибирає всі розділювачі з артикулів: «1771474-00-K» → «177147400k».
   * У каталозі номери часто без дефісів, тому пошук має бути нечутливим до них.
   */
  const normalizeCode = (value?: string) =>
    (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Фільтр каталогу рахуємо один раз на зміну, а не двічі щорендера
  const filteredCatalogProducts = useMemo(() => {
    if (!editingSchematic) return [];

    // Фільтруємо СТРОГО за категорією схеми: якщо схема для «Model 3 Highland»,
    // показуємо лише товари цієї категорії — товари «Model 3» НЕ домішуємо.
    // Так само й навпаки: категорії не змішуються.
    const modelScope = [formCategory || editingSchematic.model].filter(Boolean);

    const raw = productSearchQuery.trim().toLowerCase();
    // Пошук не залежить від порядку слів: «захист переднього бампера»
    // знаходить «Захист нижній переднього бампера» — усі слова мають бути
    // присутні, але в будь-якому місці й порядку.
    const tokens = raw.split(/\s+/).filter(Boolean);
    const code = normalizeCode(productSearchQuery);

    return catalogProducts.filter((product) => {
      if (filterBySchematicModel) {
        // Каталог — джерело істини. Вільний текст лишаємо запасним варіантом
        // лише для товарів, які ще не розкладені по підкатегоріях.
        const placement = resolveProductPlacement(product);
        const matches = placement
          ? productMatchesModelExact(product, modelScope)
          : productMatchesModel(product, modelScope);
        if (!matches) return false;
      }
      if (tokens.length === 0) return true;

      const haystack = [
        product.name,
        product.description,
        product.search_keywords,
        product.detail_number,
        product.cross_number,
        product.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (tokens.every((token) => haystack.includes(token))) return true;

      // Артикули порівнюємо ще й без дефісів: «1771474-00-K» → «177147400k»
      if (!code) return false;
      const codes = [product.detail_number, product.cross_number, product.id].map(normalizeCode);
      return codes.some((value) => value.includes(code)) || normalizeCode(product.name).includes(code);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    catalogProducts,
    productSearchQuery,
    filterBySchematicModel,
    editingSchematic?.model,
    formCategory,
  ]);

  /** Копіює точку в буфер разом із номером, парт-номером і варіантами. */
  const handleCopyHotspot = (index: number) => {
    if (!editingSchematic) return;
    const source = editingSchematic.hotspots[index];
    if (!source) return;
    setPointClipboard({ ...source, variants: (source.variants || []).map((v) => ({ ...v })) });
    setSuccessMsg(`Точку #${source.number} скопійовано. Натисніть ⌘V, щоб вставити копію.`);
  };

  /**
   * Вставляє копію скопійованої точки.
   *
   * Номер НЕ змінюємо: та сама деталь у різних місцях схеми позначається тим
   * самим номером — саме для цього й потрібна копія. Парт-номер, назва та
   * варіанти теж переносяться як є.
   */
  const handlePasteHotspot = (source?: SchematicHotspot | null) => {
    if (!editingSchematic) return;
    const original = source || pointClipboard;
    if (!original) return;

    const copy: SchematicHotspot = {
      ...original,
      id: undefined,
      x: Math.min(99.5, Math.max(0.5, Number((original.x + 5).toFixed(1)))),
      y: Math.min(99.5, Math.max(0.5, Number((original.y + 5).toFixed(1)))),
      variants: (original.variants || []).map((v) => ({ ...v, id: undefined })),
    };

    const updated = [...editingSchematic.hotspots, copy];
    setEditingSchematic({ ...editingSchematic, hotspots: updated });
    setSelectedHotspotIdx(updated.length - 1);
    // Одразу вмикаємо режим розміщення: клік по схемі поставить копію точно
    setIsRepositioningMode(true);
    setSuccessMsg(
      `Точку #${copy.number} вставлено (номер збережено). Клікніть на схемі, щоб поставити її в потрібне місце.`
    );
  };

  /** Дублює точку одним кліком (те саме, що ⌘C + ⌘V). */
  const handleDuplicateHotspot = (index: number) => {
    if (!editingSchematic) return;
    const source = editingSchematic.hotspots[index];
    if (!source) return;
    handlePasteHotspot(source);
  };

  const handleCreateNew = async () => {
    // Модель/покоління беремо з категорій каталогу, а не з хардкоду.
    const options = modelOptions.length > 0 ? modelOptions : await loadModelOptions();
    const preset = pickDefaultOption(options);
    const blank: Schematic = {
      id: 0,
      title: '',
      model: preset?.model || '',
      generation: preset?.generation || '',
      section: 'НАРУЖНЫЕ КРЕПЛЕНИЯ',
      subsystem: 'Защита днища и диффузор',
      image_url: '',
      sort_order: 1,
      hotspots: []
    };
    setIsNew(true);
    setFormCategory(preset?.category || '');
    setEditingSchematic(blank);
    setSelectedHotspotIdx(null);
    loadedSnapshot.current = JSON.stringify(blank);
    offerDraftIfAny(0, blank);
  };

  const handleEdit = async (id: number) => {
    try {
      setLoading(true);
      const data = await api.getSchematic(id);
      const options = modelOptions.length > 0 ? modelOptions : await loadModelOptions();
      const matched = resolveOption(options, data.model, data.generation);
      setFormCategory(matched?.category || data.model);
      setEditingSchematic(data);
      setIsNew(false);
      setSelectedHotspotIdx(data.hotspots.length > 0 ? 0 : null);
      loadedSnapshot.current = JSON.stringify(data);
      offerDraftIfAny(id, data);
    } catch (err: any) {
      setError(err.message || 'Помилка завантаження схеми');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Ви впевнені, що хочете видалити цю схему та всі її точки?')) return;
    try {
      await api.deleteSchematic(id);
      setSuccessMsg('Схему видалено');
      loadSchematics();
    } catch (err: any) {
      setError(err.message || 'Помилка видалення');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingSchematic) return;

    try {
      setUploadingImage(true);
      const res = await api.uploadSchematicImage(file);
      setEditingSchematic({
        ...editingSchematic,
        image_url: res.image_url
      });
      setSuccessMsg('Зображення завантажено');
    } catch (err: any) {
      setError(err.message || 'Помилка завантаження зображення');
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePinMouseDown = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedHotspotIdx(idx);
    setDraggingIdx(idx);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    hasDragged.current = false;

    // Запам'ятовуємо, у якій саме точці піна натиснули. Без цього пін
    // «стрибав» центром під курсор навіть від найменшого зсуву мишки.
    const container = imageContainerRef.current;
    const hotspot = editingSchematic?.hotspots[idx];
    if (container && hotspot) {
      const rect = container.getBoundingClientRect();
      pinDragOffset.current = {
        dx: e.clientX - (rect.left + (hotspot.x / 100) * rect.width),
        dy: e.clientY - (rect.top + (hotspot.y / 100) * rect.height),
      };
    } else {
      pinDragOffset.current = { dx: 0, dy: 0 };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingIdx === null || !imageContainerRef.current || !editingSchematic) return;

      // Поки курсор не відійшов від точки натискання — це клік, а не перетягування.
      // Нічого не рухаємо, інакше пін «стрибає» під курсор.
      const start = dragStartPos.current;
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) <= DRAG_THRESHOLD_PX) {
        return;
      }
      hasDragged.current = true;

      const rect = imageContainerRef.current.getBoundingClientRect();
      const offset = pinDragOffset.current || { dx: 0, dy: 0 };
      const xPx = e.clientX - offset.dx - rect.left;
      const yPx = e.clientY - offset.dy - rect.top;

      const xPercent = Math.max(0.5, Math.min(99.5, Math.round((xPx / rect.width) * 1000) / 10));
      const yPercent = Math.max(0.5, Math.min(99.5, Math.round((yPx / rect.height) * 1000) / 10));

      const updated = [...editingSchematic.hotspots];
      updated[draggingIdx] = {
        ...updated[draggingIdx],
        x: xPercent,
        y: yPercent
      };
      setEditingSchematic({
        ...editingSchematic,
        hotspots: updated
      });
    };

    const handleMouseUp = () => {
      if (draggingIdx !== null) {
        setDraggingIdx(null);
        dragStartPos.current = null;
      }
    };

    if (draggingIdx !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingIdx, editingSchematic]);

  // Canvas click to add a new pin or reposition selected pin
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current || !editingSchematic) return;
    if (hasDragged.current) {
      hasDragged.current = false;
      return;
    }

    // Клік по схемі забирає фокус з полів форми й переносить його на полотно,
    // щоб ⌘C/⌘V працювали з точками, а не з текстом в інпуті
    focusCanvas();

    const rect = imageContainerRef.current.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;

    const xPercent = Math.max(0.5, Math.min(99.5, Math.round((xPx / rect.width) * 1000) / 10));
    const yPercent = Math.max(0.5, Math.min(99.5, Math.round((yPx / rect.height) * 1000) / 10));

    // If reposition mode is active, move the selected hotspot!
    if (isRepositioningMode && selectedHotspotIdx !== null) {
      const updated = [...editingSchematic.hotspots];
      const pinNum = updated[selectedHotspotIdx]?.number || selectedHotspotIdx + 1;
      updated[selectedHotspotIdx] = {
        ...updated[selectedHotspotIdx],
        x: xPercent,
        y: yPercent
      };
      setEditingSchematic({
        ...editingSchematic,
        hotspots: updated
      });
      setIsRepositioningMode(false);
      setSuccessMsg(`Позицію точки #${pinNum} успішно змінено на [${xPercent}%, ${yPercent}%]!`);
      return;
    }

    // Check if clicked near an existing pin
    const clickedExistingIdx = editingSchematic.hotspots.findIndex(h => {
      const pinX = (h.x / 100) * rect.width;
      const pinY = (h.y / 100) * rect.height;
      const dist = Math.hypot(pinX - xPx, pinY - yPx);
      return dist <= 20;
    });

    if (clickedExistingIdx >= 0) {
      setSelectedHotspotIdx(clickedExistingIdx);
      return;
    }

    // Next pin number
    const maxNum = editingSchematic.hotspots.reduce((acc, h) => Math.max(acc, h.number), 0);
    const newNumber = maxNum + 1;

    const newHotspot: SchematicHotspot = {
      number: newNumber,
      x: xPercent,
      y: yPercent,
      name: `Деталь #${newNumber}`,
      part_number: '',
      sort_order: newNumber,
      variants: [
        {
          name: 'Оригинал новый',
          type: 'original',
          condition: 'new',
          priceUAH: 1000,
          priceUSD: 25,
          inStock: true
        }
      ]
    };

    const updated = [...editingSchematic.hotspots, newHotspot];
    setEditingSchematic({
      ...editingSchematic,
      hotspots: updated
    });
    setSelectedHotspotIdx(updated.length - 1);
  };

  const handleUpdateHotspot = (index: number, field: keyof SchematicHotspot, value: any) => {
    if (!editingSchematic) return;
    const updated = [...editingSchematic.hotspots];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setEditingSchematic({
      ...editingSchematic,
      hotspots: updated
    });
  };

  const handleDeleteHotspot = (index: number) => {
    if (!editingSchematic) return;
    const updated = editingSchematic.hotspots.filter((_, i) => i !== index);
    setEditingSchematic({
      ...editingSchematic,
      hotspots: updated
    });
    setSelectedHotspotIdx(updated.length > 0 ? Math.max(0, index - 1) : null);
  };

  /** Знімає фокус з полів і ставить його на полотно схеми. */
  const focusCanvas = () => {
    (document.activeElement as HTMLElement | null)?.blur();
    imageContainerRef.current?.focus({ preventScroll: true });
  };

  /**
   * Місце схеми в каталозі, виведене з її ж товарів: беремо перший варіант,
   * привʼязаний до товару, і дивимось, у якій підкатегорії він лежить.
   */
  const schemePlacement = useMemo(() => {
    if (!editingSchematic) return null;
    for (const hotspot of editingSchematic.hotspots) {
      for (const variant of hotspot.variants || []) {
        if (!variant.product_id) continue;
        const product = catalogProducts.find((p) => p.id === variant.product_id);
        if (!product) continue;
        const placement = resolveProductPlacement(product);
        if (placement) return placement;
      }
    }
    return null;
  }, [editingSchematic, catalogProducts, subcategoryIndex]);

  // Підсистеми обраного розділу (з каталогу)
  const catalogSubsystems =
    sectionOptions.find((o) => o.section === editingSchematic?.section)?.subsystems || [];

  // Підтягуємо розділи з каталогу для обраної моделі
  useEffect(() => {
    const option = modelOptions.find((o) => o.category === formCategory);
    if (!option?.category_id) {
      setSectionOptions([]);
      return;
    }
    api.getSchematicSectionOptions(option.category_id).then(setSectionOptions);
  }, [formCategory, modelOptions]);

  // Якщо збережене значення не з каталогу — одразу показуємо ручне поле
  useEffect(() => {
    if (!editingSchematic || sectionOptions.length === 0) return;
    if (!sectionOptions.some((o) => o.section === editingSchematic.section)) {
      setSectionMode('custom');
    }
  }, [sectionOptions, editingSchematic?.section]);

  // Автозбереження чернетки: якщо щось обірветься, робота не пропаде
  useEffect(() => {
    if (!editingSchematic) return;
    const key = draftKeyFor(editingSchematic.id);
    const serialized = JSON.stringify(editingSchematic);
    if (serialized === loadedSnapshot.current) return; // нічого не змінилось

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), schematic: editingSchematic }));
      } catch {
        /* переповнений localStorage — не критично */
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [editingSchematic]);

  const clearDraft = (id?: number) => {
    try {
      localStorage.removeItem(draftKeyFor(id));
    } catch {
      /* ignore */
    }
    setDraftToRestore(null);
  };

  /** Читає збережену чернетку й пропонує відновити, якщо вона відрізняється. */
  const offerDraftIfAny = (id: number | undefined, current: Schematic) => {
    try {
      const raw = localStorage.getItem(draftKeyFor(id));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.schematic) return;
      if (JSON.stringify(parsed.schematic) === JSON.stringify(current)) {
        localStorage.removeItem(draftKeyFor(id));
        return;
      }
      setDraftToRestore({ savedAt: parsed.savedAt, schematic: parsed.schematic });
    } catch {
      /* ignore */
    }
  };

  // ⌘C / Ctrl+C — скопіювати обрану точку, ⌘V / Ctrl+V — вставити копію.
  // У текстових полях не перехоплюємо, щоб не ламати звичайне копіювання тексту.
  useEffect(() => {
    const isEditableField = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (isEditableField(e.target)) return;
      if (!editingSchematic) return;

      const key = e.key.toLowerCase();

      if (key === 'c' && selectedHotspotIdx !== null) {
        e.preventDefault();
        handleCopyHotspot(selectedHotspotIdx);
        return;
      }

      if (key === 'v' && pointClipboard) {
        e.preventDefault();
        handlePasteHotspot();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingSchematic, selectedHotspotIdx, pointClipboard]);

  /**
   * Відкриває вибір товару з каталогу й одразу підставляє в пошук парт-номер
   * точки — щоб не шукати вручну й не спотикатись об дефіси.
   */
  const openProductPicker = (hotspotIdx: number, varIdx?: number) => {
    setVariantModalTarget(varIdx === undefined ? 'new' : { hotspotIdx, varIdx });
    setVariantModalStep('search');
    setProductSearchQuery(editingSchematic?.hotspots[hotspotIdx]?.part_number || '');
    setIsVariantModalOpen(true);
  };

  /** Копіює парт-номер у системний буфер обміну. */
  const copyPartNumber = async (value?: string) => {
    const text = (value || '').trim();
    if (!text) {
      setError('Парт-номер порожній — немає що копіювати');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setSuccessMsg(`Парт-номер ${text} скопійовано`);
    } catch {
      // Фолбек, якщо браузер заблокував Clipboard API
      const helper = document.createElement('textarea');
      helper.value = text;
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      document.execCommand('copy');
      document.body.removeChild(helper);
      setSuccessMsg(`Парт-номер ${text} скопійовано`);
    }
  };

  const handleAddVariant = (hotspotIdx: number) => {
    if (!editingSchematic) return;
    const hotspot = editingSchematic.hotspots[hotspotIdx];
    const currentVariants = hotspot.variants || [];
    const newVar: HotspotVariant = {
      name: 'Аналог новый',
      type: 'analog',
      condition: 'new',
      priceUAH: 800,
      priceUSD: 20,
      inStock: true
    };
    handleUpdateHotspot(hotspotIdx, 'variants', [...currentVariants, newVar]);
  };

  const handleUpdateVariant = (
    hotspotIdx: number,
    varIdx: number,
    field: keyof HotspotVariant,
    value: any
  ) => {
    if (!editingSchematic) return;
    const hotspot = editingSchematic.hotspots[hotspotIdx];
    const updatedVariants = [...(hotspot.variants || [])];
    updatedVariants[varIdx] = {
      ...updatedVariants[varIdx],
      [field]: value
    };
    handleUpdateHotspot(hotspotIdx, 'variants', updatedVariants);
  };

  const handleDeleteVariant = (hotspotIdx: number, varIdx: number) => {
    if (!editingSchematic) return;
    const hotspot = editingSchematic.hotspots[hotspotIdx];
    const updatedVariants = (hotspot.variants || []).filter((_, i) => i !== varIdx);
    handleUpdateHotspot(hotspotIdx, 'variants', updatedVariants);
  };

  const handleSave = async () => {
    if (!editingSchematic) return;
    if (!editingSchematic.title.trim()) {
      setError('Введіть назву вузла / схеми');
      return;
    }
    if (!editingSchematic.image_url) {
      setError('Завантажте зображення схеми');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Prepare payload with formatted variants_json
      const hotspotsPayload = editingSchematic.hotspots.map((h, i) => ({
        number: h.number || i + 1,
        x: h.x,
        y: h.y,
        part_number: h.part_number || '',
        name: h.name || `Деталь #${h.number}`,
        product_id: h.product_id || null,
        variants_json: JSON.stringify(h.variants || []),
        sort_order: h.sort_order ?? i + 1
      }));

      const payload = {
        title: editingSchematic.title,
        model: editingSchematic.model,
        generation: editingSchematic.generation,
        section: editingSchematic.section,
        subsystem: editingSchematic.subsystem,
        image_url: editingSchematic.image_url,
        sort_order: editingSchematic.sort_order || 1,
        hotspots: hotspotsPayload
      };

      if (isNew) {
        await api.createSchematic(payload);
        setSuccessMsg('Схему успішно створено');
      } else {
        await api.updateSchematic(editingSchematic.id, payload);
        setSuccessMsg('Схему оновлено');
      }

      // Успішно збережено — чернетка більше не потрібна
      clearDraft(editingSchematic.id);
      loadedSnapshot.current = '';
      setEditingSchematic(null);
      loadSchematics();
    } catch (err: any) {
      setError(err.message || 'Помилка збереження схеми');
    } finally {
      setSaving(false);
    }
  };

  const getFullImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // RENDER: LIST VIEW
  if (!editingSchematic) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black font-montserrat text-gray-900 uppercase tracking-wide flex items-center gap-2">
              <Layers className="text-red-600" size={28} />
              Схеми запчастин (EPC)
            </h1>
            <p className="text-gray-500 font-manrope text-sm mt-1">
              Керування інтерактивними схемами вузлів Tesla з розстановкою точок деталей
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-montserrat font-bold text-sm transition-colors shadow-sm"
          >
            <Plus size={18} />
            Додати схему
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm font-manrope">
            <AlertCircle size={20} className="shrink-0 text-red-600" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-xs underline">Закрити</button>
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-700 text-sm font-manrope">
            <CheckCircle2 size={20} className="shrink-0 text-green-600" />
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="ml-auto text-xs underline">Закрити</button>
          </div>
        )}
        {optionsError && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800 text-sm font-manrope">
            <AlertCircle size={20} className="shrink-0 text-amber-600" />
            <span>
              Не вдалося завантажити моделі з категорій: {optionsError}. Створення схеми
              недоступне, поки каталог недоступний.
            </span>
            <button onClick={() => loadModelOptions()} className="ml-auto text-xs underline">Повторити</button>
          </div>
        )}

        {/* Filter bar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Пошук за назвою вузла або розділу..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="w-full md:w-56">
            <select
              value={filterModel}
              onChange={(e) => setFilterModel(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">Всі моделі Tesla</option>
              {modelOptions.map((o) => (
                <option key={`filter-${o.category}`} value={o.category}>
                  {o.is_accessory ? o.category : `Tesla ${o.category}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid of Schematics */}
        {loading ? (
          <div className="py-20 text-center text-gray-400 font-manrope">
            Завантаження схем...
          </div>
        ) : schematics.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-300">
            <Layers size={48} className="mx-auto text-gray-300 mb-3" />
            <h3 className="font-montserrat font-bold text-gray-700 text-lg">Схем не знайдено</h3>
            <p className="text-gray-400 font-manrope text-sm mt-1 max-w-md mx-auto">
              Створіть першу інтерактивну схему із точками та прив’язкою до деталей
            </p>
            <button
              onClick={handleCreateNew}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-montserrat font-bold"
            >
              <Plus size={16} /> Додати першу схему
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {schematics.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="relative h-48 bg-gray-50 border-b border-gray-100 flex items-center justify-center p-4">
                  {s.image_url ? (
                    <img
                      src={getFullImageUrl(s.image_url)}
                      alt={s.title}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <Layers size={36} className="text-gray-300" />
                  )}
                  <div className="absolute top-3 right-3 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full font-montserrat flex items-center gap-1 shadow-sm">
                    <MapPin size={12} />
                    {s.hotspots_count} точок
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800 text-xs font-montserrat font-bold">
                      {resolveOption(modelOptions, s.model, s.generation)?.category || s.model}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-manrope font-medium">
                      {s.generation}
                    </span>
                  </div>

                  <h3 className="font-montserrat font-bold text-gray-900 text-lg line-clamp-1 mb-1">
                    {s.title}
                  </h3>

                  <p className="text-xs text-gray-500 font-manrope mb-4">
                    {s.section} • {s.subsystem}
                  </p>

                  <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                    <button
                      onClick={() => handleEdit(s.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold font-montserrat text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={14} /> Редагувати точки
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      title="Видалити"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // RENDER: EDIT / PINNING CANVAS VIEW
  const selectedHotspot = selectedHotspotIdx !== null ? editingSchematic.hotspots[selectedHotspotIdx] : null;

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditingSchematic(null)}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black font-montserrat text-gray-900">
              {isNew ? 'Нова інтерактивна схема' : `Редагування: ${editingSchematic.title || 'Схема'}`}
            </h1>
            <p className="text-xs text-gray-500 font-manrope">
              Клікніть на зображення, щоб поставити точку деталі (hotspot)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditingSchematic(null)}
            className="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-montserrat font-bold transition-colors"
          >
            Скасувати
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-montserrat font-bold transition-colors shadow-sm"
          >
            <Save size={16} />
            {saving ? 'Збереження...' : 'Зберегти схему'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-manrope flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0 text-red-600" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-xs underline shrink-0">Закрити</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm font-manrope flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <CheckCircle2 size={18} className="shrink-0 text-green-600" />
          <span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-xs underline shrink-0">Закрити</button>
        </div>
      )}

      {/* Незбережена чернетка після обриву сесії / закриття вкладки */}
      {draftToRestore && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm font-manrope flex flex-wrap items-center gap-3">
          <AlertCircle size={18} className="shrink-0 text-amber-600" />
          <span className="flex-1">
            Знайдено незбережену чернетку від{' '}
            <strong>
              {new Date(draftToRestore.savedAt).toLocaleString('uk-UA', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </strong>{' '}
            — у ній {draftToRestore.schematic.hotspots.length} точок.
          </span>
          <button
            onClick={() => {
              setEditingSchematic(draftToRestore.schematic);
              setSelectedHotspotIdx(
                draftToRestore.schematic.hotspots.length > 0 ? 0 : null
              );
              setDraftToRestore(null);
              setSuccessMsg('Чернетку відновлено — не забудьте зберегти схему');
            }}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-montserrat font-bold cursor-pointer"
          >
            Відновити
          </button>
          <button
            onClick={() => clearDraft(editingSchematic.id)}
            className="px-3 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg text-xs font-montserrat font-bold cursor-pointer"
          >
            Відхилити
          </button>
        </div>
      )}

      {/* Metadata Form */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="md:col-span-2">
          <label className="flex items-center text-xs font-bold font-montserrat text-gray-700 uppercase mb-1">
            <span>Назва схеми / вузла *</span>
            <InfoTooltip text="Головна назва вузла на сайті. Відображається як H1 заголовок сторінки, у списках вибору, результатах пошуку та в хлібних крихтах (наприклад: «Передняя защита днища»)." />
          </label>
          <input
            type="text"
            value={editingSchematic.title}
            onChange={(e) => setEditingSchematic({ ...editingSchematic, title: e.target.value })}
            placeholder="напр. Передняя защита днища"
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="flex items-center text-xs font-bold font-montserrat text-gray-700 uppercase mb-1">
            <span>Категорія (модель) *</span>
            <InfoTooltip text="Список береться з категорій каталогу — тих самих, що бачать покупці. Щоб додати нову модель (напр. Model 3 Highland), створіть її категорію в розділі «Категорії»." />
          </label>
          <select
            value={formCategory}
            onChange={(e) => {
              const option = modelOptions.find((o) => o.category === e.target.value);
              if (!option) {
                setFormCategory(e.target.value);
                return;
              }
              setFormCategory(option.category);
              setEditingSchematic({
                ...editingSchematic,
                model: option.model,
                generation: option.generation
              });
            }}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:ring-2 focus:ring-red-500 focus:outline-none"
          >
            {formCategory && !modelOptions.some((o) => o.category === formCategory) && (
              <option value={formCategory}>{formCategory} (немає в категоріях)</option>
            )}
            {modelOptions.map((o) => (
              <option key={o.category} value={o.category}>
                {o.is_accessory ? o.category : `Tesla ${o.category}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center text-xs font-bold font-montserrat text-gray-700 uppercase mb-1">
            <span>Покоління</span>
            <InfoTooltip text="Підтягується з обраної категорії (напр. «Model 3 Highland» → покоління Highland). Для базової моделі пропонуються покоління, які вже використані у схемах цієї моделі." />
          </label>
          <select
            value={editingSchematic.generation}
            onChange={(e) => setEditingSchematic({ ...editingSchematic, generation: e.target.value })}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:ring-2 focus:ring-red-500 focus:outline-none"
          >
            {(() => {
              const option = modelOptions.find((o) => o.category === formCategory);
              const list = option
                ? Array.from(new Set([option.generation, ...option.generations])).filter(Boolean)
                : [];
              const withCurrent = editingSchematic.generation && !list.includes(editingSchematic.generation)
                ? [editingSchematic.generation, ...list]
                : list;
              return withCurrent.map((g) => (
                <option key={g} value={g}>{g}</option>
              ));
            })()}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold font-montserrat text-gray-700 uppercase mb-1">
            Сортування
          </label>
          <input
            type="number"
            value={editingSchematic.sort_order}
            onChange={(e) => setEditingSchematic({ ...editingSchematic, sort_order: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>

        <div className="md:col-span-2">
          {schemePlacement && (
            <div className="mb-1 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setEditingSchematic({
                    ...editingSchematic,
                    section: schemePlacement.section,
                    subsystem: schemePlacement.subsystem || editingSchematic.subsystem,
                  });
                  setSectionMode('catalog');
                  setSubsystemMode('catalog');
                  setSuccessMsg(
                    `Розділ і підсистему взято з каталогу за товаром: «${schemePlacement.section}»` +
                      (schemePlacement.subsystem ? ` / ${schemePlacement.subsystem}` : '')
                  );
                }}
                title={`У каталозі цей товар лежить у «${schemePlacement.section}»`}
                className="text-[11px] font-montserrat font-bold text-tesla-red hover:underline cursor-pointer"
              >
                Взяти розділ з товару
              </button>
            </div>
          )}
          <label className="flex items-center text-xs font-bold font-montserrat text-gray-700 uppercase mb-1">
            <span>Розділ (Section)</span>
            <InfoTooltip text="Береться з КАТАЛОГУ — верхній рівень підкатегорій обраної моделі («КУЗОВ», «ЗОВНІШНЄ ОЗДОБЛЕННЯ», «ХОДОВА ЧАСТИНА»). За цим списком клієнт ходить у схемах: авто → розділ → підсистема. Якщо вибрати зі списку, розділ ніколи не розʼїдеться на «КУЗОВ» / «Кузов» / «кузов»." />
          </label>
          {sectionMode === 'catalog' ? (
            <select
              value={editingSchematic.section}
              disabled={sectionOptions.length === 0}
              onChange={(e) => {
                const value = e.target.value;
                if (value === CUSTOM_OPTION) {
                  setSectionMode('custom');
                  setEditingSchematic({ ...editingSchematic, section: '', subsystem: '' });
                  return;
                }
                setEditingSchematic({ ...editingSchematic, section: value, subsystem: '' });
              }}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:ring-2 focus:ring-red-500 focus:outline-none disabled:text-gray-400"
            >
              <option value="">
                {sectionOptions.length === 0 ? 'Завантаження розділів…' : '— оберіть розділ —'}
              </option>
              {sectionOptions.map((option) => (
                <option key={option.section} value={option.section}>
                  {option.section}
                </option>
              ))}
              <option value={CUSTOM_OPTION}>Інший розділ (вписати вручну)</option>
            </select>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={editingSchematic.section}
                onChange={(e) => setEditingSchematic({ ...editingSchematic, section: e.target.value })}
                placeholder="напр. НАРУЖНЫЕ КРЕПЛЕНИЯ"
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSectionMode('catalog')}
                className="px-3 py-2 text-xs font-montserrat font-bold text-tesla-red border border-red-200 rounded-lg hover:bg-red-50 transition-colors shrink-0"
              >
                Зі списку
              </button>
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="flex items-center text-xs font-bold font-montserrat text-gray-700 uppercase mb-1">
            <span>Підсистема (Subsystem)</span>
            <InfoTooltip text="Підкатегорія всередині обраного розділу — теж з каталогу («ПЕРЕДНІЙ БАМПЕР», «ПЕРЕДНІ КРИЛА»). Саме за нею клієнт бачить останній крок перед схемою." />
          </label>
          {subsystemMode === 'catalog' && catalogSubsystems.length > 0 ? (
            <select
              value={editingSchematic.subsystem}
              onChange={(e) => {
                const value = e.target.value;
                if (value === CUSTOM_OPTION) {
                  setSubsystemMode('custom');
                  setEditingSchematic({ ...editingSchematic, subsystem: '' });
                  return;
                }
                setEditingSchematic({ ...editingSchematic, subsystem: value });
              }}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:ring-2 focus:ring-red-500 focus:outline-none"
            >
              <option value="">— оберіть підсистему —</option>
              {catalogSubsystems.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value={CUSTOM_OPTION}>Інша підсистема (вписати вручну)</option>
            </select>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={editingSchematic.subsystem}
                onChange={(e) => setEditingSchematic({ ...editingSchematic, subsystem: e.target.value })}
                placeholder="напр. Защита днища и диффузор"
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
              {catalogSubsystems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSubsystemMode('catalog')}
                  className="px-3 py-2 text-xs font-montserrat font-bold text-tesla-red border border-red-200 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                >
                  Зі списку
                </button>
              )}
            </div>
          )}
          {editingSchematic.section && catalogSubsystems.length === 0 && sectionOptions.length > 0 && (
            <p className="mt-1 text-[11px] text-gray-400 font-manrope">
              У каталозі цей розділ без підрозділів — впишіть підсистему вручну.
            </p>
          )}
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs font-bold font-montserrat text-gray-700 uppercase mb-1">
            Зображення схеми
          </label>
          <label className="flex items-center justify-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold font-montserrat cursor-pointer transition-colors border border-red-200">
            <Upload size={14} />
            {uploadingImage ? 'Завантаження...' : 'Завантажити фото'}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Main Canvas & Hotspots Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive diagram canvas */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold font-montserrat uppercase text-gray-600 flex items-center gap-1.5">
              <MapPin size={16} className="text-red-600" />
              Полотно схеми (клікніть щоб додати точку або перетягніть існуючу)
            </span>
            <span className="text-xs text-gray-400 font-manrope">
              Всього точок: {editingSchematic.hotspots.length}
            </span>
          </div>

          {/* Repositioning Banner Alert */}
          {isRepositioningMode && selectedHotspot && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs font-manrope text-amber-900 animate-in fade-in duration-150 shadow-2xs">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-amber-600 shrink-0 animate-spin" />
                <span>
                  <strong>Режим переміщення:</strong> клікніть на зображенні схеми, щоб перемістити <strong>Точку #{selectedHotspot.number}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsRepositioningMode(false)}
                className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-montserrat font-bold text-[11px] shrink-0 cursor-pointer"
              >
                Скасувати
              </button>
            </div>
          )}

          <div
            ref={imageContainerRef}
            tabIndex={0}
            onClick={handleCanvasClick}
            className={`relative w-full border border-gray-200 rounded-xl overflow-hidden bg-gray-50 select-none min-h-[380px] flex items-center justify-center outline-none focus:ring-2 focus:ring-red-300 ${
              isRepositioningMode ? 'cursor-crosshair ring-2 ring-amber-400' : 'cursor-crosshair'
            }`}
          >
            {editingSchematic.image_url ? (
              <img
                src={getFullImageUrl(editingSchematic.image_url)}
                alt="Схема"
                className="w-full h-auto block object-contain pointer-events-none"
              />
            ) : (
              <div className="text-center p-10 text-gray-400 font-manrope">
                <Upload size={40} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm font-medium">Завантажте зображення схеми вгорі</p>
              </div>
            )}

            {/* Hotspot Pins (Draggable & Clickable) */}
            {editingSchematic.image_url && editingSchematic.hotspots.map((h, idx) => {
              const isSelected = selectedHotspotIdx === idx;
              const isDragging = draggingIdx === idx;
              return (
                <div
                  key={idx}
                  style={{
                    left: `${h.x}%`,
                    top: `${h.y}%`,
                    transform: 'translate(-50%, -50%)',
                    touchAction: 'none'
                  }}
                  tabIndex={0}
                  onMouseDown={(e) => handlePinMouseDown(idx, e)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedHotspotIdx(idx);
                    // Фокус іде на полотно, щоб ⌘C копіював точку, а не текст в інпуті
                    focusCanvas();
                  }}
                  className={`absolute w-7 h-7 rounded-full flex items-center justify-center font-montserrat font-black text-xs transition-transform shadow-md cursor-grab active:cursor-grabbing select-none ${
                    isDragging
                      ? 'bg-red-700 text-white ring-4 ring-amber-400 scale-135 z-30 shadow-xl'
                      : isSelected
                      ? 'bg-red-600 text-white ring-4 ring-red-300 ring-offset-1 scale-125 z-20 shadow-red-500/40'
                      : 'bg-red-600 text-white hover:scale-110 z-10'
                  }`}
                  title={`Точка #${h.number}: ${h.name} (Затисніть для перетягування)`}
                >
                  {h.number}
                </div>
              );
            })}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400 font-manrope">
            <span className="flex items-center gap-1.5">
              <Info size={12} className="shrink-0" />
              Перетягуйте точки мишкою по схемі або натисніть «Перемістити кліком» праворуч
            </span>
            <span className="flex items-center gap-1.5">
              <Copy size={12} className="shrink-0" />
              <strong className="font-montserrat text-gray-500">⌘C</strong> — копіювати точку,
              <strong className="font-montserrat text-gray-500">⌘V</strong> — вставити копію
              {pointClipboard && (
                <span className="text-red-600 font-manrope">
                  (у буфері точка #{pointClipboard.number})
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Right: Hotspots editor & details */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h3 className="font-montserrat font-bold text-gray-900 text-base">
              {selectedHotspot ? `Редагування точки #${selectedHotspot.number}` : 'Список деталей вузла'}
            </h3>
            {selectedHotspot && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleDuplicateHotspot(selectedHotspotIdx!)}
                  title="Створити копію цієї точки (⌘C, потім ⌘V). Одна деталь часто стоїть у кількох місцях схеми."
                  className="text-xs text-gray-700 hover:text-red-600 flex items-center gap-1 font-montserrat font-bold cursor-pointer"
                >
                  <Copy size={14} /> Копіювати точку
                </button>
                <button
                  onClick={() => handleDeleteHotspot(selectedHotspotIdx!)}
                  className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-montserrat font-bold cursor-pointer"
                >
                  <Trash2 size={14} /> Видалити
                </button>
              </div>
            )}
          </div>

          {selectedHotspot && selectedHotspotIdx !== null ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold font-montserrat text-gray-700 mb-1">
                    Номер на схемі
                  </label>
                  <input
                    type="number"
                    value={selectedHotspot.number}
                    onChange={(e) => handleUpdateHotspot(selectedHotspotIdx, 'number', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold font-montserrat text-gray-700 mb-1">
                    Парт-номер (Tesla)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={selectedHotspot.part_number || ''}
                      onChange={(e) => handleUpdateHotspot(selectedHotspotIdx, 'part_number', e.target.value)}
                      placeholder="напр. 1499151-00-C"
                      className="w-full pl-3 pr-9 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope font-mono"
                    />
                    <button
                      type="button"
                      title="Скопіювати парт-номер у буфер обміну"
                      onClick={() => copyPartNumber(selectedHotspot.part_number)}
                      className="absolute right-1.5 top-1.5 p-1 text-gray-400 hover:text-red-600 hover:bg-white rounded-md transition-colors cursor-pointer"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold font-montserrat text-gray-700 mb-1">
                  Назва деталі
                </label>
                <input
                  type="text"
                  value={selectedHotspot.name}
                  onChange={(e) => handleUpdateHotspot(selectedHotspotIdx, 'name', e.target.value)}
                  placeholder="напр. Защита переднего подрамника"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope"
                />
              </div>

              {/* Coordinates info & Move button */}
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200/80 space-y-2">
                <div className="text-xs font-manrope text-gray-600 flex items-center justify-between">
                  <span>Положення на схемі:</span>
                  <span className="font-mono font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200">
                    X: {selectedHotspot.x}% • Y: {selectedHotspot.y}%
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRepositioningMode(!isRepositioningMode)}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-montserrat font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isRepositioningMode
                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm ring-2 ring-amber-300'
                      : 'bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 shadow-2xs'
                  }`}
                >
                  <Target size={14} className={isRepositioningMode ? 'animate-spin' : 'text-red-600'} />
                  <span>
                    {isRepositioningMode
                      ? 'Клікніть на схемі для переміщення (або скасуйте)'
                      : 'Перемістити точку кліком на фото'}
                  </span>
                </button>
              </div>

              {/* Variants Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold font-montserrat text-gray-700 uppercase">
                    Варіанти наявності та цін
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setVariantModalTarget('new');
                      setVariantModalStep('choice');
                      setProductSearchQuery(selectedHotspot?.part_number || '');
                      setFilterBySchematicModel(true);
                      setIsVariantModalOpen(true);
                    }}
                    className="text-xs text-red-600 hover:text-red-700 font-montserrat font-bold flex items-center gap-1 cursor-pointer bg-red-50 hover:bg-red-100/80 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <Plus size={14} /> Додати варіант
                  </button>
                </div>

                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {(selectedHotspot.variants || []).map((v, varIdx) => {
                    const linkedProd = v.product_id ? catalogProducts.find((p) => p.id === v.product_id) : null;
                    return (
                      <div key={varIdx} className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={v.name}
                            onChange={(e) => handleUpdateVariant(selectedHotspotIdx, varIdx, 'name', e.target.value)}
                            placeholder="напр. Оригинал б/у"
                            className="font-montserrat font-bold bg-white px-2 py-1 border border-gray-200 rounded-md text-gray-800 text-xs flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteVariant(selectedHotspotIdx, varIdx)}
                            className="text-gray-400 hover:text-red-600 p-1 cursor-pointer"
                            title="Видалити варіант"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Linked Catalog Product status */}
                        {v.product_id ? (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className="w-5 h-5 rounded bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                <Check size={12} />
                              </div>
                              <div className="truncate">
                                <span className="font-montserrat font-bold text-emerald-950 text-[11px] block truncate">
                                  {linkedProd ? linkedProd.name : v.name}
                                </span>
                                <span className="text-[10px] text-emerald-700 font-mono">
                                  {linkedProd?.detail_number ? `Арт: ${linkedProd.detail_number} • ` : ''}
                                  {linkedProd ? `${linkedProd.priceUAH} ₴ • ` : ''}
                                  {linkedProd && !linkedProd.inStock
                                    ? 'немає в наявності'
                                    : 'в наявності'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openProductPicker(selectedHotspotIdx!, varIdx)}
                                className="px-1.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-[10px] font-montserrat font-bold transition-colors cursor-pointer"
                              >
                                Змінити
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateVariant(selectedHotspotIdx, varIdx, 'product_id', null)}
                                className="p-1 text-emerald-600 hover:text-red-600 transition-colors cursor-pointer"
                                title="Відв'язати від каталогу"
                              >
                                <Unlink size={13} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <button
                              type="button"
                              onClick={() => openProductPicker(selectedHotspotIdx, varIdx)}
                              className="w-full py-1.5 px-2 bg-white hover:bg-red-50 text-gray-700 hover:text-red-700 border border-dashed border-gray-300 hover:border-red-300 rounded-lg text-[11px] font-montserrat font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <LinkIcon size={12} />
                              <span>Прив'язати товар з каталогу</span>
                            </button>
                            <p className="text-[10px] text-gray-400 font-manrope leading-tight">
                              Товару немає в каталозі — на сайті покажемо{' '}
                              <strong className="text-gray-500">«Немає в наявності»</strong> без ціни.
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-gray-400 block mb-0.5 font-medium">Тип</span>
                            <select
                              value={v.type || 'original'}
                              onChange={(e) => handleUpdateVariant(selectedHotspotIdx, varIdx, 'type', e.target.value)}
                              className="w-full bg-white p-1 border border-gray-200 rounded text-xs"
                            >
                              <option value="original">Оригінал</option>
                              <option value="analog">Аналог</option>
                            </select>
                          </div>
                          <div>
                            <span className="text-gray-400 block mb-0.5 font-medium">Стан</span>
                            <select
                              value={v.condition || 'new'}
                              onChange={(e) => handleUpdateVariant(selectedHotspotIdx, varIdx, 'condition', e.target.value)}
                              className="w-full bg-white p-1 border border-gray-200 rounded text-xs"
                            >
                              <option value="new">Новий</option>
                              <option value="used">Б/В</option>
                            </select>
                          </div>
                          <div>
                            <span className="text-gray-400 block mb-0.5 font-medium">
                              Ціна (₴){v.product_id ? '' : ' — довідково'}
                            </span>
                            <input
                              type="number"
                              value={v.priceUAH}
                              disabled={Boolean(v.product_id)}
                              title={
                                v.product_id
                                  ? 'Ціна береться з каталогу — тут не редагується'
                                  : 'На сайті не показується, доки товар не привʼязано до каталогу'
                              }
                              onChange={(e) => handleUpdateVariant(selectedHotspotIdx, varIdx, 'priceUAH', parseFloat(e.target.value) || 0)}
                              className={`w-full p-1 border border-gray-200 rounded font-bold text-xs ${
                                v.product_id ? 'bg-gray-100 text-gray-500' : 'bg-white'
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-manrope">
                Оберіть точку на зображенні або зі списку нижче:
              </p>
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {editingSchematic.hotspots.map((h, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedHotspotIdx(idx)}
                    className="p-3 bg-gray-50 hover:bg-red-50 rounded-xl border border-gray-200 cursor-pointer transition-colors flex items-center justify-between gap-2 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-red-600 text-white font-montserrat font-bold text-xs flex items-center justify-center shrink-0">
                        {h.number}
                      </span>
                      <div className="min-w-0">
                        <div className="font-montserrat font-bold text-gray-900 text-xs truncate">
                          {h.name}
                        </div>
                        <div className="text-[11px] font-mono text-gray-400 truncate">
                          {h.part_number || 'Не вказано парт-номер'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-gray-500 font-manrope">
                        {h.variants?.length || 0} вар.
                      </span>
                      <button
                        type="button"
                        title="Копіювати точку (одна деталь може стояти в кількох місцях)"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateHotspot(idx);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-white rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Add or Link Product to Variant */}
      {isVariantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-xl w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                  <Package size={16} />
                </div>
                <h3 className="font-montserrat font-bold text-sm text-gray-900">
                  {variantModalStep === 'choice'
                    ? 'Оберіть спосіб додавання варіанту'
                    : 'Вибір товару з каталогу магазину'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsVariantModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            {variantModalStep === 'choice' ? (
              <div className="p-5 space-y-4">
                <p className="text-xs text-gray-500 font-manrope">
                  Ви можете підв'язати реальний товар із каталогу запчастин або створити довільний варіант вручну:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setVariantModalStep('search')}
                    className="p-4 rounded-xl border-2 border-red-500/80 bg-red-50/40 hover:bg-red-50 text-left transition-all group cursor-pointer hover:shadow-md active:scale-98"
                  >
                    <div className="w-10 h-10 rounded-lg bg-red-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                      <Search size={18} />
                    </div>
                    <h4 className="font-montserrat font-bold text-sm text-gray-900 group-hover:text-red-600 transition-colors">
                      З прив'язкою до товару
                    </h4>
                    <p className="text-xs text-gray-500 font-manrope mt-1 leading-relaxed">
                      Пошук серед товарів для <strong>{editingSchematic.model}</strong>. Автоматично підтягне назву, ціну, залишок та ID.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsVariantModalOpen(false);
                      if (selectedHotspotIdx !== null) {
                        handleAddVariant(selectedHotspotIdx);
                      }
                    }}
                    className="p-4 rounded-xl border border-gray-200 hover:border-gray-300 bg-gray-50/60 hover:bg-gray-100/70 text-left transition-all group cursor-pointer active:scale-98"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gray-200 text-gray-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                      <Edit2 size={18} />
                    </div>
                    <h4 className="font-montserrat font-bold text-sm text-gray-900">
                      Створити вручну
                    </h4>
                    <p className="text-xs text-gray-500 font-manrope mt-1 leading-relaxed">
                      Без прив'язки до складської картки товару. Ручний ввід назви, типу (оригінал/аналог), стану та ціни.
                    </p>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-3.5">
                {/* Search & Model filter */}
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      placeholder={`Пошук запчастини за назвою або артикулом...`}
                      className="w-full pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-manrope focus:ring-2 focus:ring-red-500 focus:outline-none"
                      autoFocus
                    />
                    <Search size={15} className="absolute left-3 top-3 text-gray-400" />
                    {productSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setProductSearchQuery('')}
                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs font-manrope px-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-gray-700 font-medium">
                      <input
                        type="checkbox"
                        checked={filterBySchematicModel}
                        onChange={(e) => setFilterBySchematicModel(e.target.checked)}
                        className="rounded text-red-600 focus:ring-red-500"
                      />
                      <span>
                        Фільтрувати тільки для{' '}
                        <strong>{formCategory || editingSchematic.model}</strong>
                      </span>
                    </label>
                    <span className="text-gray-400">
                      {catalogLoading ? 'Завантаження...' : `Знайдено: ${filteredCatalogProducts.length}`}
                    </span>
                  </div>
                </div>

                {/* Products List */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {filteredCatalogProducts
                    .slice(0, 40)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50/30 transition-all flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          {p.image ? (
                            <img
                              src={p.image}
                              alt={p.name}
                              className="w-10 h-10 object-contain rounded-lg border border-gray-200 bg-white shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                              <Package size={16} />
                            </div>
                          )}
                          <div className="truncate">
                            <div className="font-montserrat font-bold text-xs text-gray-900 group-hover:text-red-600 transition-colors truncate">
                              {p.name}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-gray-400 font-manrope">
                              {p.detail_number && (
                                <span className="font-mono text-gray-700 bg-gray-100 px-1.5 py-0.2 rounded">
                                  {p.detail_number}
                                </span>
                              )}
                              <span>{p.inStock !== false ? '• В наявності' : '• Під замовлення'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="font-montserrat font-bold text-xs text-gray-900">
                              {p.priceUAH} ₴
                            </div>
                            {p.priceUSD ? (
                              <div className="text-[10px] text-gray-400">${p.priceUSD}</div>
                            ) : null}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (selectedHotspotIdx === null) return;
                              const isOriginal = Boolean(p.brand && /tesla/i.test(p.brand));
                              const isUsed = Boolean(/вживан|б\/в|used/i.test(`${p.name} ${p.category || ''}`));

                              if (variantModalTarget === 'new') {
                                const currentVars = selectedHotspot.variants || [];
                                const newVar: HotspotVariant = {
                                  name: p.name,
                                  product_id: p.id,
                                  type: isOriginal ? 'original' : 'analog',
                                  condition: isUsed ? 'used' : 'new',
                                  priceUAH: p.priceUAH || 0,
                                  priceUSD: p.priceUSD || Math.round((p.priceUAH || 0) / 41),
                                  inStock: p.inStock !== false
                                };
                                handleUpdateHotspot(selectedHotspotIdx, 'variants', [...currentVars, newVar]);

                                // Auto-fill part_number if empty
                                if (!selectedHotspot.part_number && p.detail_number) {
                                  handleUpdateHotspot(selectedHotspotIdx, 'part_number', p.detail_number);
                                }
                                // Auto-fill hotspot name if default
                                if (selectedHotspot.name.startsWith('Деталь #')) {
                                  handleUpdateHotspot(selectedHotspotIdx, 'name', p.name);
                                }
                              } else {
                                const { varIdx } = variantModalTarget;
                                const updatedVars = [...(selectedHotspot.variants || [])];
                                updatedVars[varIdx] = {
                                  ...updatedVars[varIdx],
                                  product_id: p.id,
                                  name: p.name,
                                  priceUAH: p.priceUAH || updatedVars[varIdx].priceUAH,
                                  priceUSD: p.priceUSD || updatedVars[varIdx].priceUSD,
                                  inStock: p.inStock !== false
                                };
                                handleUpdateHotspot(selectedHotspotIdx, 'variants', updatedVars);
                              }

                              setIsVariantModalOpen(false);

                              // Екосистема: розділ і підсистему схеми беремо з
                              // каталогу за товаром — не треба вписувати вручну
                              const placement = resolveProductPlacement(p);
                              if (placement && !editingSchematic.section) {
                                setEditingSchematic((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        section: placement.section,
                                        subsystem: placement.subsystem || prev.subsystem,
                                      }
                                    : prev
                                );
                                setSectionMode('catalog');
                                setSubsystemMode('catalog');
                                setSuccessMsg(
                                  `Товар "${p.name}" прив'язано. Розділ «${placement.section}»` +
                                    (placement.subsystem ? ` / ${placement.subsystem}` : '') +
                                    ' підставлено з каталогу.'
                                );
                              } else {
                                setSuccessMsg(`Товар "${p.name}" успішно прив'язано!`);
                              }
                            }}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-montserrat font-bold text-xs transition-colors cursor-pointer shadow-xs active:scale-95"
                          >
                            Обрати
                          </button>
                        </div>
                      </div>
                    ))}

                  {catalogLoading && (
                    <div className="flex items-center justify-center gap-2 py-6 text-gray-400 text-xs font-manrope">
                      <span className="w-4 h-4 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin" />
                      Завантаження товарів каталогу...
                    </div>
                  )}

                  {!catalogLoading && filteredCatalogProducts.length === 0 && (
                    <div className="text-center py-6 text-gray-400 text-xs font-manrope space-y-1">
                      <p>Нічого не знайдено.</p>
                      {filterBySchematicModel && (
                        <p className="text-[11px]">
                          Увімкнено фільтр «тільки для {editingSchematic.model}» — зніміть його,
                          щоб шукати серед усіх {catalogProducts.length} товарів.
                        </p>
                      )}
                    </div>
                  )}

                  {!catalogLoading && filteredCatalogProducts.length > 40 && (
                    <div className="text-center pt-1 text-[11px] text-gray-400 font-manrope">
                      Показано перші 40 із {filteredCatalogProducts.length} — уточніть пошук
                    </div>
                  )}
                </div>

                {/* Back to choice */}
                <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setVariantModalStep('choice')}
                    className="text-xs text-gray-500 hover:text-gray-900 font-manrope cursor-pointer"
                  >
                    ← Назад до вибору варіанту
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsVariantModalOpen(false)}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-montserrat font-bold text-gray-700 cursor-pointer"
                  >
                    Закрити
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
