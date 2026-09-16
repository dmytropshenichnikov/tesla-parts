import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Layers,
  Search,
  MapPin,
  ChevronRight,
  Car,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Filter,
  Check,
  Package
} from 'lucide-react';
import { api } from '../services/api';
import { SchematicSummary, SavedCar, SchematicModelOption, SchematicSectionGroup, Product } from '../types';
import { slugify } from '../utils/slugify';
import { GarageModal } from './GarageModal';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const ALL_MODELS = '__all__';
const ALL_GENERATIONS = 'Всі покоління';
/** «Усі підсистеми розділу» */
const ALL_SUBSYSTEMS = '__all_subsystems__';

/** «1 схема / 2 схеми / 5 схем» — для підпису під моделлю */
const pluralSchemes = (n: number) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'схема';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'схеми';
  return 'схем';
};

/**
 * Моделі та покоління більше не дублюються хардкодом — вони приходять
 * з категорій каталогу (`/schematics/model-options`), тож фільтр схем
 * завжди збігається з категоріями магазину.
 */
const resolveOption = (
  options: SchematicModelOption[],
  model?: string | null,
  generation?: string | null
): SchematicModelOption | null => {
  if (!model || options.length === 0) return null;
  const lowModel = model.toLowerCase();
  const direct = options.find((o) => o.category.toLowerCase() === lowModel);
  if (direct) return direct;
  const byModel = options.filter((o) => o.model.toLowerCase() === lowModel);
  if (byModel.length === 0) return null;
  if (generation) {
    const lowGen = generation.toLowerCase();
    const variant = byModel.find(
      (o) => o.category !== o.model && lowGen.includes(o.category.replace(o.model, '').trim().toLowerCase())
    );
    if (variant) return variant;
    const matched = byModel.find((o) => o.generations.some((g) => g.toLowerCase() === lowGen));
    if (matched) return matched;
  }
  return byModel.find((o) => o.category === o.model) || byModel[0];
};

export const SchemesCatalog: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [schematics, setSchematics] = useState<SchematicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [modelOptions, setModelOptions] = useState<SchematicModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedGen, setSelectedGen] = useState<string>(ALL_GENERATIONS);
  // Шлях до схеми як у каталозі: розділ → підсистема → схема
  const [sections, setSections] = useState<SchematicSectionGroup[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedSubsystem, setSelectedSubsystem] = useState<string>('');
  const [showAllSchematics, setShowAllSchematics] = useState(false);
  // Деталі каталогу, що відповідають обраній підсистемі
  const [subsystemParts, setSubsystemParts] = useState<Product[]>([]);
  const [subsystemCatalog, setSubsystemCatalog] = useState<{ id: number; name: string } | null>(null);
  const [searchInput, setSearchInput] = useState<string>('');
  const [activeSearch, setActiveSearch] = useState<string>('');
  const [vinBanner, setVinBanner] = useState<string | null>(null);

  // Garage state
  const [isGarageOpen, setIsGarageOpen] = useState(false);
  const [activeCar, setActiveCar] = useState<SavedCar | null>(null);

  // Поточний розділ і його підсистеми
  const activeSection = sections.find((s) => s.section === selectedSection) || null;
  const activeSectionSubsystems = activeSection ? activeSection.subsystems : [];
  // Крок «підсистема» показуємо лише коли в розділі справді кілька підсистем
  const needsSubsystemStep = Boolean(activeSection) && activeSectionSubsystems.length > 1;
  // Список схем показуємо, коли шлях пройдено або користувач попросив усі схеми
  const canShowSchemes =
    Boolean(selectedModel) &&
    (showAllSchematics ||
      (Boolean(selectedSection) && (!needsSubsystemStep || Boolean(selectedSubsystem))));

  // Категорії каталогу — джерело моделей і поколінь для фільтрів.
  // Нічого не підставляємо автоматично: спершу користувач має обрати своє авто,
  // і лише потім ми показуємо вузли та схеми.
  useEffect(() => {
    api.getSchematicModelOptions().then((options) => {
      setModelOptions(options);
    });
  }, []);

  useEffect(() => {
    if (modelOptions.length === 0) return;

    const vinParam = searchParams.get('vin');
    const modelParam = searchParams.get('model');
    const genParam = searchParams.get('generation');

    if (modelParam || genParam) {
      const option = resolveOption(modelOptions, modelParam || genParam, genParam);
      if (option) {
        setSelectedModel(option.category);
        setSelectedGen(
          genParam && option.generations.some((g) => g.toLowerCase() === genParam.toLowerCase())
            ? genParam
            : ALL_GENERATIONS
        );
      }
    }

    if (vinParam && vinParam.length === 17) {
      api.decodeVin(vinParam).then(res => {
        if (res.is_valid && res.model) {
          const option = resolveOption(modelOptions, res.model, res.generation);
          if (option) {
            setSelectedModel(option.category);
            setSelectedGen(ALL_GENERATIONS);
          }
          const newCar: SavedCar = {
            id: `car_${Date.now()}`,
            vin: res.vin,
            model: res.model,
            year: res.year,
            drive: res.drive,
            plant: res.plant,
            generation: res.generation || 'Стандартне',
            description: res.description || `Tesla ${res.model} ${res.year || ''}`
          };
          localStorage.setItem('tesla_garage_active_car', JSON.stringify(newCar));
          setActiveCar(newCar);
          window.dispatchEvent(new CustomEvent('garage-car-changed'));
          setVinBanner(`Розпізнано за VIN: Tesla ${res.model} ${res.year || ''} (${res.generation || ''})`);
        }
      }).catch(console.error);
    }
  }, [searchParams, modelOptions]);

  useEffect(() => {
    loadActiveCar();
    const handleGarageUpdate = () => loadActiveCar();
    window.addEventListener('garage-car-changed', handleGarageUpdate);
    return () => window.removeEventListener('garage-car-changed', handleGarageUpdate);
  }, [modelOptions]);

  // Дерево розділів для обраного авто — шлях до схеми як у каталозі
  useEffect(() => {
    if (!selectedModel) {
      setSections([]);
      return;
    }
    api.getSchematicSections({ model: selectedModel }).then(setSections);
  }, [selectedModel]);

  // На кроці «підсистема» підтягуємо деталі саме цього вузла з каталогу
  useEffect(() => {
    if (!selectedModel || !selectedSubsystem || selectedSubsystem === ALL_SUBSYSTEMS) {
      setSubsystemParts([]);
      setSubsystemCatalog(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const info = await api.getSubcategoryForSubsystem({
        model: selectedModel,
        subsystem: selectedSubsystem,
      });
      if (cancelled) return;
      if (!info.subcategory_id) {
        setSubsystemParts([]);
        setSubsystemCatalog(null);
        return;
      }
      setSubsystemCatalog({
        id: info.subcategory_id,
        name: info.subcategory_name || selectedSubsystem,
      });
      const products = await api
        .getProducts({ subId: info.subcategory_id, limit: 6 })
        .catch(() => []);
      if (!cancelled) setSubsystemParts(products || []);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedModel, selectedSubsystem]);

  // Зміна авто скидає обраний шлях
  useEffect(() => {
    setSelectedSection('');
    setSelectedSubsystem('');
  }, [selectedModel]);

  // Вантажимо схеми, коли обрано авто. Виняток — пошук за парт-номером:
  // він має працювати й без вибору моделі (шукаємо по всьому каталогу схем).
  useEffect(() => {
    if (!selectedModel && !activeSearch) return;
    // Поки користувач обирає розділ/підсистему, список схем не вантажимо
    if (selectedModel && !activeSearch && !canShowSchemes) return;
    loadSchematics();
  }, [selectedModel, selectedGen, activeSearch, selectedSection, selectedSubsystem, showAllSchematics]);

  const loadActiveCar = () => {
    try {
      const saved = localStorage.getItem('tesla_garage_active_car');
      if (saved) {
        const parsed: SavedCar = JSON.parse(saved);
        setActiveCar(parsed);
        // Автоматично підставляємо авто з гаража, якщо модель не задана в URL
        if (!searchParams.get('model') && !searchParams.get('generation') && modelOptions.length > 0) {
          const option = resolveOption(modelOptions, parsed.model, parsed.generation);
          if (option) {
            setSelectedModel(option.category);
            setSelectedGen(ALL_GENERATIONS);
          }
        }
      } else {
        setActiveCar(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadSchematics = async () => {
    try {
      setLoading(true);
      setError(null);

      const option = selectedModel === ALL_MODELS
        ? null
        : modelOptions.find((o) => o.category === selectedModel);

      // Бекенд сам розуміє складені назви категорій («Model 3 Highland» →
      // Model 3 + покоління Highland), тому передаємо саме категорію.
      // Без обраної моделі (пошук за номером) — шукаємо по всіх схемах.
      const apiModel = option
        ? option.category
        : (selectedModel === ALL_MODELS ? undefined : selectedModel || undefined);

      const apiGen = selectedGen === ALL_GENERATIONS ? undefined : selectedGen;

      const data = await api.getSchematics({
        model: apiModel,
        generation: apiGen,
        section: selectedSection || undefined,
        subsystem:
          selectedSubsystem && selectedSubsystem !== ALL_SUBSYSTEMS
            ? selectedSubsystem
            : undefined,
        q: activeSearch || undefined
      });
      setSchematics(data);
    } catch (err: any) {
      setError(err.message || 'Помилка завантаження схем');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = searchInput.trim();
    // If it's a 17-character VIN, let's open garage modal with it or decode it!
    if (val.length === 17) {
      setIsGarageOpen(true);
      return;
    }
    setActiveSearch(val);
  };

  const getFullImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const activeModelObj = modelOptions.find((o) => o.category === selectedModel) || null;


  // Вибір авто: окремо реальні моделі й окремо аксесуари.
  // «Всі моделі» прибрано навмисно — схеми завжди привʼязані до конкретного авто.
  const carOptions = modelOptions.filter((o) => !o.is_accessory);
  const accessoryOptions = modelOptions.filter((o) => o.is_accessory);

  // Покоління показуємо лише тоді, коли категорія справді має кілька варіантів.
  const availableGenerations =
    activeModelObj && !activeModelObj.is_accessory && activeModelObj.generations.length > 1
      ? [ALL_GENERATIONS, ...activeModelObj.generations]
      : [];

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-gray-500 font-manrope mb-6">
        <Link to="/" className="hover:text-tesla-red transition-colors">
          Головна
        </Link>
        <ChevronRight size={14} className="text-gray-400" />
        <span className="text-gray-900 font-semibold">Схеми запчастин Tesla</span>
      </nav>

      {/* Hero / Title Section */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black font-montserrat text-tesla-dark tracking-tight">
          Схеми запчастин Tesla
        </h1>
        <p className="text-sm sm:text-base text-gray-500 font-manrope mt-2 max-w-2xl">
          Інтерактивні складальні схеми вузлів (EPC) та сумісні оригінальні деталі й якісні аналоги для вашої комплектації.
        </p>
      </div>

      {vinBanner && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
            <span className="font-montserrat font-bold text-sm">{vinBanner}</span>
          </div>
          <button
            onClick={() => setVinBanner(null)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-950 underline cursor-pointer"
          >
            Закрити
          </button>
        </div>
      )}

      {/* Search & Garage Banner */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-8 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="VIN або парт-номер деталі (напр. 1499151-00-C)..."
                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-manrope focus:outline-none focus:ring-2 focus:ring-tesla-red focus:bg-white transition-all shadow-inner"
              />
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3.5 bg-tesla-red hover:bg-red-700 text-white rounded-2xl font-montserrat font-bold text-sm transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
            >
              Знайти
            </button>
          </form>

          {/* Garage trigger button */}
          <button
            onClick={() => setIsGarageOpen(true)}
            className="flex items-center justify-center gap-2.5 px-5 py-3.5 bg-gray-900 hover:bg-black text-white rounded-2xl font-montserrat font-bold text-sm transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Car size={18} className="text-tesla-red" />
            {activeCar ? `Гараж: ${activeCar.model}` : 'Додати авто в гараж'}
          </button>
        </div>

        {/* Active car notification */}
        {activeCar && (
          <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-manrope text-gray-600">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>
                Активне авто: <strong>Tesla {activeCar.model} ({activeCar.year})</strong> — {activeCar.generation}
              </span>
            </div>
            <button
              onClick={() => setIsGarageOpen(true)}
              className="text-xs text-tesla-red hover:underline font-bold font-montserrat text-left sm:text-right"
            >
              Змінити авто
            </button>
          </div>
        )}
      </div>

      {/* КРОК 1: вибір автомобіля. Поки авто не обрано — більше нічого не показуємо */}
      {!selectedModel && !activeSearch && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm mb-8">
          <div className="flex items-center gap-2.5 mb-2">
            <Car size={20} className="text-tesla-red" />
            <h2 className="font-montserrat font-black text-lg sm:text-xl text-gray-900">
              Оберіть ваш автомобіль
            </h2>
          </div>
          <p className="text-sm text-gray-500 font-manrope mb-6 max-w-2xl">
            Схеми вузлів (EPC) відрізняються для кожної моделі та покоління. Оберіть своє авто —
            і ми покажемо лише сумісні вузли та деталі.
          </p>

          {modelOptions.length === 0 ? (
            <div className="py-10 text-center text-gray-400 font-manrope text-sm">
              Завантаження моделей...
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {carOptions.map((o) => (
                <button
                  key={o.category}
                  onClick={() => {
                    setSelectedModel(o.category);
                    setSelectedGen(ALL_GENERATIONS);
                  }}
                  className="group p-4 rounded-2xl border border-gray-200 bg-white text-left transition-all duration-200 hover:border-tesla-red hover:shadow-md active:scale-[0.98] cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-red-50 text-tesla-red flex items-center justify-center mb-3 transition-colors group-hover:bg-tesla-red group-hover:text-white">
                    <Car size={18} />
                  </div>
                  <div className="font-montserrat font-bold text-sm text-gray-900">
                    Tesla {o.category}
                  </div>
                  <div className="text-[11px] text-gray-400 font-manrope mt-0.5">
                    {o.schematics_count > 0
                      ? `${o.schematics_count} ${pluralSchemes(o.schematics_count)}`
                      : 'схем ще немає'}
                  </div>
                </button>
              ))}
            </div>
          )}

          {accessoryOptions.length > 0 && (
            <div className="mt-6 pt-5 border-t border-gray-100 flex flex-wrap items-center gap-2.5">
              <span className="text-[11px] uppercase tracking-wider font-montserrat font-bold text-gray-400">
                Аксесуари та універсальні схеми
              </span>
              {accessoryOptions.map((o) => (
                <button
                  key={o.category}
                  onClick={() => {
                    setSelectedModel(o.category);
                    setSelectedGen(ALL_GENERATIONS);
                  }}
                  className="px-4 py-2 rounded-full border border-gray-200 bg-white text-xs font-montserrat font-semibold text-gray-700 hover:border-tesla-red hover:text-tesla-red transition-colors cursor-pointer"
                >
                  {o.category}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Шлях до схеми — як у каталозі: авто › розділ › підсистема */}
      {(selectedModel || activeSearch) && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {selectedModel ? (
            <>
              <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white border border-gray-200 shadow-2xs">
                <Car size={16} className="text-tesla-red" />
                <span className="font-montserrat font-bold text-sm text-gray-900">
                  {activeModelObj && activeModelObj.is_accessory
                    ? activeModelObj.category
                    : `Tesla ${selectedModel}`}
                </span>
              </div>

              {selectedSection && (
                <>
                  <ChevronRight size={14} className="text-gray-300 shrink-0" />
                  <button
                    onClick={() => {
                      setSelectedSection('');
                      setSelectedSubsystem('');
                      setShowAllSchematics(false);
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white border border-gray-200 shadow-2xs font-montserrat font-bold text-sm text-gray-900 hover:border-tesla-red hover:text-tesla-red transition-colors cursor-pointer"
                  >
                    {selectedSection}
                  </button>
                </>
              )}

              {selectedSubsystem && selectedSubsystem !== ALL_SUBSYSTEMS && (
                <>
                  <ChevronRight size={14} className="text-gray-300 shrink-0" />
                  <span className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-red-50 border border-red-200 font-montserrat font-bold text-sm text-tesla-red">
                    {selectedSubsystem}
                  </span>
                </>
              )}

              <button
                onClick={() => {
                  setSelectedModel('');
                  setSelectedGen(ALL_GENERATIONS);
                  setSelectedSection('');
                  setSelectedSubsystem('');
                  setShowAllSchematics(false);
                }}
                className="text-xs font-bold font-montserrat text-tesla-red hover:underline cursor-pointer ml-1"
              >
                Змінити авто
              </button>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white border border-gray-200 shadow-2xs">
                <Search size={16} className="text-tesla-red" />
                <span className="font-montserrat font-bold text-sm text-gray-900">
                  Пошук: «{activeSearch}»
                </span>
              </div>
              <button
                onClick={() => {
                  setActiveSearch('');
                  setSearchInput('');
                }}
                className="text-xs font-bold font-montserrat text-tesla-red hover:underline cursor-pointer"
              >
                Скинути пошук
              </button>
            </>
          )}
        </div>
      )}

      {/* КРОК 2: розділ (шлях до схеми як у каталозі) */}
      {selectedModel && !activeSearch && !showAllSchematics && !selectedSection && (
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 font-montserrat">
              2. Оберіть розділ
            </span>
            {sections.length > 0 && (
              <button
                onClick={() => setShowAllSchematics(true)}
                className="text-xs font-bold font-montserrat text-tesla-red hover:underline cursor-pointer"
              >
                Показати всі схеми
              </button>
            )}
          </div>

          {sections.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-gray-300 p-10 text-center">
              <Layers size={40} className="mx-auto text-gray-300 mb-3" />
              <h3 className="font-montserrat font-bold text-gray-700">Для цієї моделі схем ще немає</h3>
              <p className="text-gray-400 font-manrope text-sm mt-1">
                Оберіть іншу модель або скористайтесь пошуком за парт-номером.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sections.map((group) => (
                <button
                  key={group.section}
                  onClick={() => {
                    setSelectedSection(group.section);
                    // Якщо підсистема в розділі одна — одразу її й беремо,
                    // щоб не змушувати клікати зайвий раз
                    setSelectedSubsystem(
                      group.subsystems.length === 1 ? group.subsystems[0].subsystem : ''
                    );
                  }}
                  className="group flex items-start gap-3 p-4 rounded-2xl border border-gray-200 bg-white text-left transition-all duration-200 hover:border-tesla-red hover:shadow-md active:scale-[0.98] cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-tesla-red flex items-center justify-center shrink-0 transition-colors group-hover:bg-tesla-red group-hover:text-white">
                    <Layers size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-montserrat font-bold text-sm text-gray-900 leading-tight">
                      {group.section}
                    </div>
                    <div className="text-[11px] text-gray-400 font-manrope mt-0.5">
                      {group.count} {pluralSchemes(group.count)}
                      {group.subsystems.length > 1 && ` • ${group.subsystems.length} підсистем`}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* КРОК 3: підсистема */}
      {selectedModel && !activeSearch && !showAllSchematics && needsSubsystemStep && !selectedSubsystem && (
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 font-montserrat">
              3. Оберіть підсистему
            </span>
            <button
              onClick={() => setSelectedSubsystem(ALL_SUBSYSTEMS)}
              className="text-xs font-bold font-montserrat text-tesla-red hover:underline cursor-pointer"
            >
              Усі підсистеми розділу
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeSectionSubsystems.map((sub) => (
              <button
                key={sub.subsystem}
                onClick={() => setSelectedSubsystem(sub.subsystem)}
                className="group p-4 rounded-2xl border border-gray-200 bg-white text-left transition-all duration-200 hover:border-tesla-red hover:shadow-md active:scale-[0.98] cursor-pointer"
              >
                <div className="font-montserrat font-bold text-sm text-gray-900 leading-tight">
                  {sub.subsystem}
                </div>
                <div className="text-[11px] text-gray-400 font-manrope mt-0.5">
                  {sub.count} {pluralSchemes(sub.count)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* КРОК 2: покоління (лише коли в категорії справді кілька варіантів) */}
      {availableGenerations.length > 0 && (
        <div className="mb-8">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-400 font-montserrat mb-3">
            2. Оберіть покоління
          </div>
          <div className="flex flex-wrap gap-2">
            {availableGenerations.map((gen) => {
              const isSelected = selectedGen === gen;
              return (
                <button
                  key={gen}
                  onClick={() => setSelectedGen(gen)}
                  className={`py-2 px-4 rounded-full text-xs font-montserrat font-semibold transition-all cursor-pointer border ${
                    isSelected
                      ? 'border-tesla-red bg-tesla-red text-white shadow-xs'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {gen}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Список вузлів: показуємо лише коли обрано авто (або є пошук за номером) */}
      {(activeSearch || canShowSchemes) && (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold font-montserrat text-gray-900 flex items-center gap-2">
            <Layers size={18} className="text-tesla-red" />
            Вузли та схеми
            <span className="text-xs font-normal text-gray-400 font-manrope">
              ({schematics.length})
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400 font-manrope">
            Завантаження схем...
          </div>
        ) : schematics.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-gray-300 p-8">
            <Layers size={48} className="mx-auto text-gray-300 mb-3" />
            <h3 className="font-montserrat font-bold text-gray-700 text-lg">Схем не знайдено</h3>
            <p className="text-gray-400 font-manrope text-sm mt-1 max-w-md mx-auto">
              Спробуйте змінити фільтр моделі чи покоління або скиньте рядок пошуку.
            </p>
            <button
              onClick={() => {
                // Повертаємось до кроку вибору автомобіля
                setSelectedModel('');
                setSelectedGen(ALL_GENERATIONS);
                setSelectedSection('');
                setSelectedSubsystem('');
                setShowAllSchematics(false);
                setActiveSearch('');
                setSearchInput('');
              }}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-tesla-red text-white rounded-xl text-xs font-montserrat font-bold cursor-pointer"
            >
              Обрати інше авто
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {schematics.map((s) => (
              <Link
                key={s.id}
                to={`/schemes/${s.id}`}
                className="group bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col cursor-pointer"
              >
                {/* Diagram Thumbnail */}
                <div className="relative h-52 bg-[#fbfbfb] p-6 flex items-center justify-center border-b border-gray-50 overflow-hidden">
                  {s.image_url ? (
                    <img
                      src={getFullImageUrl(s.image_url)}
                      alt={s.title}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <Layers size={40} className="text-gray-300" />
                  )}
                  <div className="absolute top-4 right-4 bg-tesla-red text-white text-[11px] font-bold px-2.5 py-1 rounded-full font-montserrat flex items-center gap-1 shadow-sm">
                    <MapPin size={12} />
                    {s.hotspots_count} точок
                  </div>
                </div>

                {/* Details */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800 text-[11px] font-montserrat font-bold">
                        {s.model}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-tesla-red text-[11px] font-manrope font-semibold">
                        {s.generation}
                      </span>
                    </div>

                    <h3 className="font-montserrat font-bold text-gray-900 text-lg group-hover:text-tesla-red transition-colors mb-1.5 line-clamp-1">
                      {s.title}
                    </h3>

                    <p className="text-xs text-gray-500 font-manrope line-clamp-1">
                      {s.section} • {s.subsystem}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-montserrat font-bold text-tesla-red group-hover:translate-x-0.5 transition-transform">
                    <span>Переглянути схему</span>
                    <ArrowRight size={16} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Деталі вузла з каталогу — той самий вузол, ті самі товари */}
      {subsystemCatalog && subsystemParts.length > 0 && (
        <div className="mt-10 pt-8 border-t border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold font-montserrat text-gray-900 flex items-center gap-2">
                <Package size={18} className="text-tesla-red" />
                Деталі вузла «{subsystemCatalog.name}»
                <span className="text-xs font-normal text-gray-400 font-manrope">
                  ({subsystemParts.length})
                </span>
              </h2>
              <p className="text-xs text-gray-500 font-manrope mt-1">
                Ті самі деталі, що й у каталозі — можна купити навіть без схеми.
              </p>
            </div>
            <Link
              to={`/category/${slugify(selectedModel)}/sub/${subsystemCatalog.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-red-50 hover:text-tesla-red text-gray-700 rounded-xl text-xs font-montserrat font-bold transition-colors"
            >
              Усі деталі розділу
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {subsystemParts.map((item) => (
              <Link
                key={item.id}
                to={`/product/${item.id}`}
                className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="h-28 bg-[#fbfbfb] p-3 flex items-center justify-center border-b border-gray-50">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <Package size={28} className="text-gray-300" />
                  )}
                </div>
                <div className="p-3">
                  <div className="text-[11px] text-gray-400 font-mono truncate">
                    {item.detail_number || item.id}
                  </div>
                  <div className="font-montserrat font-bold text-xs text-gray-900 leading-tight line-clamp-2 mt-1 group-hover:text-tesla-red transition-colors">
                    {item.name}
                  </div>
                  <div className="mt-2 font-montserrat font-black text-sm text-gray-900">
                    {item.inStock ? `${item.priceUAH} ₴` : 'Немає в наявності'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Garage Modal */}
      <GarageModal
        isOpen={isGarageOpen}
        onClose={() => setIsGarageOpen(false)}
        onCarSaved={(car) => {
          setActiveCar(car);
          // Мапимо авто з гаража на категорію каталогу (напр. Model 3 + Highland
          // → «Model 3 Highland»), щоб одразу показати правильні схеми
          const option = car ? resolveOption(modelOptions, car.model, car.generation) : null;
          if (option) {
            setSelectedModel(option.category);
            setSelectedGen(ALL_GENERATIONS);
          }
        }}
      />
    </div>
  );
};
